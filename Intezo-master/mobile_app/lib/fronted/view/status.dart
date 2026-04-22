import 'dart:async';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/clinic_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/api_service.dart';
import '../../services/clinic_service.dart';
import '../../services/event_bus.dart';
import '../../services/wait_time_service.dart';
import '../res/components/wigets/colors.dart';
import 'bottom_navigator.dart';

class Status extends StatefulWidget {
  const Status({super.key});

  @override
  State<Status> createState() => _StatusState();
}

class _StatusState extends State<Status> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _queueData;
  bool _showUpdateIndicator = false;
  Map<String, dynamic>? _waitTimeData;
  Timer? _waitTimeTimer;

  StreamSubscription? _queueUpdateSubscription;
  StreamSubscription? _patientServedSubscription;
  ClinicProvider? _clinicProvider;

  @override
  void initState() {
    super.initState();

    // Use a delay to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    await _loadCurrentQueueStatus();
    _setupRealTimeUpdates();
    _startWaitTimeUpdates();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        backgroundColor: context.cardColor,
        title: Text(
          "Queue Status",
          style: TextStyle(
            color: context.textColor,
          ),
        ),
        foregroundColor: context.textColor,
        elevation: 0,
        actions: [
          if (_showUpdateIndicator)
            Container(
              margin: EdgeInsets.only(right: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.wifi,
                    color: Colors.green,
                    size: 16,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Live',
                    style: TextStyle(
                      color: Colors.green,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          IconButton(
            icon: Icon(
              Icons.refresh,
              color: isDarkMode ? Colors.white70 : Colors.black54,
            ),
            onPressed: () async {
              await _loadCurrentQueueStatus();
              // Restart real-time updates after refresh if we have an active booking
              if (_queueData != null && _queueData!['currentQueue'] != null) {
                final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
                final clinicId = _queueData!['currentQueue']['clinic']['_id'];
                final doctorId = _queueData!['currentQueue']['doctor']?['_id'];
                clinicProvider.startListeningForUpdates(clinicId, doctorId: doctorId);
              }
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _buildMainContent(isDarkMode),
    );
  }

  Widget _buildMainContent(bool isDarkMode) {
    if (_error != null) {
      return _buildErrorState(isDarkMode);
    }

    // Check for premium user with multiple bookings
    if (_queueData != null && _queueData!['isPremium'] == true && _queueData!['activeBookings'] != null) {
      final activeBookings = _queueData!['activeBookings'] as List;
      if (activeBookings.isNotEmpty) {
        return _buildPremiumBookingsList(activeBookings, isDarkMode);
      }
    }

    // Check if we have a single active booking (non-premium or old format)
    final hasActiveBooking =
        _queueData != null &&
        _queueData!['currentQueue'] != null &&
        _queueData!['error'] == null &&
        _queueData!['currentQueue']['status'] != 'served';

    print('Queue data status: ${_queueData?['currentQueue']?['status']}');
    print('Has active booking: $hasActiveBooking');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Current queue status (if available)
          if (hasActiveBooking)
            _buildCurrentQueueCard(_queueData!['currentQueue'], isDarkMode)
          else
            _buildNoQueueEncouragement(isDarkMode),
        ],
      ),
    );
  }

  void _setupRealTimeUpdates() {
    _queueUpdateSubscription = EventBus().onQueueUpdate.listen((event) {
      print('🔥 Real-time event received in Status screen: ${event.queueData}');
      
      // Check if patient's number is being served
      final currentNumber = event.queueData['currentNumber'];
      if (_queueData != null && _queueData!['currentQueue'] != null) {
        final patientNumber = _queueData!['currentQueue']['number'];
        
        if (currentNumber == patientNumber) {
          print('Patient number $patientNumber has been served!');
          // Patient is being served - reload status to check if served
          _loadCurrentQueueStatus();
          return;
        }
        
        // Update the currently serving number in real-time
        if (mounted) {
          setState(() {
            _queueData!['currentQueue']['currentServing'] = currentNumber;
            
            // Use server-provided position data when available, fallback to calculation
            final serverPosition = _queueData!['currentQueue']['positionInQueue'];
            final positionInQueue = serverPosition ?? (patientNumber - currentNumber);
            final avgProcessTime = event.queueData['avgProcessTimeMinutes'] ?? 
                                 event.queueData['avgWaitTime'] ?? 15;
            final estimatedWait = positionInQueue > 0 ? positionInQueue * avgProcessTime : 0;
            
            _queueData!['currentQueue']['currentServing'] = currentNumber;
            _queueData!['currentQueue']['positionInQueue'] = positionInQueue > 0 ? positionInQueue : 0;
            _queueData!['currentQueue']['estimatedWait'] = estimatedWait;
            _queueData!['currentQueue']['estimatedWaitTime'] = WaitTimeService.formatWaitTime(estimatedWait);
            _queueData!['currentQueue']['estimatedWaitMinutes'] = estimatedWait;
            _queueData!['currentQueue']['patientsAhead'] = positionInQueue > 0 ? positionInQueue : 0;
            
            // Show update indicator
            _showUpdateIndicator = true;
          });
          
          // Hide update indicator after 2 seconds
          Future.delayed(Duration(seconds: 2), () {
            if (mounted) {
              setState(() {
                _showUpdateIndicator = false;
              });
            }
          });
        }
      } else {
        // Check if this is a premium user with multiple bookings
        if (_queueData != null && _queueData!['isPremium'] == true && _queueData!['activeBookings'] != null) {
          final activeBookings = _queueData!['activeBookings'] as List;
          bool updated = false;
          
          // Update any matching booking in the list
          for (int i = 0; i < activeBookings.length; i++) {
            final booking = activeBookings[i];
            final bookingClinicId = booking['clinic']?['_id'];
            final bookingDoctorId = booking['doctor']?['_id'];
            
            // Check if this update is for this booking
            if (bookingClinicId == event.clinicId && 
                (event.doctorId == null || bookingDoctorId == event.doctorId)) {
              
              final patientNumber = booking['queueNumber'] ?? booking['number'];
              if (patientNumber != null) {
                // Use server-provided position data when available, fallback to calculation
                final serverPosition = booking['positionInQueue'];
                final positionInQueue = serverPosition ?? (patientNumber - currentNumber);
                final avgProcessTime = event.queueData['avgProcessTimeMinutes'] ?? 
                                     event.queueData['avgWaitTime'] ?? 15;
                final estimatedWait = positionInQueue > 0 ? positionInQueue * avgProcessTime : 0;
                
                if (mounted) {
                  setState(() {
                    activeBookings[i]['currentServing'] = currentNumber;
                    activeBookings[i]['positionInQueue'] = positionInQueue > 0 ? positionInQueue : 0;
                    activeBookings[i]['estimatedWaitMinutes'] = estimatedWait;
                    activeBookings[i]['estimatedWaitTime'] = WaitTimeService.formatWaitTime(estimatedWait);
                    activeBookings[i]['patientsAhead'] = positionInQueue > 0 ? positionInQueue : 0;
                    
                    _showUpdateIndicator = true;
                  });
                  updated = true;
                }
              }
            }
          }
          
          if (updated) {
            // Hide update indicator after 2 seconds
            Future.delayed(Duration(seconds: 2), () {
              if (mounted) {
                setState(() {
                  _showUpdateIndicator = false;
                });
              }
            });
          }
        } else {
          // No active booking, just reload to check for new bookings
          _loadCurrentQueueStatus();
        }
      }
    });

    // Listen for patient served events
    _patientServedSubscription = EventBus().onPatientServed.listen((event) {
      print('🔥 Patient served event received: ${event.patientId}');
      if (_queueData != null && _queueData!['currentQueue'] != null) {
        final currentQueueId = _queueData!['currentQueue']['_id'];
        if (event.queueId == currentQueueId) {
          print('Current patient has been served, clearing booking');
          _loadCurrentQueueStatus();
        }
      }
    });
  }

  Future<void> _loadCurrentQueueStatus() async {
    try {
      if (mounted) {
        setState(() {
          _isLoading = true;
          _error = null;
        });
      }

      final clinicProvider = Provider.of<ClinicProvider>(
        context,
        listen: false,
      );
      final queueData = await clinicProvider.getPatientCurrentQueue();

      print('Queue status response: $queueData');

      // Check for premium user with multiple bookings
      if (queueData != null && queueData['isPremium'] == true && queueData['activeBookings'] != null) {
        print('Premium user with ${queueData['activeBookings'].length} active bookings');
        setState(() {
          _queueData = queueData;
        });
        
        // Start listening for updates for all active bookings
        for (var booking in queueData['activeBookings']) {
          final clinicId = booking['clinic']['_id'];
          final doctorId = booking['doctor']?['_id'];
          clinicProvider.startListeningForUpdates(clinicId, doctorId: doctorId);
        }
      }
      // Check if we have single queue data (non-premium or old format)
      else if (queueData != null &&
          queueData['currentQueue'] != null &&
          queueData['error'] == null) {
        final status = queueData['currentQueue']['status'];
        print('Current booking status: $status');

        // Check if patient was served - if so, clear the booking
        if (status == 'served') {
          print('Patient was served, clearing booking');
          setState(() {
            _queueData = null;
          });

          // Show served message
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'You have been served! You can now book a new appointment.',
                ),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 3),
              ),
            );
          }
        } else {
          // Active booking - show it
          print('Active booking found with status: $status');
          setState(() {
            _queueData = queueData;
          });

          final clinicId = queueData['currentQueue']['clinic']['_id'];
          final doctorId = queueData['currentQueue']['doctor']?['_id'];

          // Start listening for updates with doctor-specific channel (optimized)
          clinicProvider.startListeningForUpdates(clinicId, doctorId: doctorId);
        }
      } else {
        // No active booking - clear the data
        print('No queue data found, clearing booking');
        setState(() {
          _queueData = null;
        });

        // Stop listening for updates since there's no active booking
        clinicProvider.stopListeningForUpdates();
      }
    } catch (e) {
      setState(() {
        _error = 'Error loading queue status: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Start periodic wait time updates (minimal frequency since real-time updates handle most cases)
  void _startWaitTimeUpdates() {
    _waitTimeTimer = Timer.periodic(Duration(seconds: 60), (timer) {
      _updateWaitTimes();
    });
  }

  /// Update wait times for active bookings (fallback for when real-time updates fail)
  Future<void> _updateWaitTimes() async {
    if (_queueData == null) return;

    try {
      // Handle premium users with multiple bookings
      if (_queueData!['isPremium'] == true && _queueData!['activeBookings'] != null) {
        final activeBookings = _queueData!['activeBookings'] as List;
        for (int i = 0; i < activeBookings.length; i++) {
          final booking = activeBookings[i];
          final clinicId = booking['clinic']['_id'];
          final doctorId = booking['doctor']?['_id'];
          final queueId = booking['_id'];
          
          if (doctorId != null && queueId != null) {
            final waitTime = await WaitTimeService.getPatientWaitTime(queueId);
            if (waitTime != null && mounted) {
              setState(() {
                activeBookings[i]['estimatedWaitMinutes'] = waitTime['estimatedWaitMinutes'];
                activeBookings[i]['estimatedWaitTime'] = waitTime['estimatedWaitTime'];
                activeBookings[i]['patientsAhead'] = waitTime['patientsAhead'];
                activeBookings[i]['currentlyServing'] = waitTime['currentlyServing'];
              });
            }
          }
        }
      }
      // Handle single booking - only update if real-time data seems stale
      else if (_queueData!['currentQueue'] != null) {
        final queueId = _queueData!['currentQueue']['_id'];
        if (queueId != null) {
          final waitTime = await WaitTimeService.getPatientWaitTime(queueId);
          if (waitTime != null && mounted) {
            // Only update if the server data is different from current data
            final currentServing = _queueData!['currentQueue']['currentServing'] ?? 0;
            final serverCurrentServing = waitTime['currentlyServing'] ?? 0;
            
            if (serverCurrentServing != currentServing) {
              setState(() {
                _queueData!['currentQueue']['estimatedWaitMinutes'] = waitTime['estimatedWaitMinutes'];
                _queueData!['currentQueue']['estimatedWaitTime'] = waitTime['estimatedWaitTime'];
                _queueData!['currentQueue']['patientsAhead'] = waitTime['patientsAhead'];
                _queueData!['currentQueue']['currentlyServing'] = waitTime['currentlyServing'];
                _queueData!['currentQueue']['positionInQueue'] = waitTime['patientsAhead'];
                _queueData!['currentQueue']['estimatedWait'] = waitTime['estimatedWaitMinutes'];
              });
            }
          }
        }
      }
    } catch (e) {
      print('Error updating wait times: $e');
    }
  }

  /// Update wait time for a specific booking
  Future<void> _updateWaitTimeForBooking(String clinicId, String doctorId, int patientNumber, int currentNumber) async {
    try {
      final waitTimeData = await WaitTimeService.getWaitTime(clinicId, doctorId);
      if (waitTimeData != null && mounted) {
        final avgProcessTime = waitTimeData['avgProcessTimeMinutes'] ?? 15;
        final calculatedWaitTime = WaitTimeService.calculateWaitTime(
          currentNumber: currentNumber,
          patientNumber: patientNumber,
          avgProcessTime: avgProcessTime,
        );
        
        setState(() {
          _queueData!['currentQueue']['positionInQueue'] = calculatedWaitTime['patientsAhead'];
          _queueData!['currentQueue']['estimatedWait'] = calculatedWaitTime['estimatedMinutes'];
          _queueData!['currentQueue']['estimatedWaitTime'] = calculatedWaitTime['estimatedTime'];
          _queueData!['currentQueue']['currentServing'] = currentNumber;
        });
      }
    } catch (e) {
      print('Error updating wait time for booking: $e');
    }
  }

  @override
  void dispose() {
    _queueUpdateSubscription?.cancel();
    _patientServedSubscription?.cancel();
    _waitTimeTimer?.cancel();

    // Stop listening for updates when screen is disposed
    if (_clinicProvider != null) {
      _clinicProvider!.stopListeningForUpdates();
    }

    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
  }

  Widget _buildErrorState(bool isDarkMode) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
          const SizedBox(height: 16),
          Text(
            _error!,
            style: TextStyle(
              fontSize: 16,
              color: context.textColor,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loadData,
            style: ElevatedButton.styleFrom(
              backgroundColor: colors().bluecolor1,
              foregroundColor: Colors.white,
            ),
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  Widget _buildPremiumBookingsList(List activeBookings, bool isDarkMode) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.star, color: colors().bluecolor1, size: 20),
              SizedBox(width: 8),
              Text(
                'Premium - Active Bookings (${activeBookings.length})',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: colors().bluecolor1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...activeBookings.map((booking) => _buildBookingListItem(booking, isDarkMode)).toList(),
        ],
      ),
    );
  }

  Widget _buildBookingListItem(dynamic booking, bool isDarkMode) {
    final queueNumber = booking['queueNumber'] ?? 'N/A';
    final currentServing = booking['currentServing'] ?? 0;
    final positionInQueue = booking['positionInQueue'] ?? 0;
    final isBeingServed = positionInQueue <= 0;
    final clinicName = booking['clinic']?['name'] ?? 'Unknown Clinic';
    final doctorName = booking['doctor']?['name'] ?? 'Unknown Doctor';
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        color: context.cardColor,
        child: InkWell(
          onTap: () => _showBookingDetails(booking, isDarkMode),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                // Queue number circle
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: isBeingServed ? Colors.green : colors().bluecolor1,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '$queueNumber',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // Booking info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        clinicName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: context.textColor,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Dr. $doctorName',
                        style: TextStyle(
                          fontSize: 14,
                          color: context.subtextColor,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (booking['patientName'] != null)
                        Column(
                          children: [
                            const SizedBox(height: 2),
                            Text(
                              'Patient: ${booking['patientName']}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.blue,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      const SizedBox(height: 4),
                      Text(
                        isBeingServed ? 'Your turn!' : 'Position: $positionInQueue',
                        style: TextStyle(
                          fontSize: 12,
                          color: isBeingServed ? Colors.green : Colors.orange,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (!isBeingServed && booking['estimatedWaitTime'] != null)
                        Column(
                          children: [
                            const SizedBox(height: 2),
                            Text(
                              'Wait: ${booking['estimatedWaitTime']}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.blue.shade600,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                // Status indicator
                Column(
                  children: [
                    if (isBeingServed)
                      Icon(Icons.notifications_active, color: Colors.green, size: 20)
                    else
                      Text(
                        'Serving\n$currentServing',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: context.subtextColor,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Icon(Icons.arrow_forward_ios, size: 16, color: context.subtextColor),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showBookingDetails(dynamic booking, bool isDarkMode) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        builder: (context, scrollController) => Container(
          decoration: BoxDecoration(
            color: context.cardColor,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(24),
            child: _buildCurrentQueueCard(booking, isDarkMode),
          ),
        ),
      ),
    );
  }

  Widget _buildNoQueueEncouragement(bool isDarkMode) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        color: context.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDarkMode ? Colors.grey.shade700 : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDarkMode ? 0.1 : 0.08),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(Icons.calendar_today, size: 48, color: colors().bluecolor1),
          const SizedBox(height: 16),
          Text(
            'No Active Booking',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: colors().bluecolor1,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Book an appointment to see your queue status here',
            style: TextStyle(
              color: context.subtextColor,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (context) => const BottomNav()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: colors().bluecolor1,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            child: const Text('Book Appointment'),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentQueueCard(dynamic queueData, bool isDarkMode) {
    // Handle both formats: old currentQueue format and new activeBookings format
    final queueNumber = queueData['number'] ?? queueData['queueNumber'] ?? 'N/A';
    final currentServing = queueData['currentServing'] ?? 0;
    final positionInQueue = queueData['positionInQueue'] ?? 0;
    final estimatedWait = queueData['estimatedWait'] ?? 0;
    
    // Show if patient is currently being served
    final isBeingServed = positionInQueue <= 0;
    final queueId = queueData['_id'] ?? queueData['queueId'];
    final clinicName = queueData['clinic']?['name'] ?? 'Unknown Clinic';
    final doctorName = queueData['doctor']?['name'] ?? 'Unknown Doctor';
    final doctorSpecialty = queueData['doctor']?['specialty'] ?? '';

    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      color: context.cardColor,
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            Text(
              'Current Booking',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: colors().bluecolor1,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              clinicName,
              style: TextStyle(
                fontSize: 16,
                color: context.subtextColor,
              ),
            ),
            if (queueData['patientName'] != null)
              Column(
                children: [
                  const SizedBox(height: 4),
                  Text(
                    'Patient: ${queueData['patientName']}',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.blue,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            if (doctorName.isNotEmpty)
              Column(
                children: [
                  const SizedBox(height: 4),
                  Text(
                    'Dr. $doctorName',
                    style: TextStyle(
                      fontSize: 14,
                      color: context.subtextColor,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            if (doctorSpecialty.isNotEmpty)
              Column(
                children: [
                  const SizedBox(height: 2),
                  Text(
                    doctorSpecialty,
                    style: TextStyle(
                      fontSize: 12,
                      color: context.subtextColor,
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 16),
            Text(
              '$queueNumber',
              style: TextStyle(
                fontSize: 64,
                fontWeight: FontWeight.bold,
                color: colors().bluecolor1,
              ),
            ),
            const SizedBox(height: 16),
            _buildStatusRow(
              'Currently Serving:',
              '$currentServing',
              _showUpdateIndicator ? Colors.green.shade700 : Colors.blue.shade800,
              isDarkMode,
              showIndicator: _showUpdateIndicator,
            ),
            _buildStatusRow(
              'Your Position:',
              isBeingServed ? 'Your turn!' : '$positionInQueue',
              isBeingServed
                  ? Colors.green.shade700
                  : Colors.orange.shade700,
              isDarkMode,
            ),
            _buildStatusRow(
              'Estimated Wait:',
              isBeingServed 
                  ? 'Please proceed' 
                  : queueData['estimatedWaitTime'] ?? '$estimatedWait minutes',
              isBeingServed
                  ? Colors.green.shade700
                  : Colors.orange.shade700,
              isDarkMode,
            ),
            if (queueData['estimatedWaitMinutes'] != null && !isBeingServed)
              _buildStatusRow(
                'Patients Ahead:',
                '${queueData['patientsAhead'] ?? positionInQueue}',
                Colors.blue.shade700,
                isDarkMode,
              ),
            if (isBeingServed)
              Container(
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.notifications_active, 
                         color: Colors.green.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'It\'s your turn! Please proceed to the doctor.',
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      await _loadCurrentQueueStatus();
                      // Restart real-time updates after refresh if we have an active booking
                      if (_queueData != null && _queueData!['currentQueue'] != null) {
                        final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
                        final clinicId = _queueData!['currentQueue']['clinic']['_id'];
                        final doctorId = _queueData!['currentQueue']['doctor']?['_id'];
                        clinicProvider.startListeningForUpdates(clinicId, doctorId: doctorId);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors().bluecolor1,
                      foregroundColor: Colors.white,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.refresh, size: 20),
                        const SizedBox(width: 8),
                        const Text('Refresh'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _cancelBooking(queueId),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cancel, size: 20),
                        const SizedBox(width: 8),
                        const Text('Cancel'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusRow(
    String label,
    String value,
    Color? valueColor,
    bool isDarkMode, {
    bool showIndicator = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: context.subtextColor,
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: valueColor,
                ),
              ),
              if (showIndicator) ...[
                SizedBox(width: 6),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                  ),
                ),
              ]
            ],
          ),
        ],
      ),
    );
  }

  // In status.dart - Update the _cancelBooking method
  Future<void> _cancelBooking(String queueId) async {
    bool confirmCancel = await showDialog(
      context: context,
      builder: (BuildContext context) {
        final themeProvider = Provider.of<ThemeProvider>(context);
        final isDarkMode = themeProvider.isDarkMode;

        return AlertDialog(
          backgroundColor: context.cardColor,
          title: Text(
            "Confirm Cancellation",
            style: TextStyle(
              color: context.textColor,
            ),
          ),
          content: Text(
            "Are you sure you want to cancel this booking?",
            style: TextStyle(
              color: context.subtextColor,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                "No",
                style: TextStyle(
                  color: context.subtextColor,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("Yes", style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );

    if (!confirmCancel) return;

    try {
      setState(() {
        _isLoading = true;
      });

      final success = await ClinicService.cancelBooking(queueId);

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking cancelled successfully')),
        );

        // Stop listening for updates since booking is cancelled
        final clinicProvider = Provider.of<ClinicProvider>(
          context,
          listen: false,
        );
        clinicProvider.stopListeningForUpdates();

        // Reload data after successful cancellation
        await _loadCurrentQueueStatus();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to cancel booking')),
        );
      }
    } catch (e) {
      String errorMessage = 'Failed to cancel booking';
      if (e.toString().contains('404')) {
        errorMessage = 'Booking not found or already processed';
      } else if (e.toString().contains('400')) {
        errorMessage = 'Cannot cancel already processed booking';
      } else if (e.toString().contains('401') || e.toString().contains('403')) {
        errorMessage = 'Authentication error - please login again';
      } else if (e.toString().contains('Doctor not available')) {
        errorMessage = 'Cannot cancel - doctor is not available';
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(errorMessage)));
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }


}
