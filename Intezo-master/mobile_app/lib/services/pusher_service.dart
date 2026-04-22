import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'event_bus.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  String? _clinicId;
  String? _token;
  bool _isConnected = false;

  Future<void> connect(String clinicId, String token) async {
    if (_clinicId == clinicId && _socket != null && _isConnected) return;
    
    await disconnect();
    _clinicId = clinicId;
    _token = token;
    
    try {
      _socket = IO.io('http://192.168.100.69:3000', 
        IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)
          .setAuth({'token': token})
          .build()
      );
      
      _socket!.onConnect((_) {
        print('Socket.IO connected for clinic: $clinicId');
        _isConnected = true;
        _socket!.emit('join_clinic', clinicId);
      });
      
      _socket!.onDisconnect((_) {
        print('Socket.IO disconnected');
        _isConnected = false;
      });
      
      _socket!.onConnectError((error) {
        print('Socket.IO connection error: $error');
        _isConnected = false;
      });
      
      // Listen to real-time events
      _socket!.on('queue_updated', (data) => _handleQueueUpdate(data));
      _socket!.on('doctor_status_changed', (data) => _handleDoctorStatusUpdate(data));
      _socket!.on('patient_update', (data) => _handlePatientUpdate(data));
      _socket!.on('system_notification', (data) => _handleSystemNotification(data));
      
      _socket!.connect();
    } catch (e) {
      print('Socket.IO connection failed: $e');
      _isConnected = false;
    }
  }

  void _handleQueueUpdate(dynamic data) {
    EventBus().emitQueueUpdate(QueueUpdateEvent(
      clinicId: data['clinicId'],
      queueData: data,
    ));
  }

  void _handleDoctorStatusUpdate(dynamic data) {
    EventBus().emitDoctorAvailabilityUpdate(
      DoctorAvailabilityUpdateEvent(
        clinicId: data['clinicId'],
        doctorId: data['doctorId'],
        doctorName: data['doctorName'],
        isAvailable: data['isAvailable'],
        lastStatusChange: data['lastStatusChange'],
      ),
    );
  }

  void _handlePatientUpdate(dynamic data) {
    EventBus().emitPatientUpdate(PatientUpdateEvent(
      patientId: data['patientId'],
      updateData: data,
    ));
  }

  void _handleSystemNotification(dynamic data) {
    EventBus().emitSystemNotification(SystemNotificationEvent(
      type: data['type'],
      message: data['message'],
      data: data,
    ));
  }

  void joinDoctor(String doctorId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('join_doctor', doctorId);
    }
  }

  void emitQueueUpdate(Map<String, dynamic> data) {
    if (_socket != null && _isConnected) {
      _socket!.emit('queue_update', data);
    }
  }

  void emitDoctorStatus(Map<String, dynamic> data) {
    if (_socket != null && _isConnected) {
      _socket!.emit('doctor_status', data);
    }
  }

  bool get isConnected => _isConnected;

  Future<void> disconnect() async {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _isConnected = false;
    _clinicId = null;
    _token = null;
  }
}