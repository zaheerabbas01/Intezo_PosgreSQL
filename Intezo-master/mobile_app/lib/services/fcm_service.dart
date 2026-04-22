import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'notification_service.dart';
import 'api_service.dart';

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  Future<void> initialize() async {
    print('🚀 FCM Service initializing...');
    
    try {
      NotificationSettings settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
        criticalAlert: false,
      );
      
      print('🔔 FCM Permission status: ${settings.authorizationStatus}');
      
      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        print('✅ User granted permission');
      } else if (settings.authorizationStatus == AuthorizationStatus.provisional) {
        print('✅ User granted provisional permission');
      } else {
        print('❌ User declined permission');
        return;
      }

      print('🔄 Setting up token refresh listener...');
      _messaging.onTokenRefresh.listen((newToken) {
        print('🔄 FCM token refreshed: ${newToken.substring(0, 20)}...');
        _saveTokenToServer(newToken);
      });

      print('📱 Setting up message listeners...');
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print('📱 Foreground message received: ${message.notification?.title}');
        _handleForegroundMessage(message);
      });

      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        print('📱 App opened from notification: ${message.notification?.title}');
        _handleNotificationTap(message);
      });
      
      // Handle notification when app is launched from terminated state
      RemoteMessage? initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        print('📱 App launched from notification: ${initialMessage.notification?.title}');
        _handleNotificationTap(initialMessage);
      }
      
      print('✅ FCM Service initialized successfully');
    } catch (e) {
      print('❌ FCM Service initialization failed: $e');
      rethrow;
    }
  }

  Future<void> _saveTokenToServer(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jwtToken = prefs.getString('token');
      final patientId = prefs.getString('patientId');
      
      print('🔍 FCM Registration Debug:');
      print('  - Patient ID: $patientId');
      print('  - JWT Token exists: ${jwtToken != null && jwtToken.isNotEmpty}');
      print('  - FCM Token: ${token.substring(0, 20)}...');
      
      if (jwtToken != null && jwtToken.isNotEmpty) {
        print('📱 Saving FCM token to server: ${token.substring(0, 20)}...');
        
        final response = await ApiService.put('patients/fcm-token', {
          'fcmToken': token,
        });
        
        print('✅ FCM token saved successfully for patient $patientId');
      } else {
        print('❌ No JWT token found, cannot save FCM token');
        // Store the token locally to save later after login
        await prefs.setString('pending_fcm_token', token);
        print('💾 FCM token stored locally for later registration');
      }
    } catch (e) {
      print('❌ Error saving FCM token: $e');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];
    
    if (type == 'clinic_open') {
      NotificationService().showClinicOpenNotification(
        data['clinicName'] ?? 'Clinic',
        data['clinicId'] ?? '',
      );
      // Remove notification preference after showing
      NotificationService().removeClinicNotification(data['clinicId'] ?? '');
    } else if (type == 'doctor_available') {
      NotificationService().showDoctorAvailableNotification(
        data['doctorName'] ?? 'Doctor',
        data['clinicName'] ?? 'Clinic',
        data['doctorId'] ?? '',
      );
      // Remove notification preference after showing
      NotificationService().removeDoctorNotification(data['doctorId'] ?? '');
    } else if (type == 'queue_update') {
      NotificationService().showQueueNotification(
        int.parse(data['currentNumber'] ?? '0'),
        int.parse(data['patientNumber'] ?? '0'),
        data['clinicName'] ?? 'Clinic',
        data['doctorName'] ?? 'Doctor',
      );
    } else if (type == 'patient_served') {
      NotificationService().showPatientServedNotification(
        data['clinicName'] ?? 'Clinic',
        data['doctorName'] ?? 'Doctor',
      );
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];
    
    if (type == 'clinic_open') {
      _navigateToClinic(data['clinicId'] ?? '');
    } else if (type == 'doctor_available') {
      _navigateToDoctor(data['doctorId'] ?? '', data['clinicId'] ?? '');
    } else if (type == 'queue_update') {
      _navigateToStatus();
    } else if (type == 'patient_served') {
      _navigateToStatus();
    }
  }
  
  void _navigateToClinic(String clinicId) {
    // Navigate to clinic page - implement based on your routing
    print('Navigate to clinic: $clinicId');
  }
  
  void _navigateToDoctor(String doctorId, String clinicId) {
    // Navigate to doctor page - implement based on your routing
    print('Navigate to doctor: $doctorId in clinic: $clinicId');
  }
  
  void _navigateToStatus() {
    // Navigate to status page - implement based on your routing
    print('Navigate to status page');
  }

  // Manual method to register FCM token for existing users
  Future<void> registerToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jwtToken = prefs.getString('token');
      
      // Only proceed if user is logged in
      if (jwtToken == null || jwtToken.isEmpty) {
        print('❌ No JWT token found, skipping FCM token registration');
        return;
      }
      
      // First try to get current token
      String? token = await _messaging.getToken();
      
      // If no current token, try to get pending token
      if (token == null) {
        token = prefs.getString('pending_fcm_token');
      }
      
      if (token != null) {
        print('📱 Registering FCM token for logged in user: ${token.substring(0, 20)}...');
        await _saveTokenToServer(token);
        // Clear pending token after successful registration
        await prefs.remove('pending_fcm_token');
      } else {
        print('❌ No FCM token available to register');
      }
    } catch (e) {
      print('❌ Error manually registering FCM token: $e');
    }
  }
}