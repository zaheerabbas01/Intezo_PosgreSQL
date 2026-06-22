import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:provider/provider.dart';

import 'config/api_config.dart';
import 'firebase_options.dart';
import 'fronted/view/splash_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/clinic_provider.dart';
import 'providers/offline_provider.dart';
import 'providers/patient_provider.dart';
import 'providers/theme_provider.dart';
import 'services/fcm_service.dart';
import 'services/notification_service.dart';
import 'services/secure_storage_service.dart';

void main() {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      await dotenv.load(fileName: '.env');
      await ApiConfig.initialize();
      await SecureStorageService.migrateLegacySession();

      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      runApp(const MyApp());
      unawaited(_initializePushServices());
    },
    (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('Unhandled application error: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    },
    zoneSpecification: ZoneSpecification(
      print: (self, parent, zone, message) {
        if (kDebugMode) parent.print(zone, message);
      },
    ),
  );
}

Future<void> _initializePushServices() async {
  try {
    await NotificationService().initialize();
    await FCMService().initialize();
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint('Notification initialization failed: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
  }
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final notifications = FlutterLocalNotificationsPlugin();
  const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
  const settings = InitializationSettings(android: androidSettings);
  await notifications.initialize(settings);

  const channel = AndroidNotificationChannel(
    'high_importance_channel',
    'High Importance Notifications',
    importance: Importance.high,
  );
  await notifications
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >()
      ?.createNotificationChannel(channel);

  const androidDetails = AndroidNotificationDetails(
    'high_importance_channel',
    'High Importance Notifications',
    importance: Importance.high,
    priority: Priority.high,
  );
  const notificationDetails = NotificationDetails(android: androidDetails);

  await notifications.show(
    DateTime.now().millisecondsSinceEpoch ~/ 1000,
    message.notification?.title ?? 'New notification',
    message.notification?.body ?? 'You have a new notification',
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
