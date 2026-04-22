// lib/services/instant_clinic_service.dart
import 'api_service.dart';
import 'clinic_service.dart';

class InstantClinicService {
  // Load doctors and their queues in parallel (immediate fix)
  static Future<Map<String, dynamic>> loadClinicDataFast(String clinicId) async {
    final stopwatch = Stopwatch()..start();
    
    try {
      print('⚡ INSTANT: Loading clinic data in parallel');
      
      // Load doctors and first doctor's queue in parallel
      final doctorsResponse = await ApiService.get('doctors/public/$clinicId', isPublic: true);
      
      if (doctorsResponse is List && doctorsResponse.isNotEmpty) {
        final doctors = List<Map<String, dynamic>>.from(doctorsResponse);
        
        // Load all doctor queues in parallel instead of sequentially
        final queueFutures = doctors.map((doctor) => 
          ApiService.get('queues/public/$clinicId/${doctor['_id']}', isPublic: true)
            .then((queueData) => {
              'doctorId': doctor['_id'],
              'queueData': queueData ?? {
                'current': 0,
                'nextNumber': 1,
                'upcoming': [],
                'totalWaiting': 0,
                'avgWaitTime': 15,
                'canCallNext': false,
              }
            })
            .catchError((e) => {
              'doctorId': doctor['_id'],
              'queueData': {
                'current': 0,
                'nextNumber': 1,
                'upcoming': [],
                'totalWaiting': 0,
                'avgWaitTime': 15,
                'canCallNext': false,
              }
            })
        ).toList();
        
        // Wait for all queue data to load in parallel
        final queueResults = await Future.wait(queueFutures);
        
        // Combine doctors with their queue data
        final doctorsWithQueues = doctors.map((doctor) {
          final queueResult = queueResults.firstWhere(
            (result) => result['doctorId'] == doctor['_id'],
            orElse: () => {
              'doctorId': doctor['_id'],
              'queueData': {
                'current': 0,
                'nextNumber': 1,
                'upcoming': [],
                'totalWaiting': 0,
                'avgWaitTime': 15,
                'canCallNext': false,
              }
            }
          );
          
          return {
            ...doctor,
            'queueInfo': queueResult['queueData']
          };
        }).toList();
        
        stopwatch.stop();
        print('⚡ INSTANT: Loaded ${doctors.length} doctors with queues in ${stopwatch.elapsedMilliseconds}ms');
        
        return {
          'doctors': doctorsWithQueues,
          'loadTime': stopwatch.elapsedMilliseconds,
          'method': 'parallel'
        };
      }
      
      return {
        'doctors': [],
        'loadTime': stopwatch.elapsedMilliseconds,
        'method': 'empty'
      };
      
    } catch (e) {
      stopwatch.stop();
      print('❌ INSTANT: Error loading clinic data: $e');
      
      // Fallback to sequential loading
      return await _loadSequential(clinicId);
    }
  }
  
  static Future<Map<String, dynamic>> _loadSequential(String clinicId) async {
    final stopwatch = Stopwatch()..start();
    
    try {
      final doctors = await ClinicService.getDoctors(clinicId);
      
      stopwatch.stop();
      print('🐌 SEQUENTIAL: Loaded ${doctors.length} doctors in ${stopwatch.elapsedMilliseconds}ms');
      
      return {
        'doctors': doctors,
        'loadTime': stopwatch.elapsedMilliseconds,
        'method': 'sequential'
      };
    } catch (e) {
      stopwatch.stop();
      return {
        'doctors': [],
        'loadTime': stopwatch.elapsedMilliseconds,
        'method': 'error',
        'error': e.toString()
      };
    }
  }
}