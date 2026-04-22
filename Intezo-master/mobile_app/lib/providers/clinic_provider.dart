// lib/providers/clinic_provider.dart
import 'dart:async';

import 'package:flutter/foundation.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../services/clinic_service.dart';
import '../services/event_bus.dart';

class ClinicProvider with ChangeNotifier {
  bool _isLoading = false;
  List<Map<String, dynamic>> _clinics = [];
  Map<String, dynamic>? _selectedClinic;
  Map<String, dynamic>? _currentQueue;
  String? _error;

  bool get isLoading => _isLoading;
  List<Map<String, dynamic>> get clinics => _clinics;
  Map<String, dynamic>? get selectedClinic => _selectedClinic;
  Map<String, dynamic>? get currentQueue => _currentQueue;
  String? get error => _error;

  Future<void> loadClinics({bool forceRefresh = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ClinicService.getClinics(forceRefresh: forceRefresh);
      _clinics = List<Map<String, dynamic>>.from(response);
      
      // Setup clinic status listener (safe to call multiple times)
      _setupClinicStatusListener();
      
      // Only connect socket if not already connected
      if (!SocketService.instance.isConnected) {
        await SocketService.instance.connect();
      }
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> selectClinic(Map<String, dynamic> clinic) async {
    _selectedClinic = clinic;
    notifyListeners();

    // Load clinic status and queue
    await loadClinicStatus(clinic['_id']);
    await loadCurrentQueue(clinic['_id']);
  }

  Future<void> loadClinicStatus(String clinicId) async {
    try {
      final status = await ClinicService.getClinicStatus(clinicId);

      // Update clinic with status
      final index = _clinics.indexWhere((c) => c['_id'] == clinicId);
      if (index != -1) {
        // Create a new map with the merged data
        final updatedClinic = Map<String, dynamic>.from(_clinics[index]);
        updatedClinic.addAll(Map<String, dynamic>.from(status));
        _clinics[index] = updatedClinic;
        notifyListeners();
      }

      // Also update selected clinic if it's the same
      if (_selectedClinic != null && _selectedClinic!['_id'] == clinicId) {
        _selectedClinic = {..._selectedClinic!, ...status};
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

// In clinic_provider.dart - Update loadCurrentQueue method
// In clinic_provider.dart - Update loadCurrentQueue method
// lib/providers/clinic_provider.dart - Update loadCurrentQueue method
  Future<void> loadCurrentQueue(String clinicId, {bool forceRefresh = false, String? doctorId}) async {
    if (!forceRefresh && _currentQueue != null) {
      // Check if data is fresh (less than 30 seconds old)
      final lastUpdated = _currentQueue?['_lastUpdated'];
      if (lastUpdated != null) {
        final lastUpdateTime = DateTime.parse(lastUpdated);
        if (DateTime.now().difference(lastUpdateTime).inSeconds < 30) {
          return; // Data is fresh, no need to reload
        }
      }
    }

    try {
      final response = await ClinicService.getRealTimeQueue(clinicId, doctorId: doctorId);

      // Always create a valid queue data structure even if response is empty
      _currentQueue = {
        'current': response['current'] ?? 0,
        'nextNumber': (response['current'] ?? 0) + 1,
        'upcoming': response['upcoming'] ?? [],
        'totalWaiting': response['totalWaiting'] ?? 0,
        'avgWaitTime': response['avgWaitTime'] ?? 15,
        'canCallNext': response['canCallNext'] ?? false,
        '_lastUpdated': DateTime.now().toIso8601String(),
        'isDoctorQueue': doctorId != null // Add flag to identify doctor-specific queue
      };

      notifyListeners();
    } catch (e) {
      print('Error loading current queue: $e');
      // Set default queue data instead of showing error
      _currentQueue = {
        'current': 0,
        'nextNumber': 1,
        'upcoming': [],
        'totalWaiting': 0,
        'avgWaitTime': 15,
        'canCallNext': false,
        '_lastUpdated': DateTime.now().toIso8601String(),
        'isDoctorQueue': doctorId != null
      };
      notifyListeners();
    }
  }

// lib/services/clinic_service.dart - Update the bookQueueNumber method
// Update the bookQueueNumber method
  Future<Map<String, dynamic>> bookQueueNumber(String clinicId, String patientId, {String? doctorId, String? patientName}) async {
    try {
      if (doctorId == null) {
        throw Exception('Doctor ID is required for booking');
      }

      final result = await ClinicService.bookQueueNumber(clinicId, patientId, doctorId: doctorId, patientName: patientName);

      // Handle the new response format from backend
      if (result.containsKey('error')) {
        throw Exception(result['error']);
      }

      return result;
    } catch (e) {
      print('Booking error in provider: $e');
      throw Exception('Failed to book queue number: $e');
    }
  }

// Update getDoctors method
  Future<List<Map<String, dynamic>>> getDoctors(String clinicId) async {
    try {
      print('ClinicProvider: Getting doctors for clinic $clinicId');
      final doctors = await ClinicService.getDoctors(clinicId);
      print('ClinicProvider: Received ${doctors.length} doctors');
      
      if (doctors.isEmpty) {
        print('ClinicProvider: No doctors found for clinic $clinicId');
        _error = 'No doctors available at this clinic';
        notifyListeners();
      } else {
        _error = null;
        notifyListeners();
      }
      
      return doctors;
    } catch (e) {
      print('ClinicProvider: Error getting doctors: $e');
      _error = 'Failed to load doctors: $e';
      notifyListeners();
      throw e; // Re-throw to let the UI handle it
    }
  }


  // ADD THIS METHOD - to get queue status
  Future<Map<String, dynamic>?> getQueueStatus(String queueId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ClinicService.getQueueStatus(queueId);
      _isLoading = false;
      notifyListeners();
      // FIX: Handle null response
      return response != null ? Map<String, dynamic>.from(response) : null;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  // ADD THIS METHOD - to get patient's current queue
// In clinic_provider.dart - Update getPatientCurrentQueue method
  Future<Map<String, dynamic>?> getPatientCurrentQueue() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ApiService.get('patients/queue-status');
      print('Patient queue status response: $response');

      if (response != null && response is Map<String, dynamic>) {
        // Check if patient was served and clear the booking
        if (response['currentQueue'] != null &&
            response['currentQueue']['status'] == 'served') {
          // Patient was served, emit event for real-time updates
          // EventBus().emitPatientServed(PatientServedEvent(
          //   patientId: response['currentQueue']['_id'],
          //   bookingData: response['currentQueue']
          // ));
          _isLoading = false;
          notifyListeners();
          return {'currentQueue': null, 'message': 'Patient has been served'};
        }
        
        // Return the response as-is, let the UI handle the logic
        _isLoading = false;
        notifyListeners();
        return response;
      }

      _isLoading = false;
      notifyListeners();
      return null;
    } catch (e) {
      print('Error getting patient queue: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  // Use main.dart SocketService instead
  // final SocketService _socketService = SocketService.instance;
  String? _currentListeningClinicId;
  Timer? _pollingTimer;

  void startListeningForUpdates(String clinicId, {String? doctorId}) {
    // Check if we're already listening to the same clinic and doctor
    if (_currentListeningClinicId == clinicId && 
        _queueUpdateSubscription != null && 
        !_queueUpdateSubscription!.isPaused) {
      print('Already listening for updates on clinic $clinicId, doctor: $doctorId');
      return;
    }
    
    stopListeningForUpdates();
    stopPolling();

    _currentListeningClinicId = clinicId;

    _connectToSocket(clinicId, doctorId: doctorId);

      // Listen to event bus for queue updates
      _queueUpdateSubscription = EventBus().onQueueUpdate.listen((event) {
        // Accept updates for the same clinic and doctor, or general clinic updates
        final isRelevantUpdate = event.clinicId == clinicId && 
            (event.doctorId == doctorId || event.doctorId == null);
            
        if (isRelevantUpdate) {
          print('Real-time queue update received for clinic $clinicId, doctor: $doctorId: ${event.queueData}');

          _currentQueue = {
            'current': event.queueData['currentNumber'] ?? event.queueData['current'] ?? 0,
            'nextNumber': (event.queueData['currentNumber'] ?? event.queueData['current'] ?? 0) + 1,
            'upcoming': event.queueData['upcoming'] ?? [],
            'totalWaiting': event.queueData['totalWaiting'] ?? 0,
            'avgWaitTime': event.queueData['avgWaitTime'] ?? 15,
            'canCallNext': event.queueData['canCallNext'] ?? false,
            '_lastUpdated': DateTime.now().toIso8601String(),
            'isDoctorQueue': doctorId != null
          };

          notifyListeners();
        }
      });

      // Listen to clinic status updates
      _clinicStatusSubscription = EventBus().onClinicStatusUpdate.listen((event) {
        print('Real-time clinic status update received for clinic ${event.clinicId}');

        // Invalidate cache to force fresh data
        ClinicService.invalidateClinicStatusCache(event.clinicId);

        // Update clinic status in the list
        final index = _clinics.indexWhere((c) => c['_id'] == event.clinicId);
        if (index != -1) {
          _clinics[index]['isOpen'] = event.statusData['isOpen'];
          _clinics[index]['lastStatusChange'] = event.statusData['lastStatusChange'];
          notifyListeners();
        }

        // Update selected clinic if it's the same
        if (_selectedClinic != null && _selectedClinic!['_id'] == event.clinicId) {
          _selectedClinic = {
            ..._selectedClinic!,
            'isOpen': event.statusData['isOpen'],
            'lastStatusChange': event.statusData['lastStatusChange']
          };
          notifyListeners();
        }
      });

      // Listen to doctor availability updates
      _doctorAvailabilitySubscription = EventBus().onDoctorAvailabilityUpdate.listen((event) {
        if (event.clinicId == clinicId) {
          print('Real-time doctor availability update received: ${event.doctorName} - ${event.isAvailable}');
          notifyListeners();
        }
      });
  }

  void startPollingForUpdates(String clinicId, {String? doctorId}) {
    // Fallback polling only when Socket.IO fails
    print('Starting fallback polling for clinic: $clinicId, doctor: $doctorId');
    
    _pollingTimer = Timer.periodic(Duration(seconds: 10), (timer) async {
      if (_currentListeningClinicId == clinicId) {
        try {
          await loadCurrentQueue(clinicId, forceRefresh: true, doctorId: doctorId);
        } catch (e) {
          print('Polling error: $e');
        }
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _connectToSocket(String clinicId, {String? doctorId}) async {
    try {
      // Only connect if not already connected, otherwise just join rooms
      if (!SocketService.instance.isConnected) {
        await SocketService.instance.connect(clinicId: clinicId, doctorId: doctorId);
      } else {
        // Already connected, just join the rooms
        await SocketService.instance.joinClinicRoom(clinicId, doctorId: doctorId);
      }
      print('Socket.IO connection established for clinic: $clinicId${doctorId != null ? ', doctor: $doctorId' : ''}');
    } catch (e) {
      print('Socket.IO connection failed: $e');
    }
  }

  void stopListeningForUpdates() {
    // Don't disconnect socket - just clean up subscriptions
    _currentListeningClinicId = null;
    _queueUpdateSubscription?.cancel();
    _clinicStatusSubscription?.cancel();
    _doctorAvailabilitySubscription?.cancel();
  }

  void clearSpecificError(String errorPattern) {
    if (_error != null && _error!.contains(errorPattern)) {
      _error = null;
      notifyListeners();
    }
  }

// Add these class variables
  StreamSubscription? _queueUpdateSubscription;
  StreamSubscription? _clinicStatusSubscription;
  StreamSubscription? _doctorAvailabilitySubscription;

  @override
  void dispose() {
    stopListeningForUpdates();
    stopPolling();
    _queueUpdateSubscription?.cancel();
    _clinicStatusSubscription?.cancel();
    _doctorAvailabilitySubscription?.cancel();
    // Don't disconnect socket in dispose - let it be managed globally
    super.dispose();
  }

  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  void startPollingForClinicUpdates() {
    // Polling disabled to prevent screen flickering
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void clearData() {
    stopListeningForUpdates();
    stopPolling();
    _clinics.clear();
    _selectedClinic = null;
    _currentQueue = null;
    _error = null;
    _isLoading = false;
    _currentListeningClinicId = null;
    // Socket remains connected for global events
    notifyListeners();
  }

  void retryLoading() {
    loadClinics();
  }
  
  void _setupClinicStatusListener() {
    EventBus().onClinicStatusUpdate.listen((event) {
      print('Real-time clinic status update received for clinic ${event.clinicId}');
      
      // Invalidate cache to ensure fresh data on next load
      ClinicService.invalidateClinicStatusCache(event.clinicId);
      
      // Update clinic status in the list
      final index = _clinics.indexWhere((c) => c['_id'] == event.clinicId);
      if (index != -1) {
        _clinics[index]['isOpen'] = event.statusData['isOpen'];
        _clinics[index]['lastStatusChange'] = event.statusData['lastStatusChange'];
        notifyListeners();
      }
    });
  }

  Future<void> markClinicAsVisited(String clinicId) async {
    try {
      // Update the clinic as visited in the local list
      final index = _clinics.indexWhere((c) => c['_id'] == clinicId);
      if (index != -1) {
        _clinics[index]['lastVisited'] = DateTime.now().toIso8601String();
        notifyListeners();
      }
    } catch (e) {
      print('Error marking clinic as visited: $e');
    }
  }
  
  // Force refresh all clinic data (call when app becomes active)
  Future<void> forceRefreshClinics() async {
    try {
      // Clear cache first
      await ClinicService.clearCache();
      
      // Reload clinics with fresh data without disconnecting socket
      await loadClinics(forceRefresh: true);
      
      print('Clinics force refreshed successfully');
    } catch (e) {
      print('Error force refreshing clinics: $e');
    }
  }
}