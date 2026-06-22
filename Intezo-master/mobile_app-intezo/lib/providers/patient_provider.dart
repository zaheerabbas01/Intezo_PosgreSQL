// lib/providers/patient_provider.dart
import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../services/database_service.dart';
import '../services/secure_storage_service.dart';

class PatientProvider with ChangeNotifier {
  Map<String, dynamic>? _patientData;
  bool _isLoading = false;
  String? _error;
  final bool _premiumStatusLoading = false;

  Map<String, dynamic>? get patientData => _patientData;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get premiumStatusLoading => _premiumStatusLoading;

  PatientProvider() {
    // Load cached data immediately
    _loadCachedData();
  }

  Future<void> _loadCachedData() async {
    try {
      final cachedData = await AuthService.getCachedPatientData();
      if (cachedData != null) {
        _patientData = cachedData;
        notifyListeners();
      }
    } catch (e) {
      print('Error loading cached data: $e');
    }
  }

  Future<void> loadPatientProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await AuthService.getPatientProfile();
      _patientData = response;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      // Try to load from local database if network fails
      try {
        final patientId = await SecureStorageService.readPatientId();

        if (patientId != null) {
          final patient = await DatabaseService.getPatient(patientId);
          if (patient != null) {
            _patientData = patient.toJson();
          }
        }
      } catch (dbError) {
        print('Failed to load from database: $dbError');
      }

      _error = _patientData == null ? e.toString() : null;
      _isLoading = false;
      notifyListeners();
    }
  }

  // Add method to refresh premium status
  Future<void> refreshPremiumStatus() async {
    try {
      await AuthService.refreshPremiumStatus();
      // Reload patient profile to get updated data
      await loadPatientProfile();
    } catch (e) {
      print('Error refreshing premium status: $e');
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void clearData() {
    _patientData = null;
    _isLoading = false;
    _error = null;
    notifyListeners();
  }

  // Force refresh patient data
  Future<void> forceRefreshProfile() async {
    clearData();
    await loadPatientProfile();
  }

  // Get current premium status from cached data
  bool get isPremium {
    if (_patientData == null) return false;

    final isPremium = _patientData!['isPremium'] ?? false;
    if (!isPremium) return false;

    final premiumExpiresAt = _patientData!['premiumExpiresAt'];
    if (premiumExpiresAt == null) return false;

    final expiryDate = DateTime.parse(premiumExpiresAt);
    return expiryDate.isAfter(DateTime.now());
  }
}
