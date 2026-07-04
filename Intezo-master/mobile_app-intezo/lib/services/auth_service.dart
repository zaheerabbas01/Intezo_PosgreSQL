import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/patient.dart';
import 'api_service.dart';
import 'database_service.dart';
import 'fcm_service.dart';
import 'network_service.dart';
import 'secure_storage_service.dart';
import 'socket_service.dart';

class AuthService {
  static Future<Map<String, dynamic>?> getCachedPatientData() async {
    try {
      final patientId = await SecureStorageService.readPatientId();

      if (patientId != null) {
        final patient = await DatabaseService.getPatient(patientId);
        if (patient != null) return patient.toJson();
      }

      return SecureStorageService.readPatientIdentity();
    } catch (e) {
      debugPrint('Error getting cached patient data: $e');
      return null;
    }
  }

  static Future<Map<String, dynamic>> patientLogin(String phone) async {
    final response = await ApiService.post('auth/login/patient', {
      'phone': phone,
    }, isPublic: true);
    return Map<String, dynamic>.from(response);
  }

  static Future<Map<String, dynamic>> registerPatient(
    String name,
    String phone,
  ) async {
    final response = await ApiService.post('auth/register/patient', {
      'name': name,
      'phone': phone,
    }, isPublic: true);
    return Map<String, dynamic>.from(response);
  }

  static Future<Map<String, dynamic>> completePatientPhoneAuth(
    String requestId,
    String pollToken,
  ) async {
    final response = Map<String, dynamic>.from(
      await ApiService.post('auth/patient/phone/status', {
        'requestId': requestId,
        'pollToken': pollToken,
      }, isPublic: true),
    );

    if (response['verified'] == true && response['token'] != null) {
      await _saveAuthenticatedPatient(response);
      return {'success': true, 'verified': true};
    }

    return {
      'success': false,
      'verified': false,
      'expiresAt': response['expiresAt'],
    };
  }

  static Future<void> _saveAuthenticatedPatient(
    Map<String, dynamic> response,
  ) async {
    final patientData = Map<String, dynamic>.from(response['patient']);
    final prefs = await SharedPreferences.getInstance();
    final email = patientData['email']?.toString() ?? '';

    await SecureStorageService.savePatientSession(
      token: response['token'].toString(),
      patientId: (patientData['_id'] ?? patientData['id']).toString(),
      name: patientData['name']?.toString() ?? '',
      email: email,
      phone: patientData['phone']?.toString() ?? '',
    );

    bool isPremium = patientData['isPremium'] == true;
    final premiumExpiresAt = patientData['premiumExpiresAt']?.toString();
    if (isPremium && premiumExpiresAt != null && premiumExpiresAt.isNotEmpty) {
      isPremium = DateTime.parse(premiumExpiresAt).isAfter(DateTime.now());
    }

    await prefs.setBool('isPremium', isPremium);
    if (premiumExpiresAt != null && premiumExpiresAt.isNotEmpty) {
      await prefs.setString('premiumExpiresAt', premiumExpiresAt);
    } else {
      await prefs.remove('premiumExpiresAt');
    }

    await DatabaseService.savePatient(Patient.fromJson(patientData));

    try {
      await FCMService().registerToken();
      debugPrint('FCM token registered after phone verification');
    } catch (e) {
      debugPrint('FCM token registration failed: $e');
    }
  }

  static Future<bool> isLoggedIn() async {
    final token = await SecureStorageService.readToken();
    return token != null && token.isNotEmpty;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();

    try {
      try {
        await ApiService.post('auth/logout', null);
      } catch (_) {
        // Local logout must still complete if the network is unavailable.
      }

      await SocketService.instance.disconnect();
      await DatabaseService.clearAllData();
      await prefs.clear();
      await SecureStorageService.clearSession();

      debugPrint('Logout completed successfully');
    } catch (e) {
      debugPrint('Error during logout: $e');
      await prefs.clear();
      await SecureStorageService.clearSession();
    }
  }

  static Future<List<String>> getEmailSuggestions() async {
    return DatabaseService.getEmailHistory();
  }

  static Future<void> clearEmailHistory() async {
    await DatabaseService.clearEmailHistory();
  }

  static Future<void> clearPremiumCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('isPremium');
      await prefs.remove('premiumExpiresAt');
      debugPrint('Premium cache cleared successfully');
    } catch (e) {
      debugPrint('Error clearing premium cache: $e');
    }
  }

  static Future<Map<String, dynamic>?> getPatientProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final patientId = await SecureStorageService.readPatientId();
    final isOnline = await NetworkService.isConnected();

    if (!isOnline) {
      if (patientId != null) {
        final patient = await DatabaseService.getPatient(patientId);
        if (patient != null) return patient.toJson();
      }
      throw Exception('No offline profile data available');
    }

    try {
      final response = await ApiService.get('patients/profile');

      if (response != null) {
        await DatabaseService.savePatient(Patient.fromJson(response));
        await prefs.setBool('isPremium', response['isPremium'] ?? false);
        if (response['premiumExpiresAt'] != null) {
          await prefs.setString(
            'premiumExpiresAt',
            response['premiumExpiresAt'],
          );
        } else {
          await prefs.remove('premiumExpiresAt');
        }
      }

      return response;
    } catch (e) {
      if (patientId != null) {
        final patient = await DatabaseService.getPatient(patientId);
        if (patient != null) return patient.toJson();
      }
      throw Exception('Failed to get profile: $e');
    }
  }

  static Future<Map<String, dynamic>?> refreshPremiumStatus() async {
    try {
      final response = await ApiService.get('premium/status');

      if (response != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('isPremium', response['isPremium'] ?? false);
        if (response['premiumExpiresAt'] != null) {
          await prefs.setString(
            'premiumExpiresAt',
            response['premiumExpiresAt'],
          );
        } else {
          await prefs.remove('premiumExpiresAt');
        }
      }

      return response;
    } catch (e) {
      debugPrint('Error refreshing premium status: $e');
      return null;
    }
  }
}
