// lib/services/optimized_clinic_service.dart
import 'api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class OptimizedClinicService {
  static const String _completeClinicKey = 'complete_clinic_';
  static const String _clinicSummaryKey = 'clinic_summary_';
  static const int _cacheValiditySeconds = 30;

  // OPTIMIZED: Get complete clinic data (clinic + doctors + queues) in single call
  static Future<Map<String, dynamic>?> getClinicComplete(String clinicId, {bool forceRefresh = false}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheKey = '$_completeClinicKey$clinicId';
      final cacheTimeKey = '${cacheKey}_time';
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        final cachedData = prefs.getString(cacheKey);
        final cacheTime = prefs.getInt(cacheTimeKey) ?? 0;
        final now = DateTime.now().millisecondsSinceEpoch;
        
        if (cachedData != null && (now - cacheTime) < (_cacheValiditySeconds * 1000)) {
          print('Serving complete clinic data from cache');
          return json.decode(cachedData);
        }
      }
      
      print('Fetching complete clinic data from API');
      final response = await ApiService.get('clinics/$clinicId/complete', isPublic: true);
      
      if (response is Map<String, dynamic>) {
        // Cache the response
        await prefs.setString(cacheKey, json.encode(response));
        await prefs.setInt(cacheTimeKey, DateTime.now().millisecondsSinceEpoch);
        
        return response;
      }
      
      return null;
    } catch (e) {
      print('Failed to get complete clinic data: $e');
      
      // Try to return cached data as fallback
      try {
        final prefs = await SharedPreferences.getInstance();
        final cachedData = prefs.getString('$_completeClinicKey$clinicId');
        if (cachedData != null) {
          print('Returning stale cached data due to network error');
          return json.decode(cachedData);
        }
      } catch (cacheError) {
        print('Cache fallback failed: $cacheError');
      }
      
      return null;
    }
  }

  // OPTIMIZED: Get clinic summary for quick preview
  static Future<Map<String, dynamic>?> getClinicSummary(String clinicId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheKey = '$_clinicSummaryKey$clinicId';
      final cacheTimeKey = '${cacheKey}_time';
      
      // Check cache first (60 seconds cache)
      final cachedData = prefs.getString(cacheKey);
      final cacheTime = prefs.getInt(cacheTimeKey) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      
      if (cachedData != null && (now - cacheTime) < (60 * 1000)) {
        return json.decode(cachedData);
      }
      
      final response = await ApiService.get('clinics/$clinicId/summary', isPublic: true);
      
      if (response is Map<String, dynamic>) {
        // Cache for 60 seconds
        await prefs.setString(cacheKey, json.encode(response));
        await prefs.setInt(cacheTimeKey, now);
        
        return response;
      }
      
      return null;
    } catch (e) {
      print('Failed to get clinic summary: $e');
      return null;
    }
  }

  // OPTIMIZED: Get specific doctor queue data quickly
  static Future<Map<String, dynamic>?> getDoctorQueueFast(String clinicId, String doctorId) async {
    try {
      final response = await ApiService.get(
        'clinics/$clinicId/doctors/$doctorId/queue-fast', 
        isPublic: true
      );
      
      if (response is Map<String, dynamic>) {
        return response;
      }
      
      return null;
    } catch (e) {
      print('Failed to get doctor queue: $e');
      return null;
    }
  }

  // OPTIMIZED: Get multiple doctor queues in batch
  static Future<Map<String, dynamic>?> getBatchDoctorQueues(String clinicId, List<String> doctorIds) async {
    try {
      if (doctorIds.isEmpty) return {};
      
      final response = await ApiService.post(
        'clinics/$clinicId/batch-queues',
        {'doctorIds': doctorIds},
        isPublic: true
      );
      
      if (response is Map<String, dynamic>) {
        return response;
      }
      
      return {};
    } catch (e) {
      print('Failed to get batch doctor queues: $e');
      return {};
    }
  }

  // OPTIMIZED: Preload clinic data for faster subsequent access
  static Future<void> preloadClinicData(String clinicId) async {
    try {
      // Preload in background without blocking UI
      getClinicComplete(clinicId, forceRefresh: true);
      getClinicSummary(clinicId);
    } catch (e) {
      print('Preload failed: $e');
    }
  }

  // OPTIMIZED: Get clinic with doctors (lightweight version)
  static Future<Map<String, dynamic>?> getClinicWithDoctors(String clinicId) async {
    try {
      final completeData = await getClinicComplete(clinicId);
      
      if (completeData != null) {
        return {
          'clinic': completeData['clinic'],
          'doctors': completeData['doctors'],
          'loadTime': DateTime.now().toIso8601String(),
        };
      }
      
      return null;
    } catch (e) {
      print('Failed to get clinic with doctors: $e');
      return null;
    }
  }

  // Clear all caches for a clinic
  static Future<void> clearClinicCache(String clinicId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_completeClinicKey$clinicId');
      await prefs.remove('${_completeClinicKey}${clinicId}_time');
      await prefs.remove('$_clinicSummaryKey$clinicId');
      await prefs.remove('${_clinicSummaryKey}${clinicId}_time');
      print('Cache cleared for clinic: $clinicId');
    } catch (e) {
      print('Error clearing cache: $e');
    }
  }

  // Clear all clinic caches
  static Future<void> clearAllCaches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((key) => 
        key.startsWith(_completeClinicKey) || 
        key.startsWith(_clinicSummaryKey)
      ).toList();
      
      for (final key in keys) {
        await prefs.remove(key);
      }
      
      print('All clinic caches cleared');
    } catch (e) {
      print('Error clearing all caches: $e');
    }
  }

  // Get cached clinic data instantly (for immediate UI display)
  static Future<Map<String, dynamic>?> getCachedClinicData(String clinicId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedData = prefs.getString('$_completeClinicKey$clinicId');
      
      if (cachedData != null) {
        return json.decode(cachedData);
      }
      
      return null;
    } catch (e) {
      print('Error getting cached data: $e');
      return null;
    }
  }
}