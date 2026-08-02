import 'api_service.dart';

class PhoneVerificationService {
  static Future<Map<String, dynamic>> start(String phone) async {
    final response = await ApiService.post('phone-verification/start', {
      'phone': phone,
    });
    return Map<String, dynamic>.from(response);
  }

  static Future<Map<String, dynamic>> getStatus() async {
    final response = await ApiService.get('phone-verification/status');
    return Map<String, dynamic>.from(response);
  }

  static Future<Map<String, dynamic>> verify({
    required String requestId,
    required String pollToken,
    required String verificationCode,
  }) async {
    final response = await ApiService.post('phone-verification/verify', {
      'requestId': requestId,
      'pollToken': pollToken,
      'verificationCode': verificationCode,
    });
    return Map<String, dynamic>.from(response);
  }
}
