import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/clinic_provider.dart';
import '../../providers/patient_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/preload_service.dart';
import '../../services/auth_service.dart';
import '../../services/secure_storage_service.dart';
import '../res/components/wigets/colors.dart';
import '../res/components/wigets/home/hospital_sugest.dart';
import './premium_payment_screen.dart';

class Homescreen extends StatefulWidget {
  const Homescreen({super.key});

  @override
  State<Homescreen> createState() => _HomescreenState();
}

class _HomescreenState extends State<Homescreen> {
  bool isPremium = false;
  bool hasPendingPayment = false;
  bool isLoadingPremium = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeScreen();
    });
  }

  void _initializeScreen() {
    final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
    final patientProvider = Provider.of<PatientProvider>(
      context,
      listen: false,
    );

    patientProvider.loadPatientProfile();
    _checkPremiumStatus();

    // OPTIMIZED: Start smart preloading in background
    _startOptimizedLoading(clinicProvider, patientProvider);
  }

  Future<void> _startOptimizedLoading(
    ClinicProvider clinicProvider,
    PatientProvider patientProvider,
  ) async {
    try {
      // Get patient ID for preloading
      final patientId = await SecureStorageService.readPatientId();

      if (patientId != null) {
        // Start smart preloading in background
        PreloadService.smartPreload(patientId);
      }

      // Load clinics without forcing refresh to avoid socket disconnection
      clinicProvider.loadClinics();
    } catch (e) {
      print('Error in optimized loading: $e');
      // Fallback to normal loading
      clinicProvider.loadClinics();
    }
  }

  Future<void> _checkPremiumStatus() async {
    try {
      // Use AuthService to refresh premium status and sync caches
      final data = await AuthService.refreshPremiumStatus();

      if (data != null) {
        setState(() {
          isPremium = data['isPremium'] ?? false;
          hasPendingPayment = data['hasPendingPayment'] ?? false;
          if (data['premiumExpiresAt'] != null) {
            final expiryDate = DateTime.parse(data['premiumExpiresAt']);
            isPremium = isPremium && expiryDate.isAfter(DateTime.now());
          } else {
            isPremium = false;
          }
        });

        // Also refresh patient provider to sync UI
        if (mounted) {
          Provider.of<PatientProvider>(
            context,
            listen: false,
          ).refreshPremiumStatus();
        }
      }
    } catch (e) {
      print('Error checking premium status: $e');
    } finally {
      setState(() => isLoadingPremium = false);
    }
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;
    final clinicProvider = Provider.of<ClinicProvider>(context);
    final patientProvider = Provider.of<PatientProvider>(context);
    final patientData = patientProvider.patientData;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        backgroundColor: context.cardColor,
        title: Row(
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: Image.asset(
                'assets/images/logo.JPG',
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Icon(
                    Icons.medical_services,
                    size: 32,
                    color: colors().bluecolor1,
                  );
                },
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Intezo',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: context.textColor,
              ),
            ),
          ],
        ),
        foregroundColor: context.textColor,
        elevation: 0,
        actions: [
          if (patientData != null)
            CircleAvatar(
              radius: 16,
              backgroundColor: colors().bluecolor1,
              child: Text(
                patientData['name']?[0]?.toUpperCase() ?? 'U',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // OPTIMIZED: Clear caches and reload with fresh data
          final patientId = await SecureStorageService.readPatientId();

          if (patientId != null) {
            await PreloadService.clearPreloadedData();
            await PreloadService.smartPreload(patientId);
          }

          await Provider.of<ClinicProvider>(
            context,
            listen: false,
          ).loadClinics(forceRefresh: true);
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Section
              if (patientData != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: colors().bluecolor1.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome back, ${patientData['name']}!',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: context.textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Ready to book your next appointment?',
                        style: TextStyle(
                          fontSize: 14,
                          color: context.subtextColor,
                        ),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 20),

              // Premium Banner
              if (!isLoadingPremium && !isPremium && !hasPendingPayment)
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => PremiumPaymentScreen(),
                      ),
                    ).then((_) => _checkPremiumStatus());
                  },
                  child: Container(
                    margin: EdgeInsets.only(bottom: 16),
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: colors().bluecolor1.withOpacity(0.1),
                      border: Border.all(
                        color: colors().bluecolor1.withOpacity(0.3),
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.star_outline,
                          color: colors().bluecolor1,
                          size: 20,
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Upgrade to Premium - Book unlimited queues',
                            style: TextStyle(
                              color: colors().bluecolor1,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: colors().bluecolor1,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Rs 100',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 24),

              // Clinics Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "Recently Visited",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: context.textColor,
                    ),
                  ),
                  TextButton(
                    onPressed: () => clinicProvider.forceRefreshClinics(),
                    child: Text(
                      'Refresh',
                      style: TextStyle(color: colors().bluecolor1),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Clinics List
              clinicProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : clinicProvider.error != null
                  ? Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: context.cardColor,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(
                              isDarkMode ? 0.1 : 0.08,
                            ),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          // Check if this is the 201 error (which is actually success)
                          if (clinicProvider.error!.contains('201'))
                            Column(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  size: 48,
                                  color: Colors.green.shade400,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'Booking Completed Successfully!',
                                  style: TextStyle(
                                    color: Colors.green.shade600,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Your queue number has been booked successfully',
                                  style: TextStyle(
                                    color: context.subtextColor,
                                    fontSize: 12,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            )
                          else
                            Column(
                              children: [
                                Icon(
                                  Icons.refresh,
                                  size: 48,
                                  color: isDarkMode
                                      ? Colors.grey.shade400
                                      : Colors.grey.shade500,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'Unable to load clinics',
                                  style: TextStyle(
                                    color: context.textColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Please check your connection and try again',
                                  style: TextStyle(
                                    color: context.subtextColor,
                                    fontSize: 12,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: () {
                              // If it's a 201 error, clear it specifically
                              if (clinicProvider.error!.contains('201')) {
                                clinicProvider.clearSpecificError('201');
                              } else {
                                clinicProvider.loadClinics();
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: colors().bluecolor1,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Try Again'),
                          ),
                        ],
                      ),
                    )
                  : clinicProvider.clinics.isEmpty
                  ? Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: context.cardColor,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(
                              isDarkMode ? 0.1 : 0.08,
                            ),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Icon(
                            Icons.business,
                            size: 48,
                            color: isDarkMode
                                ? Colors.grey.shade600
                                : Colors.grey.shade400,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No clinics available',
                            style: TextStyle(
                              color: context.textColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Check back later for available clinics',
                            style: TextStyle(
                              color: context.subtextColor,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    )
                  : Hospital_Suggestion(clinics: clinicProvider.clinics),
            ],
          ),
        ),
      ),
    );
  }
}
