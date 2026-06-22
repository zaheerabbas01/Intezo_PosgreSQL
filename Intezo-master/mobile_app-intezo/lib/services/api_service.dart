import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'secure_storage_service.dart';

class ApiService {
  static const Duration _requestTimeout = Duration(seconds: 20);

  static String get baseUrl => ApiConfig.currentBaseUrl;

  static Future<Map<String, String>> _getHeaders() async {
    final token = await SecureStorageService.readToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Map<String, String> get _publicHeaders => const {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  static dynamic _decodeBody(http.Response response) {
    if (response.body.isEmpty) return <String, dynamic>{};
    try {
      return json.decode(response.body);
    } on FormatException {
      throw Exception('The server returned an invalid response.');
    }
  }

  static String _errorMessage(http.Response response, String fallback) {
    try {
      final decoded = json.decode(response.body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['error'] ?? decoded['message'];
        if (message is String && message.isNotEmpty) return message;
      }
    } on FormatException {
      // Never expose raw server bodies to the UI or logs.
    }
    return '$fallback (${response.statusCode})';
  }

  static void _debugStatus(String method, int statusCode) {
    if (kDebugMode) debugPrint('$method completed with HTTP $statusCode');
  }

  static Future<dynamic> get(
    String endpoint, {
    bool isPublic = false,
    Map<String, dynamic>? queryParams,
  }) async {
    var url = Uri.parse('$baseUrl/$endpoint');
    if (queryParams != null) {
      url = url.replace(
        queryParameters: queryParams.map(
          (key, value) => MapEntry(key, value.toString()),
        ),
      );
    }

    final response = await http
        .get(url, headers: isPublic ? _publicHeaders : await _getHeaders())
        .timeout(_requestTimeout);
    _debugStatus('GET', response.statusCode);

    if (response.statusCode == 200) return _decodeBody(response);
    throw Exception(_errorMessage(response, 'Unable to load data'));
  }

  static Future<dynamic> post(
    String endpoint,
    dynamic data, {
    bool isPublic = false,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/$endpoint'),
          headers: isPublic ? _publicHeaders : await _getHeaders(),
          body: json.encode(data ?? <String, dynamic>{}),
        )
        .timeout(_requestTimeout);
    _debugStatus('POST', response.statusCode);

    final responseBody = _decodeBody(response);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return responseBody;
    }
    if (response.statusCode == 403 &&
        responseBody is Map<String, dynamic> &&
        responseBody['requiresVerification'] == true) {
      return responseBody;
    }
    throw Exception(_errorMessage(response, 'Unable to submit data'));
  }

  static Future<dynamic> put(String endpoint, dynamic data) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/$endpoint'),
          headers: await _getHeaders(),
          body: json.encode(data),
        )
        .timeout(_requestTimeout);
    _debugStatus('PUT', response.statusCode);

    if (response.statusCode == 200) return _decodeBody(response);
    throw Exception(_errorMessage(response, 'Unable to update data'));
  }

  static Future<dynamic> delete(String endpoint) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/$endpoint'), headers: await _getHeaders())
        .timeout(_requestTimeout);
    _debugStatus('DELETE', response.statusCode);

    if (response.statusCode == 200 || response.statusCode == 204) {
      return _decodeBody(response);
    }
    throw Exception(_errorMessage(response, 'Unable to delete data'));
  }

  static Future<bool> enableClinicNotification(String clinicId) async {
    try {
      final response = await post(
        'patients/notifications/clinic/$clinicId',
        <String, dynamic>{},
      );
      return response['success'] == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> disableClinicNotification(String clinicId) async {
    try {
      final response = await delete('patients/notifications/clinic/$clinicId');
      return response['success'] == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> enableDoctorNotification(String doctorId) async {
    try {
      final response = await post(
        'patients/notifications/doctor/$doctorId',
        <String, dynamic>{},
      );
      return response['success'] == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> disableDoctorNotification(String doctorId) async {
    try {
      final response = await delete('patients/notifications/doctor/$doctorId');
      return response['success'] == true;
    } catch (_) {
      return false;
    }
  }

  static Future<Map<String, dynamic>?> getNotificationPreferences() async {
    try {
      final response = await get('patients/notifications/preferences');
      return Map<String, dynamic>.from(response);
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> getPatientReports({
    int page = 1,
    int limit = 10,
  }) async {
    final response = await get(
      'reports/patient',
      queryParams: {'page': page, 'limit': limit},
    );
    return Map<String, dynamic>.from(response);
  }

  static String getReportDownloadUrl(String reportId) =>
      '$baseUrl/reports/$reportId/download';

  static Future<List<int>> downloadReportBytes(String reportId) async {
    final response = await http
        .get(
          Uri.parse('$baseUrl/reports/$reportId/download'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 60));
    _debugStatus('REPORT_DOWNLOAD', response.statusCode);

    if (response.statusCode == 200) return response.bodyBytes;
    throw Exception(_errorMessage(response, 'Unable to download report'));
  }

  static Future<bool> markReportAsRead(String reportId) async {
    try {
      final response = await http
          .patch(
            Uri.parse('$baseUrl/reports/$reportId/read'),
            headers: await _getHeaders(),
            body: json.encode(<String, dynamic>{}),
          )
          .timeout(_requestTimeout);
      _debugStatus('PATCH', response.statusCode);
      if (response.statusCode != 200) return false;
      final body = _decodeBody(response);
      return body is Map<String, dynamic> && body['success'] == true;
    } catch (_) {
      return false;
    }
  }
}
