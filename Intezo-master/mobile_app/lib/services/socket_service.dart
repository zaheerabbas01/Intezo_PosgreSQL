import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'event_bus.dart';

class SocketService {
  static SocketService? _instance;
  static SocketService get instance {
    _instance ??= SocketService._internal();
    return _instance!;
  }
  SocketService._internal();

  IO.Socket? _socket;
  bool isConnected = false;
  bool _isInitialized = false;
  String? _currentClinicId;
  String? _currentDoctorId;
  Function(String, String?)? _onFallbackToPolling;

  void setFallbackCallback(Function(String, String?) callback) {
    _onFallbackToPolling = callback;
  }

  Future<void> connect({String? clinicId, String? doctorId}) async {
    print('SocketService.connect called for clinic: $clinicId, doctor: $doctorId');
    
    if (isConnected && _socket != null) {
      print('Already connected, just switching room');
      if (clinicId != null) {
        await joinClinicRoom(clinicId, doctorId: doctorId);
      }
      return;
    }

    if (_isInitialized) {
      print('Already initializing, skipping');
      return;
    }
    
    print('Initializing new Socket.IO connection');
    _isInitialized = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      final serverUrl = 'http://192.168.100.69:3000';

      _socket = IO.io(serverUrl, <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': false,
        'auth': {
          'token': token,
        },
      });

      _socket!.onConnect((_) {
        print('Socket.IO connected');
        isConnected = true;
        if (clinicId != null) {
          print('Socket connected, joining room for clinic: $clinicId');
          joinClinicRoom(clinicId, doctorId: doctorId);
        }
      });

      _socket!.onDisconnect((_) {
        print('Socket.IO disconnected');
        print('🔴 Socket.IO disconnected: io client disconnect');
        isConnected = false;
      });

      _socket!.onConnectError((error) {
        print('Socket.IO connection error: $error');
        isConnected = false;
        if (clinicId != null && _onFallbackToPolling != null) {
          _onFallbackToPolling!(clinicId, doctorId);
        }
      });

      _socket!.onError((error) {
        print('Socket.IO error: $error');
        isConnected = false;
      });

      // Listen for queue updates
      _socket!.on('queue_updated', (data) {
        print('🔥 QUEUE UPDATE EVENT: $data');
        _handleSocketEvent('queue_updated', data);
      });
      
      // Listen for wait time updates
      _socket!.on('wait_time_updated', (data) {
        print('🔥 WAIT TIME UPDATE EVENT: $data');
        _handleSocketEvent('wait_time_updated', data);
      });

      // Listen for clinic status updates
      _socket!.on('clinic_status_changed', (data) {
        print('🔥 CLINIC STATUS UPDATE EVENT: $data');
        _handleSocketEvent('clinic_status_changed', data);
      });
      
      // Listen for clinic status updated (alternative event name)
      _socket!.on('clinic_status_updated', (data) {
        print('🔥 CLINIC STATUS UPDATED EVENT: $data');
        _handleSocketEvent('clinic_status_changed', data);
      });

      // Listen for doctor status updates
      _socket!.on('doctor_status_changed', (data) {
        print('🔥 DOCTOR STATUS UPDATE EVENT: $data');
        _handleSocketEvent('doctor_status_changed', data);
      });

      // Listen for patient served events
      _socket!.on('patient-served', (data) {
        print('🔥 PATIENT SERVED EVENT: $data');
        _handleSocketEvent('patient-served', data);
      });

      _socket!.connect();
      print('Socket.IO connection initiated');

    } catch (e) {
      print('Socket.IO connection error: $e');
      _isInitialized = false;
    }
  }

  void _handleSocketEvent(String eventName, dynamic data) {
    print('Processing Socket.IO event: $eventName for clinic: $_currentClinicId');
    
    try {
      // Handle different event types
      if (eventName == 'queue_updated' || eventName == 'wait_time_updated') {
        // Ensure we have all necessary wait time data
        final enrichedData = Map<String, dynamic>.from(data);
        
        // Add calculated wait time data if not present
        if (!enrichedData.containsKey('avgProcessTimeMinutes')) {
          enrichedData['avgProcessTimeMinutes'] = 15; // Default fallback
        }
        
        EventBus().emitQueueUpdate(QueueUpdateEvent(
          clinicId: _currentClinicId!,
          doctorId: _currentDoctorId,
          queueData: enrichedData,
        ));
      } else if (eventName == 'clinic_status_changed') {
        // Handle clinic status change for any clinic, not just current one
        final clinicId = data['clinicId'] ?? _currentClinicId;
        EventBus().emitClinicStatusUpdate(ClinicStatusUpdateEvent(
          clinicId: clinicId,
          statusData: {
            'isOpen': data['isOpen'],
            'lastStatusChange': data['lastStatusChange'],
          },
        ));
      } else if (eventName == 'doctor_status_changed') {
        EventBus().emitQueueUpdate(QueueUpdateEvent(
          clinicId: _currentClinicId!,
          doctorId: _currentDoctorId,
          queueData: data,
        ));
      } else if (eventName == 'patient-served') {
        EventBus().emitPatientServed(PatientServedEvent(
          patientId: data['patientId'],
          queueId: data['queueId'],
        ));
      }
      print('🔥 EVENT EMITTED TO UI!');
    } catch (e) {
      print('Error processing event data: $e');
    }
  }

  Future<void> joinClinicRoom(String clinicId, {String? doctorId}) async {
    if (_socket == null || !isConnected) {
      print('Socket not connected, using polling');
      if (_onFallbackToPolling != null) {
        _onFallbackToPolling!(clinicId, doctorId);
      }
      return;
    }

    try {
      // Leave previous rooms if switching
      if (_currentClinicId != null && _currentClinicId != clinicId) {
        print('Leaving previous clinic room: $_currentClinicId');
        _socket!.emit('leave_clinic', _currentClinicId);
      }
      
      if (_currentDoctorId != null && _currentDoctorId != doctorId) {
        print('Leaving previous doctor room: $_currentDoctorId');
        _socket!.emit('leave_doctor', _currentDoctorId);
      }
      
      // Join new clinic room
      print('Joined clinic room: $clinicId');
      _socket!.emit('join_clinic', clinicId);
      
      // Join doctor room if specified
      if (doctorId != null) {
        print('Joined doctor room: $doctorId');
        _socket!.emit('join_doctor', doctorId);
      }
      
      // Join patient room for real-time updates
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patientId');
      if (patientId != null) {
        print('Joined patient room: $patientId');
        _socket!.emit('join_patient', patientId);
      }
      
      _currentClinicId = clinicId;
      _currentDoctorId = doctorId;
      print('Successfully joined all rooms for clinic: $clinicId, doctor: $doctorId');

    } catch (e) {
      print('Error joining room: $e');
      if (_onFallbackToPolling != null) {
        _onFallbackToPolling!(clinicId, doctorId);
      }
    }
  }

  Future<void> disconnect() async {
    if (_socket != null) {
      print('🔴 Socket.IO disconnected: io client disconnect');
      // Rooms are automatically cleaned up on disconnect
      _socket!.disconnect();
      _socket!.dispose();
    }
    _currentClinicId = null;
    _currentDoctorId = null;
    isConnected = false;
    _isInitialized = false;
  }

  bool get isActive {
    final active = isConnected && _currentClinicId != null;
    print('Socket.IO isActive check: connected=$isConnected, clinic=$_currentClinicId, active=$active');
    return active;
  }
}