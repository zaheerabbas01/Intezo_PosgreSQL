import 'dart:async';

import 'package:flutter/material.dart';

import '../fronted/res/components/wigets/hospitalinfrom.dart';
import '../fronted/view/bottom_navigator.dart';
import '../fronted/view/doctor_detail_screen.dart';
import '../fronted/view/auth/login_screen.dart';
import 'clinic_service.dart';
import 'secure_storage_service.dart';

/// Centralizes navigation requested by push and local notifications.
///
/// Notification callbacks can run before Flutter has finished building the
/// first route, so requests are held until the splash screen marks the app as
/// ready. This also keeps notification code independent from widget context.
class AppNavigationService {
  AppNavigationService._();

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static String? _pendingPayload;
  static bool _appReady = false;
  static bool _isHandling = false;

  static void markAppReady() {
    _appReady = true;
    unawaited(_tryHandlePending());
  }

  static Future<void> handleNotificationPayload(String payload) async {
    final normalizedPayload = payload.trim();
    if (normalizedPayload.isEmpty) return;

    _pendingPayload = normalizedPayload;
    await _tryHandlePending();
  }

  static Future<void> flushPending() => _tryHandlePending();

  static void clearPending() {
    _pendingPayload = null;
  }

  static Future<void> showLogin() async {
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;

    clearPending();
    await navigator.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  static Future<void> _tryHandlePending() async {
    if (!_appReady || _isHandling || _pendingPayload == null) return;

    final navigator = navigatorKey.currentState;
    if (navigator == null) return;

    final token = await SecureStorageService.readToken();
    if (token == null || token.isEmpty) return;

    final payload = _pendingPayload!;
    _pendingPayload = null;
    _isHandling = true;

    try {
      if (payload.startsWith('clinic:')) {
        await _openClinic(navigator, payload.substring('clinic:'.length));
      } else if (payload.startsWith('doctor:')) {
        final parts = payload.split(':');
        final doctorId = parts.length > 1 ? parts[1] : '';
        final clinicId = parts.length > 2 ? parts[2] : null;
        await _openDoctor(navigator, doctorId, clinicId: clinicId);
      } else if (payload == 'status') {
        await _openStatus(navigator);
      }
    } catch (_) {
      // A notification must never crash the app. Keep an actionable fallback
      // route even when the specific clinic/doctor cannot be loaded.
      await _openSearch(navigator);
    } finally {
      _isHandling = false;
    }
  }

  static Future<void> _openStatus(NavigatorState navigator) async {
    await navigator.push(
      MaterialPageRoute(
        builder: (_) => const BottomNavWithInitialIndex(initialIndex: 2),
      ),
    );
  }

  static Future<void> _openSearch(NavigatorState navigator) async {
    await navigator.push(
      MaterialPageRoute(
        builder: (_) => const BottomNavWithInitialIndex(initialIndex: 1),
      ),
    );
  }

  static Future<void> _openClinic(
    NavigatorState navigator,
    String clinicId,
  ) async {
    if (clinicId.isEmpty) {
      await _openSearch(navigator);
      return;
    }

    final clinics = await ClinicService.getClinics();
    final clinic = clinics.cast<Map<String, dynamic>?>().firstWhere(
      (candidate) => _id(candidate) == clinicId,
      orElse: () => null,
    );

    if (clinic == null) {
      await _openSearch(navigator);
      return;
    }

    await navigator.push(
      MaterialPageRoute(builder: (_) => HospitalInform(clinic: clinic)),
    );
  }

  static Future<void> _openDoctor(
    NavigatorState navigator,
    String doctorId, {
    String? clinicId,
  }) async {
    if (doctorId.isEmpty || clinicId == null || clinicId.isEmpty) {
      await _openSearch(navigator);
      return;
    }

    final doctors = await ClinicService.getDoctors(clinicId);
    final doctor = doctors.cast<Map<String, dynamic>?>().firstWhere(
      (candidate) => _id(candidate) == doctorId,
      orElse: () => null,
    );

    if (doctor == null) {
      await _openSearch(navigator);
      return;
    }

    await navigator.push(
      MaterialPageRoute(builder: (_) => DoctorDetailScreen(doctor: doctor)),
    );
  }

  static String? _id(Map<String, dynamic>? value) {
    final id = value?['id'] ?? value?['_id'];
    return id?.toString();
  }
}
