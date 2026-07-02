import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'api_service.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationTap,
      onDidReceiveBackgroundNotificationResponse: _onNotificationTap,
    );

    await _createNotificationChannels();
    await _requestPermissions();
  }

  Future<void> _createNotificationChannels() async {
    const AndroidNotificationChannel queueChannel = AndroidNotificationChannel(
      'queue_channel',
      'Queue Notifications',
      description: 'Notifications for queue updates',
      importance: Importance.high,
    );

    const AndroidNotificationChannel clinicChannel = AndroidNotificationChannel(
      'clinic_channel',
      'Clinic Notifications',
      description: 'Notifications for clinic status',
      importance: Importance.high,
    );

    const AndroidNotificationChannel doctorChannel = AndroidNotificationChannel(
      'doctor_channel',
      'Doctor Notifications',
      description: 'Notifications for doctor availability',
      importance: Importance.high,
    );

    const AndroidNotificationChannel highImportanceChannel =
        AndroidNotificationChannel(
          'high_importance_channel',
          'High Importance Notifications',
          description: 'High priority notifications',
          importance: Importance.high,
        );

    await _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(queueChannel);
    await _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(clinicChannel);
    await _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(doctorChannel);
    await _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(highImportanceChannel);
  }

  static void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      _handleNotificationTap(payload);
    }
  }

  static void _handleNotificationTap(String payload) {
    if (payload.startsWith('clinic:')) {
      final clinicId = payload.split(':')[1];
      print('Navigate to clinic: $clinicId');
      // Add navigation logic here
    } else if (payload.startsWith('doctor:')) {
      final doctorId = payload.split(':')[1];
      print('Navigate to doctor: $doctorId');
      // Add navigation logic here
    } else if (payload == 'status') {
      print('Navigate to status page');
      // Add navigation logic here
    }
  }

  Future<void> _requestPermissions() async {
    await Permission.notification.request();
  }

  Future<void> showQueueNotification(
    int currentNumber,
    int patientNumber,
    String clinicName,
    String doctorName,
  ) async {
    final remaining = patientNumber - currentNumber;
    final body =
        'At $clinicName with Dr. $doctorName\nCurrently serving: $currentNumber\nYour number: $patientNumber\n$remaining patients ahead of you';

    const androidDetails = AndroidNotificationDetails(
      'queue_channel',
      'Queue Notifications',
      channelDescription: 'Notifications for queue updates',
      importance: Importance.high,
      priority: Priority.high,
      styleInformation: BigTextStyleInformation(''),
      enableVibration: true,
      playSound: true,
      autoCancel: false,
      ongoing: false,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      1,
      'Your Turn is Coming Soon!',
      body,
      notificationDetails,
      payload: 'status',
    );
  }

  Future<void> showClinicOpenNotification(
    String clinicName,
    String clinicId,
  ) async {
    const androidDetails = AndroidNotificationDetails(
      'clinic_channel',
      'Clinic Notifications',
      channelDescription: 'Notifications for clinic status',
      importance: Importance.high,
      priority: Priority.high,
    );

    const notificationDetails = NotificationDetails(android: androidDetails);

    await _notifications.show(
      2,
      'Clinic Now Open!',
      '$clinicName is now open for appointments\nTap to visit clinic',
      notificationDetails,
      payload: 'clinic:$clinicId',
    );
  }

  Future<void> showDoctorAvailableNotification(
    String doctorName,
    String clinicName,
    String doctorId,
  ) async {
    const androidDetails = AndroidNotificationDetails(
      'doctor_channel',
      'Doctor Notifications',
      channelDescription: 'Notifications for doctor availability',
      importance: Importance.high,
      priority: Priority.high,
    );

    const notificationDetails = NotificationDetails(android: androidDetails);

    await _notifications.show(
      3,
      'Doctor Now Available!',
      'Dr. $doctorName is now available at $clinicName\nTap to view doctor details',
      notificationDetails,
      payload: 'doctor:$doctorId',
    );
  }

  Future<void> showPatientServedNotification(
    String clinicName,
    String doctorName,
  ) async {
    const androidDetails = AndroidNotificationDetails(
      'queue_channel',
      'Queue Notifications',
      channelDescription: 'Notifications for queue updates',
      importance: Importance.high,
      priority: Priority.high,
      styleInformation: BigTextStyleInformation(''),
      enableVibration: true,
      playSound: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      4,
      'Thank You for Using Our Services!',
      'Your consultation with Dr. $doctorName at $clinicName is complete. We hope you had a great experience!',
      notificationDetails,
      payload: 'status',
    );
  }

  // Notification preferences
  Future<void> addClinicNotification(String clinicId, String clinicName) async {
    final prefs = await SharedPreferences.getInstance();
    final notifications = prefs.getStringList('clinic_notifications') ?? [];
    final notificationData = json.encode({'id': clinicId, 'name': clinicName});

    if (!notifications.contains(notificationData)) {
      notifications.add(notificationData);
      await prefs.setStringList('clinic_notifications', notifications);
    }
  }

  Future<void> removeClinicNotification(String clinicId) async {
    final prefs = await SharedPreferences.getInstance();
    final notifications = prefs.getStringList('clinic_notifications') ?? [];
    notifications.removeWhere((n) => json.decode(n)['id'] == clinicId);
    await prefs.setStringList('clinic_notifications', notifications);
  }

  Future<void> addDoctorNotification(String doctorId, String doctorName) async {
    final prefs = await SharedPreferences.getInstance();
    final notifications = prefs.getStringList('doctor_notifications') ?? [];
    final notificationData = json.encode({'id': doctorId, 'name': doctorName});

    if (!notifications.contains(notificationData)) {
      notifications.add(notificationData);
      await prefs.setStringList('doctor_notifications', notifications);
    }
  }

  Future<void> removeDoctorNotification(String doctorId) async {
    final prefs = await SharedPreferences.getInstance();
    final notifications = prefs.getStringList('doctor_notifications') ?? [];
    notifications.removeWhere((n) => json.decode(n)['id'] == doctorId);
    await prefs.setStringList('doctor_notifications', notifications);
  }

  Future<bool> isClinicNotificationEnabled(String clinicId) async {
    final prefs = await SharedPreferences.getInstance();
    final notifications = prefs.getStringList('clinic_notifications') ?? [];
    return notifications.any((n) => json.decode(n)['id'] == clinicId);
  }

  Future<bool> isDoctorNotificationEnabled(String doctorId) async {
    final prefs = await SharedPreferences.getInstance();
    final notifications = prefs.getStringList('doctor_notifications') ?? [];
    return notifications.any((n) => json.decode(n)['id'] == doctorId);
  }

  // Enhanced methods that sync with backend.
  // Returns true only when the backend confirms the change, so callers can
  // give honest feedback. Local preference is kept in sync with the server.
  Future<bool> addClinicNotificationWithSync(
    String clinicId,
    String clinicName,
  ) async {
    final synced = await ApiService.enableClinicNotification(clinicId);
    if (synced) {
      await addClinicNotification(clinicId, clinicName);
    }
    return synced;
  }

  Future<bool> removeClinicNotificationWithSync(String clinicId) async {
    final synced = await ApiService.disableClinicNotification(clinicId);
    if (synced) {
      await removeClinicNotification(clinicId);
    }
    return synced;
  }

  Future<bool> addDoctorNotificationWithSync(
    String doctorId,
    String doctorName,
  ) async {
    final synced = await ApiService.enableDoctorNotification(doctorId);
    if (synced) {
      await addDoctorNotification(doctorId, doctorName);
    }
    return synced;
  }

  Future<bool> removeDoctorNotificationWithSync(String doctorId) async {
    final synced = await ApiService.disableDoctorNotification(doctorId);
    if (synced) {
      await removeDoctorNotification(doctorId);
    }
    return synced;
  }
}
