// lib/main.dart - Updated for doctor-specific queues
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'fronted/view/bottom_navigator.dart';
import 'fronted/view/homescreen.dart';
import 'fronted/view/auth/login_screen.dart';
import 'fronted/view/splash_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/clinic_provider.dart';
import 'providers/patient_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/offline_provider.dart';
import 'services/event_bus.dart';
import 'services/preload_service.dart';
import 'services/app_lifecycle_service.dart';
import 'services/notification_service.dart';
import 'services/fcm_service.dart';
import 'services/update_service.dart';
import 'fronted/widgets/update_dialog.dart';
import 'config/api_config.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await NotificationService().initialize();
  await FCMService().initialize();
  
  // Initialize flutter_downloader
  await FlutterDownloader.initialize(
    debug: false,
    ignoreSsl: true,
  );
  
  runApp(const MyApp());
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  print('Background message received: ${message.notification?.title}');
  
  final FlutterLocalNotificationsPlugin notifications = FlutterLocalNotificationsPlugin();
  
  const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
  const InitializationSettings settings = InitializationSettings(android: androidSettings);
  await notifications.initialize(settings);
  
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'high_importance_channel',
    'High Importance Notifications',
    importance: Importance.high,
  );
  
  await notifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);
  
  const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
    'high_importance_channel',
    'High Importance Notifications',
    importance: Importance.high,
    priority: Priority.high,
  );
  
  const NotificationDetails notificationDetails = NotificationDetails(android: androidDetails);
  
  await notifications.show(
    DateTime.now().millisecondsSinceEpoch ~/ 1000,
    message.notification?.title ?? 'New Notification',
    message.notification?.body ?? 'You have a new message',
    notificationDetails,
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ClinicProvider()),
        ChangeNotifierProvider(create: (_) => PatientProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => OfflineProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'Intezo',
            debugShowCheckedModeBanner: false,
            theme: themeProvider.themeData,
            home: const SplashScreen(),
          );
        },
      ),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isCheckingAuth = true;

  @override
  void initState() {
    super.initState();
    // Initialize app lifecycle service
    WidgetsBinding.instance.addPostFrameCallback((_) {
      AppLifecycleService.instance.initialize(context);
      _checkAuthStatus();
      _checkForUpdates();
    });
  }

  Future<void> _checkAuthStatus() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
    final patientProvider = Provider.of<PatientProvider>(context, listen: false);

    // Clear old data from all providers first
    clinicProvider.clearData();
    patientProvider.clearData();

    await authProvider.checkLoginStatus();

    // Force refresh data on app start if logged in
    if (authProvider.isLoggedIn) {
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patientId');
      if (patientId != null) {
        await clinicProvider.forceRefreshClinics();
        await patientProvider.forceRefreshProfile();
        
        // Register FCM token for existing users after a delay
        Future.delayed(const Duration(seconds: 2), () async {
          try {
            print('📱 Manually registering FCM token for existing user...');
            await FCMService().registerToken();
            print('✅ FCM token registered for existing user');
          } catch (e) {
            print('❌ FCM token registration failed: $e');
          }
        });
      }
    }

    setState(() {
      _isCheckingAuth = false;
    });
  }

  Future<void> _checkForUpdates() async {
    print('🚀 Starting update check...');
    final updateService = UpdateService();
    final updateInfo = await updateService.checkForUpdate();
    
    print('Update info result: $updateInfo');
    
    if (updateInfo != null && mounted) {
      print('📦 Showing update dialog');
      showUpdateDialog(context, updateInfo);
    } else {
      print('ℹ️ No update dialog shown - updateInfo: $updateInfo, mounted: $mounted');
    }
  }

  @override
  void dispose() {
    AppLifecycleService.instance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    if (_isCheckingAuth) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (authProvider.isLoggedIn) {
      return const BottomNav();
    } else {
      return const LoginScreen();
    }
  }
}

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
    
    if (_isInitialized && isConnected) {
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
      // Use the same base URL configuration but for socket connection
      final serverUrl = ApiConfig.useCloudflare 
          ? 'https://api.intezo.online' 
          : 'http://192.168.100.69:3000';

      _socket = IO.io(serverUrl, {
        'transports': ['websocket', 'polling'],
        'autoConnect': true,
        'forceNew': true,
        'auth': {
          'token': token,
        },
      });

      _socket!.onConnect((_) {
        print('🔥 Socket.IO connected successfully');
        isConnected = true;
        if (clinicId != null) {
          print('🔥 Socket connected, joining room for clinic: $clinicId, doctor: $doctorId');
          joinClinicRoom(clinicId, doctorId: doctorId);
        }
      });

      _socket!.onDisconnect((_) {
        print('Socket.IO disconnected');
        isConnected = false;
      });

      _socket!.onConnectError((error) {
        print('🔴 Socket.IO connection error: $error');
        isConnected = false;
      });

      _socket!.onError((error) {
        print('🔴 Socket.IO error: $error');
        isConnected = false;
      });
      
      // Add connection timeout
      _socket!.on('connect_error', (error) {
        print('🔴 Socket.IO connect_error: $error');
      });
      
      _socket!.on('disconnect', (reason) {
        print('🔴 Socket.IO disconnected: $reason');
        isConnected = false;
      });

      // Listen for queue updates (matches backend event name)
      _socket!.on('queue_updated', (data) {
        print('🔥 QUEUE UPDATE EVENT: $data');
        _handleSocketEvent('queue_updated', data);
      });

      // Listen for clinic status updates
      _socket!.on('clinic_status_updated', (data) {
        print('🔥 CLINIC STATUS UPDATE EVENT: $data');
        _handleSocketEvent('clinic_status_updated', data);
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
      
      // Listen for booking history updates
      _socket!.on('booking_history_updated', (data) {
        print('🔥 BOOKING HISTORY UPDATE EVENT: $data');
        _handleSocketEvent('booking_history_updated', data);
      });

      // Connection will auto-start due to autoConnect: true
      print('Socket.IO connection initiated with auto-connect');

    } catch (e) {
      print('Socket.IO connection error: $e');
      _isInitialized = false;
    }
  }

  void _handleSocketEvent(String eventName, dynamic data) {
    print('Processing Socket.IO event: $eventName for clinic: $_currentClinicId');
    
    try {
      // Handle different event types
      if (eventName == 'queue_updated') {
        EventBus().emitQueueUpdate(QueueUpdateEvent(
          clinicId: _currentClinicId!,
          doctorId: _currentDoctorId,
          queueData: data,
        ));
        
        // Check for queue notifications
        _checkQueueNotification(data);
      } else if (eventName == 'clinic_status_updated') {
        EventBus().emitClinicStatusUpdate(ClinicStatusUpdateEvent(
          clinicId: data['clinicId'],
          statusData: data,
        ));
        
        // Check for clinic open notifications
        _checkClinicOpenNotification(data);
      } else if (eventName == 'doctor_status_changed') {
        EventBus().emitDoctorAvailabilityUpdate(DoctorAvailabilityUpdateEvent(
          clinicId: _currentClinicId!,
          doctorId: data['doctorId'],
          doctorName: data['doctorName'],
          isAvailable: data['isAvailable'],
          lastStatusChange: data['lastStatusChange'],
        ));
        
        // Check for doctor available notifications
        _checkDoctorAvailableNotification(data);
      } else if (eventName == 'patient-served') {
        EventBus().emitPatientServed(PatientServedEvent(
          patientId: data['patientId'],
          queueId: data['queueId'],
        ));
      } else if (eventName == 'booking_history_updated') {
        EventBus().emitBookingHistoryUpdate(BookingHistoryUpdateEvent(
          patientId: data['patientId'],
          bookingData: data,
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
      // Join clinic room (matches backend implementation)
      _socket!.emit('join_clinic', clinicId);
      print('Joined clinic room: $clinicId');
      
      // Join doctor room if specified
      if (doctorId != null) {
        _socket!.emit('join_doctor', doctorId);
        print('Joined doctor room: $doctorId');
      }
      
      // Join patient room for real-time patient updates
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patientId');
      if (patientId != null) {
        _socket!.emit('join_patient', patientId);
        print('Joined patient room: $patientId');
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
      // Rooms are automatically cleaned up on disconnect in Socket.IO
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

  Future<void> _checkQueueNotification(dynamic data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patientId');
      if (patientId == null) return;

      final currentNumber = data['currentNumber'] ?? data['current'] ?? 0;
      final upcoming = data['upcoming'] as List? ?? [];
      final clinicName = data['clinicName'] ?? 'Clinic';
      final doctorName = data['doctorName'] ?? 'Doctor';
      
      // Check if patient is in upcoming list and within 3 numbers
      for (var patient in upcoming) {
        if (patient['patientId'] == patientId) {
          final patientNumber = patient['number'] ?? 0;
          final remaining = patientNumber - currentNumber;
          if (remaining <= 3 && remaining > 0) {
            await NotificationService().showQueueNotification(currentNumber, patientNumber, clinicName, doctorName);
          }
          break;
        }
      }
    } catch (e) {
      print('Error checking queue notification: $e');
    }
  }

  Future<void> _checkClinicOpenNotification(dynamic data) async {
    try {
      final isOpen = data['isOpen'] ?? false;
      final clinicId = data['clinicId'];
      final clinicName = data['clinicName'] ?? 'Clinic';
      
      if (isOpen && await NotificationService().isClinicNotificationEnabled(clinicId)) {
        await NotificationService().showClinicOpenNotification(clinicName, clinicId);
        // Auto-disable notification after sending
        await NotificationService().removeClinicNotification(clinicId);
      } else if (!isOpen) {
        // Clinic closed, users can enable notifications again
      }
    } catch (e) {
      print('Error checking clinic notification: $e');
    }
  }

  Future<void> _checkDoctorAvailableNotification(dynamic data) async {
    try {
      final isAvailable = data['isAvailable'] ?? false;
      final doctorId = data['doctorId'];
      final doctorName = data['doctorName'] ?? 'Doctor';
      final clinicName = data['clinicName'] ?? 'Clinic';
      
      if (isAvailable && await NotificationService().isDoctorNotificationEnabled(doctorId)) {
        await NotificationService().showDoctorAvailableNotification(doctorName, clinicName, doctorId);
        // Auto-disable notification after sending
        await NotificationService().removeDoctorNotification(doctorId);
      } else if (!isAvailable) {
        // Doctor unavailable, users can enable notifications again
      }
    } catch (e) {
      print('Error checking doctor notification: $e');
    }
  }
}