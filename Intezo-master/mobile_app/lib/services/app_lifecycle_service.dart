import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/clinic_provider.dart';
import '../providers/patient_provider.dart';

class AppLifecycleService extends WidgetsBindingObserver {
  static AppLifecycleService? _instance;
  static AppLifecycleService get instance {
    _instance ??= AppLifecycleService._internal();
    return _instance!;
  }
  AppLifecycleService._internal();

  BuildContext? _context;
  DateTime? _lastPausedTime;

  void initialize(BuildContext context) {
    _context = context;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.paused:
        _lastPausedTime = DateTime.now();
        print('App paused at: $_lastPausedTime');
        break;
        
      case AppLifecycleState.resumed:
        _handleAppResumed();
        break;
        
      default:
        break;
    }
  }

  Future<void> _handleAppResumed() async {
    print('App resumed');
    
    if (_context == null) return;
    
    // Always refresh data when app resumes to ensure fresh content
    if (_lastPausedTime != null) {
      final pauseDuration = DateTime.now().difference(_lastPausedTime!);
      print('App was paused for ${pauseDuration.inSeconds} seconds, refreshing data');
      
      try {
        final clinicProvider = Provider.of<ClinicProvider>(_context!, listen: false);
        final patientProvider = Provider.of<PatientProvider>(_context!, listen: false);
        
        // Force refresh all data regardless of pause duration
        await clinicProvider.forceRefreshClinics();
        await patientProvider.forceRefreshProfile();
      } catch (e) {
        print('Error refreshing data on app resume: $e');
      }
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _context = null;
  }
}