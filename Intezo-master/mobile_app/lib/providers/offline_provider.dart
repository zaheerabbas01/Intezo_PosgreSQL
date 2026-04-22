import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/database_service.dart';
import '../services/booking_service.dart';
import '../services/auth_service.dart';

class OfflineProvider with ChangeNotifier {
  bool _isOffline = false;
  DateTime? _lastSyncTime;
  bool _isSyncing = false;

  bool get isOffline => _isOffline;
  DateTime? get lastSyncTime => _lastSyncTime;
  bool get isSyncing => _isSyncing;

  OfflineProvider() {
    _loadLastSyncTime();
  }

  Future<void> _loadLastSyncTime() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lastSync = prefs.getInt('lastSyncTime');
      if (lastSync != null) {
        _lastSyncTime = DateTime.fromMillisecondsSinceEpoch(lastSync);
        notifyListeners();
      }
    } catch (e) {
      print('Error loading last sync time: $e');
    }
  }

  void setOfflineStatus(bool offline) {
    if (_isOffline != offline) {
      _isOffline = offline;
      notifyListeners();
    }
  }

  Future<void> syncData() async {
    if (_isSyncing) return;

    _isSyncing = true;
    notifyListeners();

    try {
      // Sync patient profile
      await AuthService.getPatientProfile();
      
      // Sync booking history
      await BookingService.getBookingHistory();
      
      // Update last sync time
      _lastSyncTime = DateTime.now();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('lastSyncTime', _lastSyncTime!.millisecondsSinceEpoch);
      
      _isOffline = false;
    } catch (e) {
      _isOffline = true;
      print('Sync failed: $e');
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  String getLastSyncText() {
    if (_lastSyncTime == null) return 'Never synced';
    
    final now = DateTime.now();
    final difference = now.difference(_lastSyncTime!);
    
    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}h ago';
    } else {
      return '${difference.inDays}d ago';
    }
  }
}