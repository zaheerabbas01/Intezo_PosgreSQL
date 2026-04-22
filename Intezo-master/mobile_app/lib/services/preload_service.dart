// lib/services/preload_service.dart
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'optimized_clinic_service.dart';

class PreloadService {
  static const String _recentClinicsKey = 'recent_clinics_preload';
  static const String _recentClinicsTimeKey = 'recent_clinics_preload_time';
  static const String _lastFetchAttemptKey = 'recent_clinics_last_fetch';
  
  // OPTIMIZED: Preload recent clinics data immediately when app starts
  static Future<void> preloadRecentClinics(String patientId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheTime = prefs.getInt(_recentClinicsTimeKey) ?? 0;
      final lastFetchAttempt = prefs.getInt(_lastFetchAttemptKey) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      
      // Only fetch if cache is older than 10 minutes
      if ((now - cacheTime) < (10 * 60 * 1000)) {
        // Even if cached, preload complete clinic data for top 3 recent clinics
        final cachedClinics = await getCachedRecentClinics(patientId);
        if (cachedClinics.isNotEmpty) {
          final topClinicIds = cachedClinics.take(3).map((c) => c['_id'] as String).toList();
          batchPreloadClinics(topClinicIds);
        }
        return;
      }
      
      // Prevent multiple fetch attempts within 2 minutes
      if ((now - lastFetchAttempt) < (2 * 60 * 1000)) return;
      
      // Record fetch attempt
      await prefs.setInt(_lastFetchAttemptKey, now);
      
      // Fetch in background without blocking UI
      _fetchRecentClinicsBackground(patientId, prefs);
    } catch (e) {
      // Ignore errors in preloading
    }
  }
  
  static Future<void> _fetchRecentClinicsBackground(String patientId, SharedPreferences prefs) async {
    try {
      final response = await ApiService.get('patients/$patientId/history');
      
      if (response != null && response is List) {
        final now = DateTime.now();
        final threeMonthsAgo = now.subtract(const Duration(days: 90));
        
        final recentClinics = <Map<String, dynamic>>[];
        final seenIds = <String>{};
        
        // Process bookings in reverse chronological order
        final sortedBookings = List<dynamic>.from(response)
          ..sort((a, b) {
            final aDate = DateTime.tryParse(a['servedAt'] ?? a['bookedAt'] ?? '') ?? DateTime(1970);
            final bDate = DateTime.tryParse(b['servedAt'] ?? b['bookedAt'] ?? '') ?? DateTime(1970);
            return bDate.compareTo(aDate);
          });
        
        for (final booking in sortedBookings) {
          final bookingDate = DateTime.tryParse(booking['servedAt'] ?? booking['bookedAt'] ?? '');
          final clinicData = booking['clinic'];
          
          if (bookingDate != null && bookingDate.isAfter(threeMonthsAgo) && 
              clinicData != null && !seenIds.contains(clinicData['_id'])) {
            seenIds.add(clinicData['_id']);
            recentClinics.add(clinicData);
            
            // Limit to top 10 recent clinics
            if (recentClinics.length >= 10) break;
          }
        }
        
        // Cache the result
        await prefs.setString(_recentClinicsKey, json.encode(recentClinics));
        await prefs.setInt(_recentClinicsTimeKey, DateTime.now().millisecondsSinceEpoch);
        
        print('PreloadService: Cached ${recentClinics.length} recent clinics');
        
        // OPTIMIZED: Preload complete clinic data for top 3 recent clinics
        if (recentClinics.isNotEmpty) {
          final topClinicIds = recentClinics.take(3).map((c) => c['_id'] as String).toList();
          batchPreloadClinics(topClinicIds);
        }
      }
    } catch (e) {
      print('PreloadService: Error preloading recent clinics: $e');
    }
  }
  
  // Get cached recent clinics instantly
  static Future<List<Map<String, dynamic>>> getCachedRecentClinics(String patientId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedData = prefs.getString(_recentClinicsKey);
      
      if (cachedData != null) {
        final List<dynamic> cached = json.decode(cachedData);
        return List<Map<String, dynamic>>.from(cached);
      }
    } catch (e) {
      print('PreloadService: Error getting cached clinics: $e');
    }
    
    return [];
  }
  
  // OPTIMIZED: Batch preload multiple clinics
  static Future<void> batchPreloadClinics(List<String> clinicIds) async {
    try {
      if (clinicIds.isEmpty) return;
      
      print('PreloadService: Batch preloading ${clinicIds.length} clinics');
      
      // Limit to 3 concurrent preloads to avoid overwhelming the server
      final batches = <List<String>>[];
      for (int i = 0; i < clinicIds.length; i += 3) {
        batches.add(clinicIds.skip(i).take(3).toList());
      }
      
      for (final batch in batches) {
        final preloadPromises = batch.map((clinicId) => 
          OptimizedClinicService.preloadClinicData(clinicId)
        );
        
        await Future.wait(preloadPromises);
        
        // Small delay between batches
        await Future.delayed(Duration(milliseconds: 100));
      }
      
      print('PreloadService: Batch preload completed for ${clinicIds.length} clinics');
    } catch (e) {
      print('PreloadService: Error in batch preload: $e');
    }
  }
  
  // OPTIMIZED: Get instant clinic data if available
  static Future<Map<String, dynamic>?> getInstantClinicData(String clinicId) async {
    try {
      // Try to get cached complete data first
      final cachedData = await OptimizedClinicService.getCachedClinicData(clinicId);
      if (cachedData != null) {
        return cachedData;
      }
      
      // If not available, try clinic summary for quick display
      return await OptimizedClinicService.getClinicSummary(clinicId);
    } catch (e) {
      print('PreloadService: Error getting instant clinic data: $e');
      return null;
    }
  }
  
  // OPTIMIZED: Smart preload based on user behavior
  static Future<void> smartPreload(String patientId) async {
    try {
      // Get recent clinics first
      final recentClinics = await getCachedRecentClinics(patientId);
      
      if (recentClinics.isNotEmpty) {
        // Preload the most recent 3 clinics
        final topClinics = recentClinics.take(3).map((c) => c['_id'] as String).toList();
        await batchPreloadClinics(topClinics);
      }
      
      // Also preload general clinic list
      await preloadRecentClinics(patientId);
    } catch (e) {
      print('PreloadService: Error in smart preload: $e');
    }
  }
  
  // Clear all preloaded data
  static Future<void> clearPreloadedData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_recentClinicsKey);
      await prefs.remove(_recentClinicsTimeKey);
      await prefs.remove(_lastFetchAttemptKey);
      
      // Also clear optimized clinic service caches
      await OptimizedClinicService.clearAllCaches();
      
      print('PreloadService: All preloaded data cleared');
    } catch (e) {
      print('PreloadService: Error clearing preloaded data: $e');
    }
  }
}