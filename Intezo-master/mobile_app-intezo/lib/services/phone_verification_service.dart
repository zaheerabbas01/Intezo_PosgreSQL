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
}
