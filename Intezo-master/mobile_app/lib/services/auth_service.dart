// lib/services/auth_service.dart
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import '../models/patient.dart';
import 'database_service.dart';
import 'network_service.dart';
import 'socket_service.dart';
import 'fcm_service.dart';

class AuthService {
  // Add this to your AuthService class
  static Future<Map<String, dynamic>?> getCachedPatientData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final patientId = prefs.getString('patientId');

      if (patientId != null) {
        // Try to get from local database first
        final patient = await DatabaseService.getPatient(patientId);
        if (patient != null) {
          return patient.toJson();
        }
      }

      // Fallback to SharedPreferences
      final name = prefs.getString('patientName');
      final email = prefs.getString('patientEmail');
      final phone = prefs.getString('patientPhone');

      if (name != null && email != null && phone != null) {
        return {
          'name': name,
          'email': email,
          'phone': phone,
        };
      }
      return null;
    } catch (e) {
      print('Error getting cached patient data: $e');
      return null;
    }
  }

  static Future<bool> logoutFromAllDevices() async {
    try {
      final response = await ApiService.post('auth/logout/all', null);
      return response['success'] == true;
    } catch (e) {
      print('Logout from all devices failed: $e');
      return false;
    }
  }

  static Future<Map<String, dynamic>> patientLogin(String email) async {
    try {
      final response = await ApiService.post('auth/login/patient', {
        'email': email,
      });

      if (response['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', response['token']);
        await prefs.setString('patientId', response['patient']['_id']);
        await prefs.setString('patientName', response['patient']['name']);
        await prefs.setString('patientEmail', response['patient']['email']);
        await prefs.setString('patientPhone', response['patient']['phone']);

        // Handle premium status with expiry check
        bool isPremium = response['patient']['isPremium'] ?? false;
        if (isPremium && response['patient']['premiumExpiresAt'] != null) {
          final expiryDate = DateTime.parse(response['patient']['premiumExpiresAt']);
          isPremium = expiryDate.isAfter(DateTime.now());
        }

        await prefs.setBool('isPremium', isPremium);
        if (response['patient']['premiumExpiresAt'] != null) {
          await prefs.setString('premiumExpiresAt', response['patient']['premiumExpiresAt']);
        }

        // Save patient data to local database
        final patient = Patient.fromJson(response['patient']);
        await DatabaseService.savePatient(patient);

        // Save email to history for future suggestions
        await DatabaseService.saveEmailToHistory(email);

        // Register FCM token after successful login
        try {
          await FCMService().registerToken();
          print('✅ FCM token registered after login');
        } catch (e) {
          print('❌ FCM token registration failed: $e');
        }

        return {'success': true};
      } else if (response['requiresVerification'] == true) {
        return {
          'success': false,
          'requiresVerification': true,
          'patientId': response['patientId']
        };
      }
      return {'success': false};
    } catch (e) {
      throw Exception('Login failed: $e');
    }
  }

  static Future<Map<String, dynamic>> registerPatient(String name, String email, String phone) async {
    try {
      final response = await ApiService.post('auth/register/patient', {
        'name': name,
        'email': email,
        'phone': phone,
      });

      if (response['requiresVerification'] == true) {
        return {
          'success': true,
          'pendingId': response['pendingId'],
          'requiresVerification': true
        };
      }
      return {'success': false};
    } catch (e) {
      throw Exception('Registration failed: $e');
    }
  }

  static Future<Map<String, dynamic>> verifyPatientEmail(String pendingId, String code) async {
    try {
      final response = await ApiService.post('auth/verify/patient', {
        'patientId': pendingId,
        'verificationCode': code,
      });

      if (response['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', response['token']);
        await prefs.setString('patientId', response['patient']['_id']);
        await prefs.setString('patientName', response['patient']['name']);
        await prefs.setString('patientEmail', response['patient']['email']);
        await prefs.setString('patientPhone', response['patient']['phone']);

        // Handle premium status with expiry check
        bool isPremium = response['patient']['isPremium'] ?? false;
        if (isPremium && response['patient']['premiumExpiresAt'] != null) {
          final expiryDate = DateTime.parse(response['patient']['premiumExpiresAt']);
          isPremium = expiryDate.isAfter(DateTime.now());
        }

        await prefs.setBool('isPremium', isPremium);
        if (response['patient']['premiumExpiresAt'] != null) {
          await prefs.setString('premiumExpiresAt', response['patient']['premiumExpiresAt']);
        }

        // Save patient data to local database
        final patient = Patient.fromJson(response['patient']);
        await DatabaseService.savePatient(patient);

        // Save email to history for future suggestions
        await DatabaseService.saveEmailToHistory(response['patient']['email']);

        // Register FCM token after successful verification
        try {
          await FCMService().registerToken();
          print('✅ FCM token registered after verification');
        } catch (e) {
          print('❌ FCM token registration failed: $e');
        }

        return {'success': true};
      }
      return {'success': false};
    } catch (e) {
      throw Exception('Verification failed: $e');
    }
  }

  static Future<bool> resendPatientVerification(String pendingId) async {
    try {
      final response = await ApiService.post('auth/resend/patient', {
        'patientId': pendingId,
      });

      return response['message'] != null;
    } catch (e) {
      throw Exception('Resend verification failed: $e');
    }
  }

  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token') != null;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    final patientId = prefs.getString('patientId');

    try {
      // Disconnect socket connections
      await SocketService.instance.disconnect();

      // Clear all local database data
      await DatabaseService.clearAllData();

      // Keep email history for suggestions (don't clear for better UX)

      // Clear all stored preferences
      await prefs.clear();

      print('Logout completed successfully');
    } catch (e) {
      print('Error during logout: $e');
      // Still clear preferences even if other cleanup fails
      await prefs.clear();
    }
  }

  static Future<List<String>> getEmailSuggestions() async {
    return await DatabaseService.getEmailHistory();
  }

  static Future<void> clearEmailHistory() async {
    await DatabaseService.clearEmailHistory();
  }

  // Clear premium cache and force refresh
  static Future<void> clearPremiumCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('isPremium');
      await prefs.remove('premiumExpiresAt');

      // Patient model doesn't have premium fields, only clear SharedPreferences

      print('Premium cache cleared successfully');
    } catch (e) {
      print('Error clearing premium cache: $e');
    }
  }

  static Future<Map<String, dynamic>?> getPatientProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final patientId = prefs.getString('patientId');

    // Check network connectivity first
    final isOnline = await NetworkService.isConnected();
    print('AuthService: Network status: $isOnline');
    if (!isOnline) {
      print('AuthService: No network, using offline profile');
      if (patientId != null) {
        final patient = await DatabaseService.getPatient(patientId);
        if (patient != null) {
          return patient.toJson();
        }
      }
      throw Exception('No offline profile data available');
    }

    try {
      final response = await ApiService.get('patients/profile');

      // Save updated profile to local database and SharedPreferences
      if (response != null) {
        final patient = Patient.fromJson(response);
        await DatabaseService.savePatient(patient);

        // Update cached premium status in SharedPreferences
        await prefs.setBool('isPremium', response['isPremium'] ?? false);
        if (response['premiumExpiresAt'] != null) {
          await prefs.setString('premiumExpiresAt', response['premiumExpiresAt']);
        } else {
          await prefs.remove('premiumExpiresAt');
        }
      }

      return response;
    } catch (e) {
      // If network fails, try to get from local database
      if (patientId != null) {
        final patient = await DatabaseService.getPatient(patientId);
        if (patient != null) {
          return patient.toJson();
        }
      }

      throw Exception('Failed to get profile: $e');
    }
  }

  // Add method to refresh premium status specifically
  static Future<Map<String, dynamic>?> refreshPremiumStatus() async {
    try {
      final response = await ApiService.get('premium/status');

      if (response != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('isPremium', response['isPremium'] ?? false);
        if (response['premiumExpiresAt'] != null) {
          await prefs.setString('premiumExpiresAt', response['premiumExpiresAt']);
        } else {
          await prefs.remove('premiumExpiresAt');
        }

        // Patient model doesn't have premium fields, only update SharedPreferences
      }

      return response;
    } catch (e) {
      print('Error refreshing premium status: $e');
      return null;
    }
  }
}