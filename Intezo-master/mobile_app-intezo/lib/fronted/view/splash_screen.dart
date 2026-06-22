import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/clinic_provider.dart';
import '../../providers/patient_provider.dart';
import '../../services/secure_storage_service.dart';
import 'bottom_navigator.dart';
import 'auth/login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    try {
      print('🚀 Splash Screen: Starting initialization');
      final authProvider = Provider.of<AuthProvider>(context, listen: false);

      // Check login status
      print('🚀 Splash Screen: Checking login status');
      await authProvider.checkLoginStatus();
      print(
        '🚀 Splash Screen: Login status checked - isLoggedIn: ${authProvider.isLoggedIn}',
      );

      // Force refresh data if user is logged in
      if (authProvider.isLoggedIn) {
        final patientId = await SecureStorageService.readPatientId();
        if (patientId != null) {
          print(
            '🚀 Splash Screen: Force refreshing data for patient: $patientId',
          );
          final clinicProvider = Provider.of<ClinicProvider>(
            context,
            listen: false,
          );
          final patientProvider = Provider.of<PatientProvider>(
            context,
            listen: false,
          );
          await clinicProvider.forceRefreshClinics();
          await patientProvider.forceRefreshProfile();
        }
      }

      // Wait for minimum splash duration
      print('🚀 Splash Screen: Waiting for minimum duration');
      await Future.delayed(const Duration(seconds: 2));

      // Navigate to appropriate screen
      if (mounted) {
        print(
          '🚀 Splash Screen: Navigating to ${authProvider.isLoggedIn ? "BottomNav" : "LoginScreen"}',
        );
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (context) => authProvider.isLoggedIn
                ? const BottomNav()
                : const LoginScreen(),
          ),
        );
      } else {
        print('🚀 Splash Screen: Widget not mounted, skipping navigation');
      }
    } catch (e, stackTrace) {
      print('🔴 Splash Screen Error: $e');
      print('🔴 Stack trace: $stackTrace');

      // Fallback navigation on error
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: SizedBox(
          width: MediaQuery.of(context).size.width * 0.4,
          height: 150,
          child: Image.asset(
            'assets/images/intezo_logo.png',
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: MediaQuery.of(context).size.width * 0.6,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.image_not_supported,
                  size: 50,
                  color: Colors.grey,
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
