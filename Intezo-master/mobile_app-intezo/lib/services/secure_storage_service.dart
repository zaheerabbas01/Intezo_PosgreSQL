import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecureStorageService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _tokenKey = 'auth_token';
  static const String _patientIdKey = 'patient_id';
  static const String _patientNameKey = 'patient_name';
  static const String _patientEmailKey = 'patient_email';
  static const String _patientPhoneKey = 'patient_phone';
  static const String _pendingFcmTokenKey = 'pending_fcm_token';
  static const String _databaseKey = 'local_database_key';
  static const String _patientAuthChallengeKey = 'patient_auth_challenge';

  static Future<void> migrateLegacySession() async {
    final prefs = await SharedPreferences.getInstance();

    await _migrateValue(prefs, 'token', _tokenKey);
    await _migrateValue(prefs, 'patientId', _patientIdKey);
    await _migrateValue(prefs, 'patientName', _patientNameKey);
    await _migrateValue(prefs, 'patientEmail', _patientEmailKey);
    await _migrateValue(prefs, 'patientPhone', _patientPhoneKey);
    await _migrateValue(prefs, 'pending_fcm_token', _pendingFcmTokenKey);
  }

  static Future<void> _migrateValue(
    SharedPreferences prefs,
    String legacyKey,
    String secureKey,
  ) async {
    final existing = await _storage.read(key: secureKey);
    final legacy = prefs.getString(legacyKey);
    if ((existing == null || existing.isEmpty) &&
        legacy != null &&
        legacy.isNotEmpty) {
      await _storage.write(key: secureKey, value: legacy);
    }
    await prefs.remove(legacyKey);
  }

  static Future<void> savePatientSession({
    required String token,
    required String patientId,
    required String name,
    required String email,
    required String phone,
  }) async {
    await Future.wait([
      _storage.write(key: _tokenKey, value: token),
      _storage.write(key: _patientIdKey, value: patientId),
      _storage.write(key: _patientNameKey, value: name),
      _storage.write(key: _patientEmailKey, value: email),
      _storage.write(key: _patientPhoneKey, value: phone),
    ]);

    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.remove('token'),
      prefs.remove('patientId'),
      prefs.remove('patientName'),
      prefs.remove('patientEmail'),
      prefs.remove('patientPhone'),
    ]);
  }

  static Future<String?> readToken() => _storage.read(key: _tokenKey);

  static Future<String?> readPatientId() => _storage.read(key: _patientIdKey);

  static Future<Map<String, String>?> readPatientIdentity() async {
    final values = await Future.wait([
      _storage.read(key: _patientNameKey),
      _storage.read(key: _patientEmailKey),
      _storage.read(key: _patientPhoneKey),
    ]);
    final name = values[0];
    final phone = values[2];
    if (name == null || name.isEmpty || phone == null || phone.isEmpty) {
      return null;
    }
    return {'name': name, 'email': values[1] ?? '', 'phone': phone};
  }

  static Future<void> savePendingFcmToken(String token) =>
      _storage.write(key: _pendingFcmTokenKey, value: token);

  static Future<String?> readPendingFcmToken() =>
      _storage.read(key: _pendingFcmTokenKey);

  static Future<void> deletePendingFcmToken() =>
      _storage.delete(key: _pendingFcmTokenKey);

  static Future<void> savePatientAuthChallenge(Map<String, dynamic> challenge) {
    return _storage.write(
      key: _patientAuthChallengeKey,
      value: jsonEncode(challenge),
    );
  }

  static Future<Map<String, dynamic>?> readPatientAuthChallenge() async {
    final value = await _storage.read(key: _patientAuthChallengeKey);
    if (value == null || value.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(value));
    } catch (_) {
      await clearPatientAuthChallenge();
      return null;
    }
  }

  static Future<void> clearPatientAuthChallenge() =>
      _storage.delete(key: _patientAuthChallengeKey);

  static Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: _tokenKey),
      _storage.delete(key: _patientIdKey),
      _storage.delete(key: _patientNameKey),
      _storage.delete(key: _patientEmailKey),
      _storage.delete(key: _patientPhoneKey),
      _storage.delete(key: _pendingFcmTokenKey),
      _storage.delete(key: _patientAuthChallengeKey),
    ]);

    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.remove('token'),
      prefs.remove('patientId'),
      prefs.remove('patientName'),
      prefs.remove('patientEmail'),
      prefs.remove('patientPhone'),
      prefs.remove('pending_fcm_token'),
    ]);
  }

  static Future<String> getOrCreateDatabaseKey() async {
    final existing = await _storage.read(key: _databaseKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    final generated = base64UrlEncode(bytes);
    await _storage.write(key: _databaseKey, value: generated);
    return generated;
  }
}
