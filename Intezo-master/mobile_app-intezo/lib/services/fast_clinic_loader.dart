// lib/services/fast_clinic_loader.dart
import 'optimized_clinic_service.dart';
import 'clinic_service.dart';

class FastClinicLoader {
  // Single method to load clinic data as fast as possible
  static Future<Map<String, dynamic>?> loadClinicFast(String clinicId) async {
    try {
      print('🚀 FastClinicLoader: Loading clinic $clinicId');

      // Try optimized endpoint first
      final optimizedData = await OptimizedClinicService.getClinicComplete(
        clinicId,
      );

      if (optimizedData != null) {
        print('✅ FastClinicLoader: Optimized data loaded successfully');
        return {
          'clinic': optimizedData['clinic'],
          'doctors': optimizedData['doctors'],
          'loadMethod': 'optimized',
          'loadTime': DateTime.now().toIso8601String(),
        };
      }

      // Fallback to old method
      print('⚠️ FastClinicLoader: Falling back to old method');
      final doctors = await ClinicService.getDoctors(clinicId);

      return {
        'clinic': null,
        'doctors': doctors,
        'loadMethod': 'fallback',
        'loadTime': DateTime.now().toIso8601String(),
      };
    } catch (e) {
      print('❌ FastClinicLoader: Error loading clinic: $e');
      return null;
    }
  }

  // Load doctor queue data quickly
  static Future<Map<String, dynamic>?> loadDoctorQueueFast(
    String clinicId,
    String doctorId,
  ) async {
    try {
      // Try optimized endpoint first
      final queueData = await OptimizedClinicService.getDoctorQueueFast(
        clinicId,
        doctorId,
      );

      if (queueData != null) {
        return queueData;
      }

      // Fallback to old method
      return await ClinicService.getRealTimeQueue(clinicId, doctorId: doctorId);
    } catch (e) {
      print('❌ FastClinicLoader: Error loading queue: $e');
      return {
        'current': 0,
        'nextNumber': 1,
        'upcoming': [],
        'totalWaiting': 0,
        'avgWaitTime': 15,
        'canCallNext': false,
      };
    }
  }
}
