import 'api_service.dart';

class WaitTimeService {
  /// Get estimated wait time for a clinic/doctor queue
  static Future<Map<String, dynamic>?> getWaitTime(String clinicId, String doctorId) async {
    try {
      final response = await ApiService.get(
        'queue/$clinicId/$doctorId/wait-time',
        isPublic: true,
      );
      return response;
    } catch (e) {
      print('Error getting wait time: $e');
      return null;
    }
  }

  /// Get wait time for a specific patient's booking
  static Future<Map<String, dynamic>?> getPatientWaitTime(String queueId) async {
    try {
      final response = await ApiService.get('queues/patient/$queueId/wait-time');
      return response;
    } catch (e) {
      print('Error getting patient wait time: $e');
      return null;
    }
  }

  /// Get detailed queue data with individual wait times
  static Future<Map<String, dynamic>?> getDetailedQueue(String clinicId, String doctorId) async {
    try {
      final response = await ApiService.get(
        'queues/$clinicId/$doctorId/detailed',
        isPublic: true,
      );
      return response;
    } catch (e) {
      print('Error getting detailed queue: $e');
      return null;
    }
  }

  /// Format wait time in minutes to human-readable format
  static String formatWaitTime(int minutes) {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return '$minutes minutes';
    
    final hours = minutes ~/ 60;
    final remainingMinutes = minutes % 60;
    
    if (remainingMinutes == 0) {
      return '$hours hour${hours > 1 ? 's' : ''}';
    }
    return '$hours hour${hours > 1 ? 's' : ''} $remainingMinutes minutes';
  }

  /// Calculate estimated wait time based on position and average process time
  static Map<String, dynamic> calculateWaitTime({
    required int currentNumber,
    required int patientNumber,
    required int avgProcessTime,
  }) {
    final patientsAhead = patientNumber - currentNumber;
    final estimatedMinutes = patientsAhead > 0 ? patientsAhead * avgProcessTime : 0;
    
    return {
      'patientsAhead': patientsAhead > 0 ? patientsAhead : 0,
      'estimatedMinutes': estimatedMinutes,
      'estimatedTime': formatWaitTime(estimatedMinutes),
      'isNext': patientsAhead <= 1,
      'isBeingServed': patientsAhead <= 0,
    };
  }
}