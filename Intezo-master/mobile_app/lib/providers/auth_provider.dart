// lib/providers/auth_provider.dart
import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  bool _isLoading = false;
  bool _isLoggedIn = false;
  String? _error;

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  String? get error => _error;

  AuthProvider() {
    checkLoginStatus();
  }

  Future<void> checkLoginStatus() async {
    _isLoggedIn = await AuthService.isLoggedIn();
    notifyListeners();
  }

  Future<Map<String, dynamic>> login(String email) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await AuthService.patientLogin(email);
      if (result['success']) {
        _isLoggedIn = true;
      }
      _isLoading = false;
      notifyListeners();
      return result;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String phone) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await AuthService.registerPatient(name, email, phone);
      _isLoading = false;
      notifyListeners();
      return result;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<bool> verifyEmail(String pendingId, String code) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await AuthService.verifyPatientEmail(pendingId, code);
      if (result['success'] == true) {
        _isLoggedIn = true;
      }
      _isLoading = false;
      notifyListeners();
      return result['success'] == true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> resendVerification(String pendingId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await AuthService.resendPatientVerification(pendingId);
      _isLoading = false;
      notifyListeners();
      return success;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await AuthService.logout();
    _isLoggedIn = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}