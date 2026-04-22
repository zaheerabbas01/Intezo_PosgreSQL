// lib/services/clinic_service.dart
import 'api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class ClinicService {
  static const String _clinicsKey = 'cached_clinics';
  static const String _clinicsCacheTimeKey = 'clinics_cache_time';
  static const String _recentClinicsKey = 'recent_clinics';
  static const int _cacheValidityMinutes = 5;
  // OPTIMIZED: Get clinics with caching
  static Future<List<Map<String, dynamic>>> getClinics({bool forceRefresh = false}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        final cachedData = prefs.getString(_clinicsKey);
        final cacheTime = prefs.getInt(_clinicsCacheTimeKey) ?? 0;
        final now = DateTime.now().millisecondsSinceEpoch;
        
        if (cachedData != null && (now - cacheTime) < (_cacheValidityMinutes * 60 * 1000)) {
          print('Serving clinics from local cache');
          final List<dynamic> cached = json.decode(cachedData);
          return List<Map<String, dynamic>>.from(cached);
        }
      } else {
        print('Force refresh requested - bypassing cache');
      }
      
      print('Fetching clinics from API');
      final response = await ApiService.get('clinics/public', isPublic: true);
      
      if (response is List) {
        final clinics = List<Map<String, dynamic>>.from(response);
        
        // Cache the response
        await prefs.setString(_clinicsKey, json.encode(clinics));
        await prefs.setInt(_clinicsCacheTimeKey, DateTime.now().millisecondsSinceEpoch);
        
        return clinics;
      } else {
        print('Unexpected response format: $response');
        return [];
      }
    } catch (e) {
      print('Failed to get clinics: $e');
      
      // Try to return cached data as fallback
      try {
        final prefs = await SharedPreferences.getInstance();
        final cachedData = prefs.getString(_clinicsKey);
        if (cachedData != null) {
          print('Returning stale cached data due to network error');
          final List<dynamic> cached = json.decode(cachedData);
          return List<Map<String, dynamic>>.from(cached);
        }
      } catch (cacheError) {
        print('Cache fallback failed: $cacheError');
      }
      
      throw Exception('Failed to get clinics: $e');
    }
  }

  // lib/services/clinic_service.dart - Update getClinicStatus method
  static Future<Map<String, dynamic>> getClinicStatus(String clinicId) async {
    try {
      print('Fetching clinic status for: $clinicId');
      final response = await ApiService.get('clinics/$clinicId/status', isPublic: true);
      print('Clinic status response: $response');

      return {
        'isOpen': response['isOpen'] ?? false,
        'operatingHours': response['operatingHours'] ?? {'opening': '09:00', 'closing': '17:00'},
        'name': response['name'] ?? 'Clinic',
        'lastStatusChange': response['lastStatusChange'] // Add this for better tracking
      };
    } catch (e) {
      print('Error getting clinic status: $e');
      return {
        'isOpen': false,
        'operatingHours': {'opening': '09:00', 'closing': '17:00'},
        'name': 'Unknown Clinic',
        'lastStatusChange': null
      };
    }
  }

  // OPTIMIZED: Get recently visited clinics
  static Future<List<Map<String, dynamic>>> getRecentClinics(List<String> clinicIds) async {
    if (clinicIds.isEmpty) return [];
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheKey = '${_recentClinicsKey}_${clinicIds.join('_')}';
      final cacheTimeKey = '${cacheKey}_time';
      
      // Check cache first
      final cachedData = prefs.getString(cacheKey);
      final cacheTime = prefs.getInt(cacheTimeKey) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      
      if (cachedData != null && (now - cacheTime) < (2 * 60 * 1000)) { // 2 minute cache
        print('Serving recent clinics from cache');
        final List<dynamic> cached = json.decode(cachedData);
        return List<Map<String, dynamic>>.from(cached);
      }
      
      print('Fetching recent clinics from API');
      final response = await ApiService.post('clinics/recent', {
        'clinicIds': clinicIds
      }, isPublic: true);
      
      if (response is List) {
        final clinics = List<Map<String, dynamic>>.from(response);
        
        // Cache the response
        await prefs.setString(cacheKey, json.encode(clinics));
        await prefs.setInt(cacheTimeKey, now);
        
        return clinics;
      }
      
      return [];
    } catch (e) {
      print('Failed to get recent clinics: $e');
      return [];
    }
  }

  // OPTIMIZED: Get doctors with caching
  static Future<List<Map<String, dynamic>>> getDoctors(String clinicId, {bool forceRefresh = false}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheKey = 'doctors_$clinicId';
      final cacheTimeKey = '${cacheKey}_time';
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        final cachedData = prefs.getString(cacheKey);
        final cacheTime = prefs.getInt(cacheTimeKey) ?? 0;
        final now = DateTime.now().millisecondsSinceEpoch;
        
        if (cachedData != null && (now - cacheTime) < (2 * 60 * 1000)) { // 2 minute cache
          print('Serving doctors from cache for clinic: $clinicId');
          final List<dynamic> cached = json.decode(cachedData);
          return List<Map<String, dynamic>>.from(cached);
        }
      }
      
      print('Fetching doctors from API for clinic: $clinicId');
      final response = await ApiService.get('doctors/public/$clinicId', isPublic: true);
      
      if (response is List) {
        final doctors = List<Map<String, dynamic>>.from(response);
        print('Successfully parsed ${doctors.length} doctors');
        
        // Cache the response
        await prefs.setString(cacheKey, json.encode(doctors));
        await prefs.setInt(cacheTimeKey, DateTime.now().millisecondsSinceEpoch);
        
        return doctors;
      } else if (response is Map<String, dynamic>) {
        if (response.containsKey('error')) {
          print('Error from doctors API: ${response['error']}');
          throw Exception('API Error: ${response['error']}');
        }
      }
      
      return [];
    } catch (e) {
      print('Failed to get doctors: $e');
      
      // Try to return cached data as fallback
      try {
        final prefs = await SharedPreferences.getInstance();
        final cachedData = prefs.getString('doctors_$clinicId');
        if (cachedData != null) {
          print('Returning stale cached doctors due to network error');
          final List<dynamic> cached = json.decode(cachedData);
          return List<Map<String, dynamic>>.from(cached);
        }
      } catch (cacheError) {
        print('Cache fallback failed: $cacheError');
      }
      
      throw Exception('Failed to get doctors: $e');
    }
  }

// lib/services/clinic_service.dart - Update getRealTimeQueue method
  static Future<Map<String, dynamic>> getRealTimeQueue(String clinicId, {String? doctorId}) async {
    try {
      print('Getting real-time queue for clinic: $clinicId${doctorId != null ? ', doctor: $doctorId' : ''}');

      if (doctorId == null) {
        // If no doctor is selected, return default data instead of making a request
        print('No doctor selected, returning default queue data');
        return {
          'current': 0,
          'nextNumber': 1,
          'upcoming': [],
          'totalWaiting': 0,
          'avgWaitTime': 15,
          'canCallNext': false,
          'isDoctorQueue': false
        };
      }

      // Use doctor-specific public endpoint
      final response = await ApiService.get(
          'queues/public/$clinicId/$doctorId',
          isPublic: true
      );

      print('Queue API response: $response');

      if (response is Map<String, dynamic>) {
        return response;
      } else {
        print('Unexpected response format: $response');
        return {
          'current': 0,
          'nextNumber': 1,
          'upcoming': [],
          'totalWaiting': 0,
          'avgWaitTime': 15,
          'canCallNext': false,
          'isDoctorQueue': true
        };
      }
    } catch (e) {
      print('Error getting real-time queue: $e');
      // Return default data instead of throwing exception
      return {
        'current': 0,
        'nextNumber': 1,
        'upcoming': [],
        'totalWaiting': 0,
        'avgWaitTime': 15,
        'canCallNext': false,
        'isDoctorQueue': doctorId != null
      };
    }
  }
// Update bookQueueNumber method with wait time information
  static Future<Map<String, dynamic>> bookQueueNumber(String clinicId, String patientId, {String? doctorId, String? patientName}) async {
    try {
      final data = {
        'clinicId': clinicId,
        'patientId': patientId,
        'doctorId': doctorId, // Ensure doctorId is always included
        if (patientName != null) 'patientName': patientName,
      };

      print('Booking with data: $data');

      final response = await ApiService.post('queues/book-doctor', data);

      print('Booking response: $response');

      if (response is Map<String, dynamic>) {
        if (response.containsKey('error')) {
          throw Exception(response['error']);
        }
        
        // The response now includes enhanced wait time information:
        // - queueNumber: assigned queue number
        // - estimatedWait: wait time in minutes
        // - estimatedWaitTime: formatted wait time string
        // - patientsAhead: number of patients ahead
        // - currentlyServing: current serving number
        // - doctor: doctor information
        // - patientName: patient name for the booking
        
        return response;
      } else {
        throw Exception('Invalid response format from server');
      }
    } catch (e) {
      print('Booking service error: $e');
      throw Exception('Failed to book queue number: $e');
    }
  }

// Add method to get doctor details
  static Future<Map<String, dynamic>?> getDoctorDetails(String doctorId) async {
    try {
      final response = await ApiService.get('doctors/$doctorId');
      return Map<String, dynamic>.from(response);
    } catch (e) {
      print('Error getting doctor details: $e');
      return null;
    }
  }

  // FIXED: Remove the doctorId parameter that was causing the error
  static Future<Map<String, dynamic>> getCurrentQueue(String clinicId) async {
    try {
      final response = await ApiService.get('queues/$clinicId');
      return Map<String, dynamic>.from(response);
    } catch (e) {
      throw Exception('Failed to get current queue: $e');
    }
  }

  // FIXED: Add doctor-specific queue method
  static Future<Map<String, dynamic>> getDoctorQueue(String clinicId, String doctorId) async {
    try {
      final response = await ApiService.get(
          'queues/public/$clinicId',
          isPublic: true,
          queryParams: {'doctorId': doctorId}
      );
      return Map<String, dynamic>.from(response);
    } catch (e) {
      throw Exception('Failed to get doctor queue: $e');
    }
  }

  static Future<Map<String, dynamic>> getQueueStatus(String queueId) async {
    try {
      final response = await ApiService.get('queues/status/$queueId');
      return Map<String, dynamic>.from(response);
    } catch (e) {
      throw Exception('Failed to get queue status: $e');
    }
  }

  static Future<Map<String, dynamic>?> getPatientCurrentQueue() async {
    try {
      final response = await ApiService.get('patients/queue-status');
      return Map<String, dynamic>.from(response);
    } catch (e) {
      print('Error getting patient queue: $e');
      return null;
    }
  }

  // Add to clinic_service.dart
  // In clinic_service.dart - Update the cancelBooking method
  static Future<bool> cancelBooking(String queueId) async {
    try {
      // Change from DELETE to POST
      final response = await ApiService.post('queues/cancel/$queueId', {});
      return response['success'] == true;
    } catch (e) {
      throw Exception('Failed to cancel booking: $e');
    }
  }

// Add method to get doctor details
  // Cache management methods
  static Future<void> clearCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((key) => 
        key.startsWith(_clinicsKey) || 
        key.startsWith('doctors_') || 
        key.startsWith(_recentClinicsKey) ||
        key.contains('_cache_time') ||
        key.contains('clinic_status_')
      ).toList();
      
      for (final key in keys) {
        await prefs.remove(key);
      }
      
      print('All cache cleared successfully (${keys.length} keys removed)');
    } catch (e) {
      print('Error clearing cache: $e');
    }
  }
  
  // Force refresh clinic status when status changes
  static Future<void> invalidateClinicStatusCache(String clinicId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_clinicsKey);
      await prefs.remove(_clinicsCacheTimeKey);
      print('Clinic status cache invalidated for: $clinicId');
    } catch (e) {
      print('Error invalidating clinic status cache: $e');
    }
  }
  
  static Future<void> invalidateClinicCache(String clinicId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('doctors_$clinicId');
      await prefs.remove('doctors_${clinicId}_time');
      print('Cache invalidated for clinic: $clinicId');
    } catch (e) {
      print('Error invalidating cache: $e');
    }
  }

//   static Future<Map<String, dynamic>?> getDoctorDetails(String doctorId) async {
//     try {
//       final response = await ApiService.get('doctors/$doctorId');
//       return Map<String, dynamic>.from(response);
//     } catch (e) {
//       print('Error getting doctor details: $e');
//       return null;
//     }
//   }
}