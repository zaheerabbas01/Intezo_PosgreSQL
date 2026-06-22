import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/booking_service.dart';
import '../../providers/theme_provider.dart';
import '../../models/booking.dart';
import '../res/components/wigets/colors.dart';
import '../../services/event_bus.dart';
import '../../services/secure_storage_service.dart';

class BookingHistoryScreen extends StatefulWidget {
  const BookingHistoryScreen({super.key});

  @override
  State<BookingHistoryScreen> createState() => _BookingHistoryScreenState();
}

class _BookingHistoryScreenState extends State<BookingHistoryScreen> {
  bool _isLoading = true;
  List<Booking> _bookingHistory = [];
  String? _error;
  bool _isOffline = false;
  Timer? _refreshTimer;
  DateTime? _lastRefresh;

  @override
  void initState() {
    super.initState();
    _loadBookingHistory();
    _setupRealTimeUpdates();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _setupRealTimeUpdates() {
    EventBus().onBookingHistoryUpdate.listen((event) {
      print('🔥 Booking history update received: ${event.bookingData}');
      if (mounted) {
        _throttledRefresh();
      }
    });
  }

  void _throttledRefresh() {
    // Cancel any existing timer
    _refreshTimer?.cancel();

    // Check if we refreshed recently (within last 5 seconds)
    final now = DateTime.now();
    if (_lastRefresh != null && now.difference(_lastRefresh!).inSeconds < 5) {
      // Schedule a refresh for later
      _refreshTimer = Timer(const Duration(seconds: 5), () {
        if (mounted) {
          _forceRefreshFromAPI();
        }
      });
      return;
    }

    // Refresh immediately
    _lastRefresh = now;
    _forceRefreshFromAPI();
  }

  Future<void> _forceRefreshFromAPI() async {
    if (!mounted) return;

    try {
      final patientId = await SecureStorageService.readPatientId();
      if (patientId == null || !mounted) return;

      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final response = await ApiService.get(
        'patients/$patientId/history?t=$timestamp',
      );

      if (response != null && response is List && mounted) {
        final bookings = response.map((json) {
          json['patientId'] = patientId;
          return Booking.fromJson(json);
        }).toList();

        if (mounted) {
          setState(() {
            _bookingHistory = bookings;
          });
        }
      }
    } catch (e) {
      print('Force refresh failed: $e');
    }
  }

  Future<void> _loadBookingHistory() async {
    if (!mounted) return;

    try {
      if (mounted) {
        setState(() {
          _isLoading = true;
          _error = null;
          _isOffline = false;
        });
      }

      print('Loading booking history...');

      // Try API first, regardless of network status
      final patientId = await SecureStorageService.readPatientId();

      if (patientId != null && mounted) {
        try {
          final timestamp = DateTime.now().millisecondsSinceEpoch;
          final response = await ApiService.get(
            'patients/$patientId/history?t=$timestamp',
          );

          if (response != null && response is List && mounted) {
            final bookings = response.map((json) {
              json['patientId'] = patientId;
              return Booking.fromJson(json);
            }).toList();

            if (mounted) {
              setState(() {
                _bookingHistory = bookings;
                _isOffline = false;
              });
            }
            return;
          }
        } catch (e) {
          print('API failed: $e');
        }
      }

      // Fallback to offline data
      if (mounted) {
        final offlineBookings = await BookingService.getOfflineBookingHistory();
        if (mounted) {
          setState(() {
            _bookingHistory = offlineBookings;
            _isOffline = true;
          });
        }
      }
    } catch (e) {
      print('Error loading booking history: $e');
      if (mounted) {
        setState(() {
          _error = 'Failed to load booking history';
          _bookingHistory = [];
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;

    return Scaffold(
      backgroundColor: isDarkMode
          ? AppColors.darkBackground
          : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: isDarkMode ? AppColors.darkCard : Colors.white,
        title: Column(
          children: [
            const Text("Booking History"),
            if (_isOffline)
              Text(
                "Offline Mode",
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.orange.shade600,
                  fontWeight: FontWeight.w500,
                ),
              ),
          ],
        ),
        centerTitle: true,
        elevation: 0,
        foregroundColor: isDarkMode ? AppColors.darkText : AppColors.lightText,
        actions: [
          IconButton(
            icon: Icon(
              Icons.refresh,
              color: isDarkMode ? Colors.white70 : Colors.black54,
            ),
            onPressed: _loadBookingHistory,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _buildErrorState(isDarkMode)
          : _buildHistoryContent(isDarkMode),
    );
  }

  Widget _buildErrorState(bool isDarkMode) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.wifi_off,
            size: 64,
            color: isDarkMode ? Colors.grey.shade400 : Colors.grey.shade500,
          ),
          const SizedBox(height: 16),
          Text(
            'Unable to load booking history',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: isDarkMode ? AppColors.darkText : AppColors.lightText,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Please check your connection and try again',
            style: TextStyle(
              fontSize: 14,
              color: isDarkMode ? AppColors.darkSubtext : Colors.grey.shade600,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loadBookingHistory,
            style: ElevatedButton.styleFrom(
              backgroundColor: colors().bluecolor1,
              foregroundColor: Colors.white,
            ),
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryContent(bool isDarkMode) {
    if (_bookingHistory.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.history_toggle_off,
              size: 80,
              color: isDarkMode ? Colors.grey.shade600 : Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'No Booking History',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isDarkMode ? AppColors.darkText : AppColors.lightText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'You haven\'t made any bookings yet',
              style: TextStyle(
                color: isDarkMode
                    ? AppColors.darkSubtext
                    : AppColors.lightSubtext,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12.0),
      itemCount: _bookingHistory.length,
      itemBuilder: (context, index) {
        final booking = _bookingHistory[index];
        return _buildHistoryItem(booking, isDarkMode);
      },
    );
  }

  Widget _buildHistoryItem(Booking booking, bool isDarkMode) {
    final clinicName = booking.clinicName.isNotEmpty
        ? booking.clinicName
        : 'Unknown Clinic';
    final doctorName = booking.doctorName ?? 'No Doctor Assigned';
    final dateTime = booking.servedAt ?? booking.bookedAt;
    final time = _formatTime(dateTime?.toIso8601String() ?? '');
    final status = booking.status;
    final queueNumber = booking.queueNumber?.toString() ?? 'N/A';
    final isServed = status == 'served';

    // Determine status color
    Color statusColor;
    IconData statusIcon;

    switch (status) {
      case 'served':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle;
        break;
      case 'cancelled':
        statusColor = Colors.red;
        statusIcon = Icons.cancel;
        break;
      case 'pending':
        statusColor = Colors.orange;
        statusIcon = Icons.pending;
        break;
      default:
        statusColor = Colors.grey;
        statusIcon = Icons.help;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDarkMode ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDarkMode ? 0.1 : 0.08),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date header
            Text(
              _formatHeaderDate(
                (booking.servedAt ?? booking.bookedAt)?.toIso8601String() ?? '',
              ),
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDarkMode
                    ? AppColors.darkSubtext
                    : Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 8),

            // Service type, queue number and time
            Row(
              children: [
                // Service type badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: colors().bluecolor1.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Doctor Visit',
                    style: TextStyle(
                      color: colors().bluecolor1,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 6),

                // Queue number badge (only show if served)
                if (isServed)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '#$queueNumber',
                      style: TextStyle(
                        color: Colors.green.shade700,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                if (isServed) const SizedBox(width: 6),

                // Time
                Text(
                  time,
                  style: TextStyle(
                    color: isDarkMode
                        ? AppColors.darkSubtext
                        : Colors.grey.shade600,
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                  ),
                ),

                const Spacer(),

                // Status icon
                Icon(statusIcon, color: statusColor, size: 18),
              ],
            ),
            const SizedBox(height: 8),

            // Clinic name
            Text(
              clinicName,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isDarkMode ? AppColors.darkText : AppColors.lightText,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),

            // Doctor name
            Text(
              'Dr. $doctorName',
              style: TextStyle(
                color: isDarkMode
                    ? AppColors.darkSubtext
                    : Colors.grey.shade700,
                fontSize: 13,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),

            // Address
            Row(
              children: [
                Icon(
                  Icons.location_on,
                  size: 14,
                  color: isDarkMode
                      ? Colors.grey.shade500
                      : Colors.grey.shade500,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    _getClinicAddress(booking),
                    style: TextStyle(
                      color: isDarkMode
                          ? AppColors.darkSubtext
                          : Colors.grey.shade600,
                      fontSize: 12,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatHeaderDate(String dateString) {
    try {
      if (dateString.isEmpty) return 'Unknown date';

      final date = DateTime.parse(dateString);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final yesterday = DateTime(now.year, now.month, now.day - 1);
      final dateDay = DateTime(date.year, date.month, date.day);

      if (dateDay == today) {
        return 'Today';
      } else if (dateDay == yesterday) {
        return 'Yesterday';
      } else {
        final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        final months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        return '${days[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
      }
    } catch (e) {
      return 'Unknown date';
    }
  }

  String _formatTime(String dateString) {
    try {
      if (dateString.isEmpty) return 'Unknown time';

      final date = DateTime.parse(dateString);
      final hour = date.hour % 12;
      final minute = date.minute.toString().padLeft(2, '0');
      final period = date.hour < 12 ? 'AM' : 'PM';

      return '${hour == 0 ? 12 : hour}:$minute $period';
    } catch (e) {
      return 'Unknown time';
    }
  }

  String _getClinicAddress(Booking booking) {
    return booking.clinicAddress ?? '123 Medical Street, Healthcare District';
  }
}
