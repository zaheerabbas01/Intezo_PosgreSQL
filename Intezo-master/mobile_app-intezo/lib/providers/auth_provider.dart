// lib/providers/auth_provider.dart
import 'dart:async';

import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../services/app_navigation_service.dart';
import '../services/session_events.dart';

class AuthProvider with ChangeNotifier {
  bool _isLoading = false;
  bool _isLoggedIn = false;
  String? _error;
  bool _handlingSessionExpiry = false;
  late final StreamSubscription<void> _sessionExpiredSubscription;

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  String? get error => _error;

  AuthProvider() {
    _sessionExpiredSubscription = SessionEvents.onExpired.listen((_) {
      unawaited(_handleSessionExpired());
    });
    unawaited(checkLoginStatus());
  }

  Future<void> _handleSessionExpired() async {
    if (_handlingSessionExpiry || !_isLoggedIn) return;
    _handlingSessionExpiry = true;

    try {
      await AuthService.logout();
      _isLoggedIn = false;
      _error = 'Your session expired. Please sign in again.';
      notifyListeners();
      await AppNavigationService.showLogin();
    } finally {
      _handlingSessionExpiry = false;
    }
  }

  Future<void> checkLoginStatus() async {
    _isLoggedIn = await AuthService.isLoggedIn();
    notifyListeners();
  }

  Future<Map<String, dynamic>> login(String phone) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await AuthService.patientLogin(phone);
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

  Future<Map<String, dynamic>> register(String name, String phone) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await AuthService.registerPatient(name, phone);
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

  Future<bool> completePhoneAuth(
    String requestId,
    String pollToken,
    String verificationCode,
  ) async {
    try {
      final result = await AuthService.completePatientPhoneAuth(
        requestId,
        pollToken,
        verificationCode,
      );
      if (result['success'] == true) {
        _isLoggedIn = true;
        _error = null;
        notifyListeners();
        return true;
      }
      if (_error != null) {
        _error = null;
        notifyListeners();
      }
      return false;
    } catch (e) {
      _error = e.toString();
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

  @override
  void dispose() {
    _sessionExpiredSubscription.cancel();
    super.dispose();
  }
}
