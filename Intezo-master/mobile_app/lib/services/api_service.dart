// lib/services/api_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static String get baseUrl => ApiConfig.currentBaseUrl;

  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    final headers = {
      'Content-Type': 'application/json',
    };

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  // Add this method for public endpoints (no auth token)
  static Future<Map<String, String>> _getPublicHeaders() async {
    return {
      'Content-Type': 'application/json',
    };
  }

  // Update the get method to accept a parameter for public endpoints
  // lib/services/api_service.dart - Update the get method
  // lib/services/api_service.dart - Update get method
  static Future<dynamic> get(String endpoint, {
    bool isPublic = false,
    Map<String, dynamic>? queryParams
  }) async {
    try {
      final headers = isPublic ? await _getPublicHeaders() : await _getHeaders();

      // Build URL with query parameters
      Uri url = Uri.parse('$baseUrl/$endpoint');
      if (queryParams != null) {
        url = url.replace(queryParameters: queryParams.map((key, value) =>
            MapEntry(key, value.toString())));
      }

      print('Making GET request to: $url');
      print('Headers: $headers');

      final response = await http.get(
        url,
        headers: headers,
      );

      print('Response status: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to get data: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('API Error: $e');
      throw Exception('Error: $e');
    }
  }

  // Also update other methods if needed for consistency
  // In api_service.dart - Update the post method
  // Update post method to handle different status codes
  static Future<dynamic> post(String endpoint, dynamic data, {bool isPublic = false}) async {
    try {
      final headers = isPublic ? await _getPublicHeaders() : await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/$endpoint'),
        headers: headers,
        body: data != null ? json.encode(data) : '{}',
      );

      print('POST Response status: ${response.statusCode}');
      print('POST Response body: ${response.body}');

      final responseBody = json.decode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return responseBody;
      } else if (response.statusCode == 403 && responseBody.containsKey('requiresVerification')) {
        // Return 403 responses with verification requirement instead of throwing
        return responseBody;
      } else if (response.statusCode == 400) {
        // Handle validation errors
        if (responseBody.containsKey('error')) {
          throw Exception(responseBody['error']);
        }
        throw Exception('Bad request: ${response.statusCode}');
      } else if (response.statusCode == 404) {
        throw Exception('Resource not found');
      } else {
        throw Exception('Failed to post data: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('POST Error: $e');
      throw Exception('Error: $e');
    }
  }

  // ... keep the put and delete methods as they were
  static Future<dynamic> put(String endpoint, dynamic data) async {
    try {
      final headers = await _getHeaders();
      final url = '$baseUrl/$endpoint';
      final body = json.encode(data);
      
      print('PUT Request Debug:');
      print('  URL: $url');
      print('  Headers: $headers');
      print('  Body: $body');
      
      final response = await http.put(
        Uri.parse(url),
        headers: headers,
        body: body,
      );

      print('PUT Response Debug:');
      print('  Status: ${response.statusCode}');
      print('  Body: ${response.body}');

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to put data: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('PUT Error: $e');
      throw Exception('Error: $e');
    }
  }

  static Future<dynamic> delete(String endpoint) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/$endpoint'),
        headers: await _getHeaders(),
      );

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to delete data: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error: $e');
    }
  }

  // Notification preference methods
  static Future<bool> enableClinicNotification(String clinicId) async {
    try {
      final response = await post('patients/notifications/clinic/$clinicId', {});
      return response['success'] == true;
    } catch (e) {
      print('Error enabling clinic notification: $e');
      return false;
    }
  }
  
  static Future<bool> disableClinicNotification(String clinicId) async {
    try {
      final response = await delete('patients/notifications/clinic/$clinicId');
      return response['success'] == true;
    } catch (e) {
      print('Error disabling clinic notification: $e');
      return false;
    }
  }
  
  static Future<bool> enableDoctorNotification(String doctorId) async {
    try {
      final response = await post('patients/notifications/doctor/$doctorId', {});
      return response['success'] == true;
    } catch (e) {
      print('Error enabling doctor notification: $e');
      return false;
    }
  }
  
  static Future<bool> disableDoctorNotification(String doctorId) async {
    try {
      final response = await delete('patients/notifications/doctor/$doctorId');
      return response['success'] == true;
    } catch (e) {
      print('Error disabling doctor notification: $e');
      return false;
    }
  }
  
  static Future<Map<String, dynamic>?> getNotificationPreferences() async {
    try {
      final response = await get('patients/notifications/preferences');
      return Map<String, dynamic>.from(response);
    } catch (e) {
      print('Error getting notification preferences: $e');
      return null;
    }
  }

  // Report methods
  static Future<Map<String, dynamic>> getPatientReports({int page = 1, int limit = 10}) async {
    try {
      final response = await get('reports/patient', queryParams: {
        'page': page,
        'limit': limit,
      });
      return Map<String, dynamic>.from(response);
    } catch (e) {
      print('Error getting patient reports: $e');
      throw Exception('Failed to load reports: $e');
    }
  }

  static Future<String> getReportDownloadUrl(String reportId) async {
    try {
      return '$baseUrl/reports/$reportId/download';
    } catch (e) {
      print('Error getting report download URL: $e');
      throw Exception('Failed to get download URL: $e');
    }
  }

  // Download report as bytes
  static Future<List<int>> downloadReportBytes(String reportId) async {
    try {
      final headers = await _getHeaders();
      final url = '$baseUrl/reports/$reportId/download';
      
      final response = await http.get(Uri.parse(url), headers: headers);
      
      if (response.statusCode == 200) {
        return response.bodyBytes;
      } else {
        throw Exception('Failed to download report: ${response.statusCode}');
      }
    } catch (e) {
      print('Error downloading report bytes: $e');
      throw Exception('Failed to download report: $e');
    }
  }

  static Future<bool> markReportAsRead(String reportId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.patch(
        Uri.parse('$baseUrl/reports/$reportId/read'),
        headers: headers,
        body: json.encode({}),
      );
      
      if (response.statusCode == 200) {
        final responseBody = json.decode(response.body);
        return responseBody['success'] == true;
      }
      return false;
    } catch (e) {
      print('Error marking report as read: $e');
      return false;
    }
  }
}