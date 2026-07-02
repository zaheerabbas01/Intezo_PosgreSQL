// lib/fronted/res/components/wigets/hospitalinfrom.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../providers/clinic_provider.dart';
import '../../../../providers/theme_provider.dart';
import '../../../../config/api_config.dart';
import '../../../../services/optimized_clinic_service.dart';
import '../../../../services/fast_clinic_loader.dart';
import '../../../../services/instant_clinic_service.dart';
import '../../../../services/api_service.dart';
import '../../../../services/event_bus.dart';
import '../../../../services/notification_service.dart';
import '../../../../services/secure_storage_service.dart';
import '../../../../services/socket_service.dart';
import 'booknow.dart';
import 'doctor_selection_modal.dart';

class HospitalInform extends StatefulWidget {
  final dynamic clinic;

  const HospitalInform({super.key, required this.clinic});

  @override
  State<HospitalInform> createState() => _HospitalInformState();
}

class _HospitalInformState extends State<HospitalInform> {
  bool loading = false;
  bool _hasActiveBooking = false;
  int _selectedDoctorIndex = -1; // -1 means no doctor selected
  bool _isClinicOpen = true; // Track real-time clinic status
  bool _notifyWhenOpenEnabled = false; // Track "notify me when open" state
  bool _notifyWhenOpenBusy = false; // Prevent double taps while syncing

  Map<String, dynamic>? _queueData;
  List<Map<String, dynamic>> _doctors = [];
  // Store queue data for each doctor
  final Map<String, Map<String, dynamic>> _doctorQueues = {};
  ClinicProvider? _clinicProvider;
  StreamSubscription? _queueUpdateSubscription;
  StreamSubscription? _clinicStatusSubscription;

  final ScrollController _doctorScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _isClinicOpen = widget.clinic['isOpen'] ?? true;
    _setupRealTimeUpdates();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadClinicDataOptimized();
      _checkActiveBooking();
      _loadNotifyWhenOpenState();
    });
  }

  Future<void> _loadNotifyWhenOpenState() async {
    final clinicId = widget.clinic['id'];

    // Server is the source of truth so the toggle defaults to off unless the
    // patient is actually subscribed on the backend. Fall back to the local
    // preference only if the request fails (e.g. offline / not logged in).
    final prefs = await ApiService.getNotificationPreferences();
    bool enabled;
    if (prefs != null) {
      final subscribed = (prefs['clinicNotifications'] as List? ?? [])
          .map((e) => e.toString())
          .contains(clinicId.toString());
      enabled = subscribed;
      // Reconcile any stale local flag with the server truth.
      if (subscribed) {
        await NotificationService().addClinicNotification(
          clinicId,
          widget.clinic['name'] ?? 'Clinic',
        );
      } else {
        await NotificationService().removeClinicNotification(clinicId);
      }
    } else {
      enabled = await NotificationService().isClinicNotificationEnabled(
        clinicId,
      );
    }

    if (mounted) {
      setState(() {
        _notifyWhenOpenEnabled = enabled;
      });
    }
  }

  // Toggle "Notify Me When Open" with honest feedback:
  // requires login, only claims success when the backend confirms.
  Future<void> _toggleNotifyWhenOpen() async {
    if (_notifyWhenOpenBusy) return;

    final patientId = await SecureStorageService.readPatientId();
    final token = await SecureStorageService.readToken();
    if (patientId == null || token == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please login to get notified when this clinic opens'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      return;
    }

    setState(() => _notifyWhenOpenBusy = true);

    final clinicId = widget.clinic['id'];
    final clinicName = widget.clinic['name'] ?? 'Clinic';
    final wasEnabled = _notifyWhenOpenEnabled;

    bool success;
    if (wasEnabled) {
      success = await NotificationService().removeClinicNotificationWithSync(
        clinicId,
      );
    } else {
      success = await NotificationService().addClinicNotificationWithSync(
        clinicId,
        clinicName,
      );
    }

    if (!mounted) return;

    setState(() {
      _notifyWhenOpenBusy = false;
      if (success) _notifyWhenOpenEnabled = !wasEnabled;
    });

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            wasEnabled
                ? 'You will no longer be notified about $clinicName'
                : 'You will be notified when $clinicName opens',
          ),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update notifications. Please try again.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  // Remove the call from didChangeDependencies since we're handling it in initState
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
  }

  @override
  void dispose() {
    _queueUpdateSubscription?.cancel();
    _clinicStatusSubscription?.cancel();
    _doctorScrollController.dispose();
    // Clear cache when leaving the screen to free memory
    OptimizedClinicService.clearClinicCache(widget.clinic['id']);
    super.dispose();
  }

  // OPTIMIZED: Load clinic data using the new fast endpoint
  Future<void> _loadClinicDataOptimized() async {
    try {
      setState(() {
        loading = true;
      });

      print(
        '🚀 OPTIMIZED: Loading complete clinic data for: ${widget.clinic['id']}',
      );

      // First, try to get cached data for instant display
      final cachedData = await OptimizedClinicService.getCachedClinicData(
        widget.clinic['id'],
      );
      if (cachedData != null && cachedData['doctors'] != null) {
        print('⚡ INSTANT: Displaying cached data');
        _updateUIWithClinicData(cachedData);
      }

      // USE INSTANT PARALLEL LOADING
      final instantData = await InstantClinicService.loadClinicDataFast(
        widget.clinic['id'],
      );

      if (instantData['doctors'] != null && instantData['doctors'].isNotEmpty) {
        print(
          '⚡ INSTANT SUCCESS: ${instantData['method']} in ${instantData['loadTime']}ms',
        );
        _updateUIWithInstantData(instantData);
      } else {
        print('🔄 FALLBACK: Using old method');
        await _loadDoctorsOldMethod();
      }
    } catch (e) {
      print('❌ ERROR: Optimized loading failed: $e');
      // Fallback to old method
      await _loadDoctorsOldMethod();
    } finally {
      setState(() {
        loading = false;
      });
    }
  }

  void _updateUIWithClinicData(Map<String, dynamic> data) {
    final doctors = data['doctors'] as List? ?? [];

    print('📊 UPDATING UI: ${doctors.length} doctors with queue data');

    setState(() {
      _doctors = List<Map<String, dynamic>>.from(doctors);

      // Update queue data for each doctor from the complete response
      for (var doctor in _doctors) {
        final queueInfo = doctor['queueInfo'] as Map<String, dynamic>? ?? {};
        _doctorQueues[doctor['id']] = {
          'current': queueInfo['current'] ?? 0,
          'nextNumber': queueInfo['nextNumber'] ?? 1,
          'upcoming': [],
          'totalWaiting': queueInfo['totalWaiting'] ?? 0,
          'avgWaitTime': queueInfo['avgWaitTime'] ?? 15,
          'canCallNext': false,
        };
        print(
          '👨‍⚕️ Doctor ${doctor['name']}: current=${queueInfo['current']}, waiting=${queueInfo['totalWaiting']}',
        );
      }

      // Select first available doctor by default
      if (_doctors.isNotEmpty) {
        _selectedDoctorIndex = 0;
        final selectedDoctor = _doctors[0];
        _queueData = _doctorQueues[selectedDoctor['id']];
        print('✅ Selected doctor: ${selectedDoctor['name']}');
      }
    });
  }

  void _updateUIWithInstantData(Map<String, dynamic> data) {
    final doctors = data['doctors'] as List? ?? [];

    print(
      '⚡ INSTANT UI UPDATE: ${doctors.length} doctors loaded in ${data['loadTime']}ms',
    );

    setState(() {
      _doctors = List<Map<String, dynamic>>.from(doctors);

      // Update queue data for each doctor from instant response
      for (var doctor in _doctors) {
        final queueInfo = doctor['queueInfo'] as Map<String, dynamic>? ?? {};
        _doctorQueues[doctor['id']] = {
          'current': queueInfo['current'] ?? 0,
          'nextNumber': queueInfo['nextNumber'] ?? 1,
          'upcoming': queueInfo['upcoming'] ?? [],
          'totalWaiting': queueInfo['totalWaiting'] ?? 0,
          'avgWaitTime': queueInfo['avgWaitTime'] ?? 15,
          'canCallNext': queueInfo['canCallNext'] ?? false,
        };
      }

      // Select first available doctor by default
      if (_doctors.isNotEmpty) {
        _selectedDoctorIndex = 0;
        final selectedDoctor = _doctors[0];
        _queueData = _doctorQueues[selectedDoctor['id']];
      }
    });
  }

  // Fallback method using old approach
  Future<void> _loadDoctorsOldMethod() async {
    try {
      print('🔄 FALLBACK: Using old method to load doctors');
      final response = await _clinicProvider?.getDoctors(widget.clinic['id']);

      if (response != null) {
        setState(() {
          _doctors = List<Map<String, dynamic>>.from(response);
        });

        // Load queue data for each doctor sequentially (old way)
        for (var doctor in _doctors) {
          await _loadDoctorQueue(doctor['id']);
        }

        // Select first doctor by default
        if (_doctors.isNotEmpty) {
          setState(() {
            _selectedDoctorIndex = 0;
          });
          await _loadClinicQueue(doctorId: _doctors[0]['_id']);
        }
      }
    } catch (e) {
      print('❌ FALLBACK ERROR: $e');
      setState(() {
        _doctors = [];
      });
    }
  }

  // OPTIMIZED: Load doctor queue using FastClinicLoader
  Future<void> _loadDoctorQueue(String doctorId) async {
    try {
      final queueData = await FastClinicLoader.loadDoctorQueueFast(
        widget.clinic['id'],
        doctorId,
      );

      if (mounted) {
        setState(() {
          _doctorQueues[doctorId] = {
            'current': queueData?['current'] ?? 0,
            'nextNumber': queueData?['nextNumber'] ?? 1,
            'upcoming': queueData?['upcoming'] ?? [],
            'totalWaiting': queueData?['totalWaiting'] ?? 0,
            'avgWaitTime': queueData?['avgWaitTime'] ?? 15,
            'canCallNext': queueData?['canCallNext'] ?? false,
          };
        });
      }
    } catch (e) {
      print('Error loading doctor queue data: $e');
      if (mounted) {
        setState(() {
          _doctorQueues[doctorId] = {
            'current': 0,
            'nextNumber': 1,
            'upcoming': [],
            'totalWaiting': 0,
            'avgWaitTime': 15,
            'canCallNext': false,
          };
        });
      }
    }
  }

  Future<void> _checkActiveBooking() async {
    try {
      final patientId = await SecureStorageService.readPatientId();

      if (patientId == null) {
        setState(() {
          _hasActiveBooking = false;
        });
        return;
      }

      // Check patient profile for active queues
      final profileResponse = await ApiService.get('patients/profile');
      print('Patient profile for active booking check: $profileResponse');

      if (profileResponse != null) {
        final activeQueues = profileResponse['activeQueues'] as List? ?? [];
        final currentQueue = profileResponse['currentQueue'];
        final isPremium = profileResponse['isPremium'] ?? false;
        final premiumExpiresAt = profileResponse['premiumExpiresAt'];
        final isPremiumActive =
            isPremium &&
            (premiumExpiresAt == null ||
                DateTime.parse(premiumExpiresAt).isAfter(DateTime.now()));

        // For premium users, only block if they have booking with the SAME doctor
        // For non-premium users, block if they have ANY active booking
        bool hasBlockingBooking = false;

        if (activeQueues.isNotEmpty || currentQueue != null) {
          if (isPremiumActive) {
            // Premium users: only block if booking with same doctor
            // We'll check this in the booking method, so don't block here
            hasBlockingBooking = false;
          } else {
            // Non-premium users: block any additional booking
            hasBlockingBooking = true;
          }
        }

        setState(() {
          _hasActiveBooking = hasBlockingBooking;
          print(
            'Has active booking: $_hasActiveBooking (activeQueues: ${activeQueues.length}, currentQueue: $currentQueue, isPremium: $isPremiumActive)',
          );
        });
      } else {
        setState(() {
          _hasActiveBooking = false;
        });
      }
    } catch (e) {
      print('Error checking active booking: $e');
      setState(() {
        _hasActiveBooking = false;
      });
    }
  }

  // In hospitalinfrom.dart - Update _loadClinicQueue method
  Future<void> _loadClinicQueue({String? doctorId}) async {
    try {
      // If no doctorId provided, use the selected doctor
      final targetDoctorId =
          doctorId ??
          (_selectedDoctorIndex != -1
              ? _doctors[_selectedDoctorIndex]['id']
              : null);

      if (targetDoctorId == null) {
        print('No doctor selected, cannot load queue data');
        return;
      }

      final clinicProvider = Provider.of<ClinicProvider>(
        context,
        listen: false,
      );
      await clinicProvider.loadCurrentQueue(
        widget.clinic['id'],
        forceRefresh: true,
        doctorId: targetDoctorId,
      );

      if (mounted) {
        setState(() {
          _queueData = clinicProvider.currentQueue;
        });
      }
    } catch (e) {
      print('Error loading queue data: $e');
    }
  }

  void _setupRealTimeUpdates() {
    // Connect to Socket.IO
    SocketService.instance.connect(clinicId: widget.clinic['id']);

    // Listen for queue updates
    _queueUpdateSubscription = EventBus().onQueueUpdate.listen((event) {
      if (event.clinicId == widget.clinic['id'] && mounted) {
        print(
          '🔥 Hospital Inform: Queue update received for doctor ${event.doctorId}',
        );

        final currentNumber =
            event.queueData['currentNumber'] ?? event.queueData['current'] ?? 0;
        final updatedQueue = {
          'current': currentNumber,
          'nextNumber': currentNumber + 1,
          'upcoming': event.queueData['upcoming'] ?? [],
          'totalWaiting': event.queueData['totalWaiting'] ?? 0,
          'avgWaitTime': event.queueData['avgWaitTime'] ?? 15,
          'canCallNext': event.queueData['canCallNext'] ?? false,
        };

        setState(() {
          // If doctorId is provided, update specific doctor queue
          if (event.doctorId != null) {
            _doctorQueues[event.doctorId!] = updatedQueue;

            // Update main queue data if this is the selected doctor
            if (_selectedDoctorIndex != -1 &&
                _doctors.isNotEmpty &&
                _doctors[_selectedDoctorIndex]['id'] == event.doctorId) {
              _queueData = updatedQueue;
              print(
                '🔥 Updated main queue data: current=${updatedQueue['current']}, next=${updatedQueue['nextNumber']}',
              );
            }
          } else {
            // If no doctorId, update the selected doctor's queue
            if (_selectedDoctorIndex != -1 && _doctors.isNotEmpty) {
              final selectedDoctorId = _doctors[_selectedDoctorIndex]['id'];
              _doctorQueues[selectedDoctorId] = updatedQueue;
              _queueData = updatedQueue;
              print(
                '🔥 Updated main queue data (no doctorId): current=${updatedQueue['current']}, next=${updatedQueue['nextNumber']}',
              );
            }
          }
        });
      }
    });

    // Listen for doctor availability changes
    EventBus().onDoctorAvailabilityUpdate.listen((event) {
      if (event.clinicId == widget.clinic['id'] && mounted) {
        setState(() {
          final doctorIndex = _doctors.indexWhere(
            (d) => d['_id'] == event.doctorId,
          );
          if (doctorIndex != -1) {
            _doctors[doctorIndex]['isAvailable'] = event.isAvailable;
          }
        });

        // Show notification when doctor availability changes
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Dr. ${event.doctorName} is now ${event.isAvailable ? "available" : "unavailable"}',
            ),
            backgroundColor: event.isAvailable ? Colors.green : Colors.orange,
            duration: Duration(seconds: 2),
          ),
        );
      }
    });

    // Listen for clinic status updates
    _clinicStatusSubscription = EventBus().onClinicStatusUpdate.listen((event) {
      if (event.clinicId == widget.clinic['id'] && mounted) {
        setState(() {
          _isClinicOpen = event.statusData['isOpen'] ?? true;
        });

        // Show message if clinic was just closed
        if (!_isClinicOpen) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('This clinic is now closed'),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 3),
            ),
          );
        }
      }
    });
  }

  // In hospitalinfrom.dart - Update queue calculation
  int _calculateNextNumber(
    int currentServing,
    Map<String, dynamic>? queueData,
  ) {
    if (queueData == null) return currentServing + 1;

    final upcoming = queueData['upcoming'] as List? ?? [];

    // If there are upcoming patients, find the highest number
    if (upcoming.isNotEmpty) {
      final highestUpcoming = upcoming.fold<int>(0, (max, patient) {
        final number = patient['number'] as int? ?? 0;
        return number > max ? number : max;
      });
      return highestUpcoming + 1;
    }

    // If no upcoming patients, next number is current + 1
    return currentServing + 1;
  }

  // Replace the _buildDoctorSelection method with this simplified version
  Widget _buildDoctorSelection() {
    if (_doctors.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Text(
            'No doctors available at this clinic',
            style: TextStyle(fontSize: 16, color: context.subtextColor),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final selectedDoctor = _selectedDoctorIndex != -1
        ? _doctors[_selectedDoctorIndex]
        : null;
    final doctorQueue = selectedDoctor != null
        ? _doctorQueues[selectedDoctor['id']] ??
              {'current': 0, 'nextNumber': 1, 'totalWaiting': 0}
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        Text(
          'Selected Doctor',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: context.textColor,
          ),
        ),
        const SizedBox(height: 12),

        // Selected doctor card or select button
        if (selectedDoctor != null)
          _buildselectedDoctorCard(
            doctor: selectedDoctor,
            currentServing: doctorQueue?['current'] ?? 0,
            nextNumber: _calculateNextNumber(
              doctorQueue?['current'] ?? 0,
              doctorQueue,
            ),
            totalWaiting: doctorQueue?['totalWaiting'] ?? 0,
          )
        else
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _showDoctorSelectionModal,
              style: ElevatedButton.styleFrom(
                backgroundColor: context.primaryColor,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'Select Doctor',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
      ],
    );
  }

  // Add this method to show the doctor selection modal
  void _showDoctorSelectionModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        builder: (context, scrollController) => DoctorSelectionModal(
          doctors: _doctors,
          doctorQueues: _doctorQueues,
          calculateNextNumber: _calculateNextNumber,
          onDoctorSelected: (doctor) async {
            final index = _doctors.indexWhere((d) => d['id'] == doctor['id']);
            if (index != -1) {
              setState(() {
                _selectedDoctorIndex = index;
              });
              // Use FastClinicLoader for queue data
              final queueData = await FastClinicLoader.loadDoctorQueueFast(
                widget.clinic['id'],
                doctor['id'],
              );

              if (queueData != null && mounted) {
                setState(() {
                  _queueData = {
                    'current': queueData['current'] ?? 0,
                    'nextNumber': queueData['nextNumber'] ?? 1,
                    'upcoming': queueData['upcoming'] ?? [],
                    'totalWaiting': queueData['totalWaiting'] ?? 0,
                    'avgWaitTime': queueData['avgWaitTime'] ?? 15,
                    'canCallNext': false,
                  };
                });
              } else {
                // Fallback to old method
                _loadClinicQueue(doctorId: doctor['id']);
              }

              // Connect socket for real-time updates for this doctor
              SocketService.instance.connect(
                clinicId: widget.clinic['id'],
                doctorId: doctor['id'],
              );
            }
          },
        ),
      ),
    );
  }

  Widget _buildselectedDoctorCard({
    required Map<String, dynamic> doctor,
    required int currentServing,
    required int nextNumber,
    required int totalWaiting,
  }) {
    final bool isAvailable = doctor['isAvailable'] ?? true;
    final bool isActive = doctor['isActive'] ?? true;
    final isDarkMode = context.isDarkMode;
    final primaryColor = context.primaryColor;

    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: context.cardColor,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: (!isAvailable || !isActive)
                            ? isDarkMode
                                  ? Colors.grey.shade700
                                  : Colors.grey.shade300
                            : primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(
                          color: (!isAvailable || !isActive)
                              ? Colors.grey
                              : primaryColor,
                          width: 2,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(23),
                        child: doctor['profilePhoto'] != null
                            ? Image.network(
                                doctor['profilePhoto'].startsWith('https://')
                                    ? doctor['profilePhoto']
                                    : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${doctor['profilePhoto']}',
                                width: 46,
                                height: 46,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Icon(
                                    Icons.person,
                                    color: (!isAvailable || !isActive)
                                        ? Colors.grey
                                        : primaryColor,
                                    size: 30,
                                  );
                                },
                              )
                            : Icon(
                                Icons.person,
                                color: (!isAvailable || !isActive)
                                    ? Colors.grey
                                    : primaryColor,
                                size: 30,
                              ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctor['name'] ?? 'Doctor',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: (!isAvailable || !isActive)
                                  ? context.subtextColor
                                  : context.textColor,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            doctor['specialty'] ?? 'General Practitioner',
                            style: TextStyle(
                              fontSize: 14,
                              color: (!isAvailable || !isActive)
                                  ? context.subtextColor.withOpacity(0.7)
                                  : context.subtextColor,
                            ),
                          ),
                          if (!isAvailable || !isActive)
                            Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    !isActive ? 'Not Active' : 'Not Available',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.red,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  GestureDetector(
                                    onTap: () async {
                                      try {
                                        await NotificationService()
                                            .addDoctorNotificationWithSync(
                                              doctor['id'],
                                              doctor['name'] ?? 'Doctor',
                                            );
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text(
                                              'You will be notified when Dr. ${doctor['name']} becomes available',
                                            ),
                                            backgroundColor: Colors.green,
                                          ),
                                        );
                                      } catch (e) {
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text(
                                              'Failed to enable notifications',
                                            ),
                                            backgroundColor: Colors.red,
                                          ),
                                        );
                                      }
                                    },
                                    child: Text(
                                      'Notify me when available',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.blue,
                                        fontWeight: FontWeight.w500,
                                        decoration: TextDecoration.underline,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.edit, color: context.textColor),
                      onPressed: _showDoctorSelectionModal,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Queue information for this doctor
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDarkMode
                        ? Colors.grey.shade800
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildQueueInfoItem('Serving', '$currentServing', false),
                      _buildQueueInfoItem('Next', '$nextNumber', false),
                      _buildQueueInfoItem('Waiting', '$totalWaiting', false),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: _showDoctorSelectionModal,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              side: BorderSide(color: context.primaryColor),
            ),
            child: Text(
              'Change Doctor',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: context.primaryColor,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQueueInfoItem(String label, String value, bool compact) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: compact ? 10 : 12,
            color: context.subtextColor,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: compact ? 14 : 16,
            fontWeight: FontWeight.bold,
            color: context.primaryColor,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;
    final isOpen = _isClinicOpen; // Use real-time status
    final currentServing = _queueData?['current'] ?? 0;
    final nextNumber = _calculateNextNumber(currentServing, _queueData);

    // Get selected doctor info
    final selectedDoctor = _selectedDoctorIndex == -1
        ? null
        : _doctors[_selectedDoctorIndex];

    final doctorFee = selectedDoctor != null
        ? (selectedDoctor['consultationFee'] ?? 0)
        : 0;

    // Check if selected doctor is available
    final selectedDoctorAvailable =
        selectedDoctor != null &&
        (selectedDoctor['isAvailable'] ?? true) &&
        (selectedDoctor['isActive'] ?? true);

    // Disable booking if clinic is closed OR user has active booking OR no doctor selected OR doctor unavailable
    final canBook =
        isOpen &&
        !_hasActiveBooking &&
        !loading &&
        _selectedDoctorIndex != -1 &&
        selectedDoctorAvailable;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        title: Text(
          widget.clinic['name'] ?? 'Clinic',
          style: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.bold,
            color: context.textColor,
          ),
        ),
        backgroundColor: context.cardColor,
        elevation: 0,
        foregroundColor: context.textColor,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: context.textColor),
            onPressed: () async {
              // OPTIMIZED: Refresh using batch endpoint
              if (_doctors.isNotEmpty) {
                final doctorIds = _doctors
                    .map((d) => d['_id'] as String)
                    .toList();
                final batchQueues =
                    await OptimizedClinicService.getBatchDoctorQueues(
                      widget.clinic['id'],
                      doctorIds,
                    );

                if (batchQueues != null && mounted) {
                  setState(() {
                    for (var doctorId in doctorIds) {
                      final queueData = batchQueues[doctorId];
                      if (queueData != null) {
                        _doctorQueues[doctorId] = {
                          'current': queueData['current'] ?? 0,
                          'nextNumber': queueData['nextNumber'] ?? 1,
                          'upcoming': [],
                          'totalWaiting': queueData['totalWaiting'] ?? 0,
                          'avgWaitTime': queueData['avgWaitTime'] ?? 15,
                          'canCallNext': false,
                        };
                      }
                    }

                    // Update main queue data if doctor is selected
                    if (_selectedDoctorIndex != -1) {
                      final selectedDoctorId =
                          _doctors[_selectedDoctorIndex]['id'];
                      _queueData = _doctorQueues[selectedDoctorId];
                    }
                  });
                } else {
                  // Fallback to individual refresh
                  if (_selectedDoctorIndex != -1) {
                    _loadClinicQueue(
                      doctorId: _doctors[_selectedDoctorIndex]['id'],
                    );
                  }
                  for (var doctor in _doctors) {
                    _loadDoctorQueue(doctor['id']);
                  }
                }
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Clinic Information Card
            Container(
              decoration: BoxDecoration(
                color: context.cardColor,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (widget.clinic['profilePhoto'] != null)
                          Container(
                            width: 60,
                            height: 60,
                            margin: const EdgeInsets.only(right: 16),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: context.primaryColor,
                                width: 2,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.network(
                                widget.clinic['profilePhoto'].startsWith(
                                      'https://',
                                    )
                                    ? widget.clinic['profilePhoto']
                                    : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${widget.clinic['profilePhoto']}',
                                width: 56,
                                height: 56,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    width: 56,
                                    height: 56,
                                    decoration: BoxDecoration(
                                      color: context.primaryColor.withOpacity(
                                        0.1,
                                      ),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(
                                      Icons.local_hospital,
                                      color: context.primaryColor,
                                      size: 30,
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                        Expanded(
                          child: Text(
                            widget.clinic['name'] ?? 'Clinic',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: context.primaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (widget.clinic['address'] != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
                        child: Row(
                          children: [
                            Icon(
                              Icons.location_on,
                              size: 16,
                              color: context.subtextColor,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                widget.clinic['address']!,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: context.subtextColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Row(
                      children: [
                        Icon(
                          Icons.access_time,
                          size: 16,
                          color: context.subtextColor,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${widget.clinic['operatingHours']?['opening'] ?? '09:00'} - '
                          '${widget.clinic['operatingHours']?['closing'] ?? '17:00'}',
                          style: TextStyle(
                            fontSize: 14,
                            color: context.subtextColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: isOpen
                                ? Colors.green.withOpacity(
                                    isDarkMode ? 0.2 : 0.1,
                                  )
                                : Colors.red.withOpacity(
                                    isDarkMode ? 0.2 : 0.1,
                                  ),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isOpen
                                  ? Colors.green.withOpacity(
                                      isDarkMode ? 0.5 : 0.3,
                                    )
                                  : Colors.red.withOpacity(
                                      isDarkMode ? 0.5 : 0.3,
                                    ),
                            ),
                          ),
                          child: Text(
                            isOpen ? 'OPEN' : 'CLOSED',
                            style: TextStyle(
                              color: isOpen ? Colors.green : Colors.red,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const Spacer(),
                        // Show clinic location on a map
                        if (_hasClinicLocation ||
                            (widget.clinic['address']?.toString().trim() ?? '')
                                .isNotEmpty)
                          OutlinedButton.icon(
                            onPressed: _openMap,
                            icon: Icon(
                              Icons.map,
                              size: 18,
                              color: context.primaryColor,
                            ),
                            label: Text(
                              'Map',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: context.primaryColor,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              side: BorderSide(color: context.primaryColor),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Notify Me Button
            if (!isOpen)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 20),
                child: ElevatedButton.icon(
                  onPressed: _notifyWhenOpenBusy ? null : _toggleNotifyWhenOpen,
                  icon: _notifyWhenOpenBusy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(Colors.white),
                          ),
                        )
                      : Icon(
                          _notifyWhenOpenEnabled
                              ? Icons.notifications_off
                              : Icons.notifications_active,
                          color: Colors.white,
                        ),
                  label: Text(
                    _notifyWhenOpenEnabled
                        ? 'Cancel Open Notification'
                        : 'Notify Me When Open',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _notifyWhenOpenEnabled
                        ? Colors.grey.shade600
                        : Colors.orange,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),

            // Doctor Selection Section
            _buildDoctorSelection(),

            const SizedBox(height: 20),

            // Queue Information Card - Only show if doctor is selected
            if (_selectedDoctorIndex != -1)
              Container(
                decoration: BoxDecoration(
                  color: context.cardColor,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Queue Information',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: context.textColor,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildQueueInfoRow(
                        'Currently Serving:',
                        '$currentServing',
                      ),
                      _buildQueueInfoRow('Next Available:', '$nextNumber'),
                      _buildQueueInfoRow(
                        'Patients Waiting:',
                        '${_queueData?['totalWaiting'] ?? 0}',
                      ),
                      _buildQueueInfoRow('Consultation Fee:', 'PKR $doctorFee'),

                      // Show clinic closed warning
                      if (!isOpen)
                        Padding(
                          padding: const EdgeInsets.only(top: 12, bottom: 8),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(
                                isDarkMode ? 0.2 : 0.1,
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Colors.red.withOpacity(
                                  isDarkMode ? 0.5 : 0.3,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error, color: Colors.red, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'This clinic is currently closed',
                                    style: TextStyle(
                                      color: Colors.red,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // Show active booking warning if user has one (only for non-premium)
                      if (_hasActiveBooking)
                        Padding(
                          padding: const EdgeInsets.only(top: 12, bottom: 8),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.orange.withOpacity(
                                isDarkMode ? 0.2 : 0.1,
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Colors.orange.withOpacity(
                                  isDarkMode ? 0.5 : 0.3,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.warning,
                                  color: Colors.orange,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'You already have an active booking. Upgrade to Premium to book multiple queues.',
                                    style: TextStyle(
                                      color: Colors.orange,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // Show doctor unavailable warning
                      if (!selectedDoctorAvailable &&
                          _selectedDoctorIndex != -1)
                        Padding(
                          padding: const EdgeInsets.only(top: 12, bottom: 8),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(
                                isDarkMode ? 0.2 : 0.1,
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Colors.red.withOpacity(
                                  isDarkMode ? 0.5 : 0.3,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error, color: Colors.red, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'This doctor is currently unavailable for booking',
                                    style: TextStyle(
                                      color: Colors.red,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: canBook
                              ? _bookQueue
                              : () {
                                  // Show appropriate message when button is disabled
                                  if (!isOpen) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'Clinic is currently closed',
                                        ),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                  } else if (_hasActiveBooking) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'You already have an active booking. Upgrade to Premium to book multiple queues.',
                                        ),
                                        backgroundColor: Colors.orange,
                                      ),
                                    );
                                  } else if (!selectedDoctorAvailable) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          'Selected doctor is currently unavailable',
                                        ),
                                        backgroundColor: Colors.orange,
                                      ),
                                    );
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: canBook
                                ? context.primaryColor
                                : Colors.grey.shade400,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          child: loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation(
                                      Colors.white,
                                    ),
                                  ),
                                )
                              : Text(
                                  !isOpen
                                      ? 'Clinic Closed'
                                      : _hasActiveBooking
                                      ? 'Upgrade to Premium'
                                      : !selectedDoctorAvailable
                                      ? 'Doctor Unavailable'
                                      : 'Book Queue Number',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 20),

            // Additional Information
            Container(
              decoration: BoxDecoration(
                color: context.cardColor,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'About this Clinic',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: context.textColor,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.clinic['description'] ??
                          'This clinic provides quality healthcare services. '
                              'Please arrive 10 minutes before your scheduled time.',
                      style: TextStyle(
                        fontSize: 14,
                        color: context.subtextColor,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // Parse a coordinate that may arrive as num or String from the API.
  double? _parseCoordinate(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  bool get _hasClinicLocation =>
      _parseCoordinate(widget.clinic['latitude']) != null &&
      _parseCoordinate(widget.clinic['longitude']) != null;

  // Open the clinic location in the device map app (Google/Apple Maps).
  // Uses coordinates when available, otherwise falls back to the address.
  Future<void> _openMap() async {
    final lat = _parseCoordinate(widget.clinic['latitude']);
    final lng = _parseCoordinate(widget.clinic['longitude']);
    final address = widget.clinic['address'] as String?;

    late final Uri mapUri;
    if (lat != null && lng != null) {
      mapUri = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
      );
    } else if (address != null && address.trim().isNotEmpty) {
      mapUri = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}',
      );
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location is not available for this clinic'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    try {
      final launched = await launchUrl(
        mapUri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open the map'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Error opening map: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open the map'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _buildQueueInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: context.subtextColor,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: context.primaryColor,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _bookQueue() async {
    if (!_isClinicOpen) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Clinic is currently closed'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (_selectedDoctorIndex == -1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a doctor first')),
      );
      return;
    }

    try {
      setState(() {
        loading = true;
      });

      final patientId = await SecureStorageService.readPatientId();
      final token = await SecureStorageService.readToken();

      if (patientId == null || token == null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Please login first')));
        return;
      }

      // Check premium status and active bookings
      final profileResponse = await ApiService.get('patients/profile');
      bool isPremiumActive = false;
      if (profileResponse != null) {
        final activeQueues = profileResponse['activeQueues'] as List? ?? [];
        final isPremium = profileResponse['isPremium'] ?? false;
        final premiumExpiresAt = profileResponse['premiumExpiresAt'];
        isPremiumActive =
            isPremium &&
            (premiumExpiresAt == null ||
                DateTime.parse(premiumExpiresAt).isAfter(DateTime.now()));

        if (activeQueues.isNotEmpty && !isPremiumActive) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'You already have an active booking. Premium users can book multiple queues.',
              ),
            ),
          );
          setState(() {
            loading = false;
            _hasActiveBooking = true;
          });
          return;
        }
      }

      // Premium users must provide a patient name — show dialog before calling backend
      if (isPremiumActive) {
        setState(() {
          loading = false;
        });
        _showPatientNameDialog();
        return;
      }

      // Non-premium: book directly
      await _submitBooking(patientId, null);
    } catch (e) {
      print('Booking error: $e');
      _handleBookingError(e.toString());
    } finally {
      setState(() {
        loading = false;
      });
    }
  }

  // Add patient name dialog for premium users
  void _showPatientNameDialog() {
    final TextEditingController nameController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Patient Name Required'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'As a premium user, please provide the patient name for this booking.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Patient Name',
                  hintText: 'Enter patient name',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                autofocus: true,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final patientName = nameController.text.trim();
                if (patientName.length >= 2) {
                  Navigator.of(context).pop();
                  _bookQueueWithPatientName(patientName);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Patient name must be at least 2 characters',
                      ),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              child: const Text('Book Queue'),
            ),
          ],
        );
      },
    );
  }

  // Shared booking submission logic
  Future<void> _submitBooking(String patientId, String? patientName) async {
    final doctorId = _doctors[_selectedDoctorIndex]['id'];
    final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
    final result = await clinicProvider.bookQueueNumber(
      widget.clinic['id'],
      patientId,
      doctorId: doctorId,
      patientName: patientName,
    );

    if ((result['queueNumber'] != null || result['success'] == true)) {
      await _loadClinicQueue(doctorId: doctorId);
      await _checkActiveBooking();
      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => Booknow(
              clinic: widget.clinic,
              queueNumber: result['queueNumber'] ?? 0,
              doctor: _doctors[_selectedDoctorIndex],
            ),
          ),
        );
      }
    } else {
      throw Exception('Booking failed: No valid response from server');
    }
  }

  void _handleBookingError(String error) {
    String message = 'Booking failed. Please try again.';
    Color color = Colors.red;
    if (error.contains('Doctor is not available') ||
        error.contains('Doctor currently unavailable')) {
      message =
          'Selected doctor is not available. Please choose another doctor.';
      color = Colors.orange;
    } else if (error.contains('closed') || error.contains('not open')) {
      message = 'Clinic is currently closed.';
    } else if (error.contains('already have an active booking') ||
        error.contains('Active booking exists')) {
      message =
          'You already have an active booking. Upgrade to Premium to book multiple queues.';
      color = Colors.orange;
    } else if (error.contains('same doctor') ||
        error.contains('booking with this doctor')) {
      message = 'You already have an active booking with this doctor.';
      color = Colors.orange;
    }
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
    }
  }

  // Book queue with patient name for premium users
  Future<void> _bookQueueWithPatientName(String patientName) async {
    try {
      setState(() {
        loading = true;
      });
      final patientId = await SecureStorageService.readPatientId();
      if (patientId == null) return;
      await _submitBooking(patientId, patientName);
    } catch (e) {
      _handleBookingError(e.toString());
    } finally {
      setState(() {
        loading = false;
      });
    }
  }
}
