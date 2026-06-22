// lib/fronted/res/components/wigets/home/hospital_sugest.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../providers/clinic_provider.dart';
import '../../../../../providers/theme_provider.dart';
import '../../../../../config/api_config.dart';
import '../../../../../services/preload_service.dart';
import '../../../../../services/event_bus.dart';
import '../../../../../services/socket_service.dart';
import '../../../../../services/secure_storage_service.dart';
import '../hospitalinfrom.dart';
import '../../../../../services/notification_service.dart';

class Hospital_Suggestion extends StatefulWidget {
  final List<dynamic> clinics;
  final int maxClinicsToShow;

  const Hospital_Suggestion({
    super.key,
    required this.clinics,
    this.maxClinicsToShow = 5,
  });

  @override
  State<Hospital_Suggestion> createState() => _Hospital_SuggestionState();
}

class _Hospital_SuggestionState extends State<Hospital_Suggestion> {
  List<dynamic> _previouslyBookedClinics = [];

  @override
  void initState() {
    super.initState();
    _loadPreviouslyBookedClinics();
    _listenToClinicStatusUpdates();
    _connectSocket();
  }

  void _connectSocket() async {
    // Connect to socket for real-time updates
    final socketService = SocketService.instance;
    if (!socketService.isConnected) {
      await socketService.connect();
    }
  }

  void _listenToClinicStatusUpdates() {
    EventBus().onClinicStatusUpdate.listen((event) {
      if (mounted) {
        setState(() {
          // Update clinic status in real-time
          for (var clinic in _previouslyBookedClinics) {
            if (clinic['id'] == event.clinicId) {
              clinic['isOpen'] = event.statusData['isOpen'];
              clinic['lastStatusChange'] = event.statusData['lastStatusChange'];
            }
          }
        });
      }
    });
  }

  Future<void> _loadPreviouslyBookedClinics() async {
    try {
      final patientId = await SecureStorageService.readPatientId();

      if (patientId == null) return;

      // Get preloaded data instantly
      final cachedClinics = await PreloadService.getCachedRecentClinics(
        patientId,
      );

      if (cachedClinics.isNotEmpty) {
        _previouslyBookedClinics = widget.clinics.where((clinic) {
          return cachedClinics.any((c) => c['id'] == clinic['id']);
        }).toList();

        // Sort by cached order (most recent first)
        _previouslyBookedClinics.sort((a, b) {
          final aIndex = cachedClinics.indexWhere((c) => c['id'] == a['id']);
          final bIndex = cachedClinics.indexWhere((c) => c['id'] == b['id']);
          return aIndex.compareTo(bIndex);
        });

        if (mounted) setState(() {});
      }

      // Trigger background refresh for next time
      PreloadService.preloadRecentClinics(patientId);
    } catch (e) {
      _previouslyBookedClinics = [];
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;
    final cardColor = context.cardColor;
    final textColor = context.textColor;
    final subtextColor = context.subtextColor;

    // Only show previously booked clinics
    final displayedClinics = _previouslyBookedClinics
        .take(widget.maxClinicsToShow)
        .toList();

    if (displayedClinics.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(Icons.history, size: 48, color: subtextColor),
            const SizedBox(height: 12),
            Text('No recent visits', style: TextStyle(color: subtextColor)),
            const SizedBox(height: 8),
            Text(
              'Visit a clinic to see it here',
              style: TextStyle(
                color: subtextColor.withOpacity(0.7),
                fontSize: 12,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: displayedClinics.length,
          itemBuilder: (context, index) {
            final clinic = displayedClinics[index];
            // Use Provider to get real-time status updates
            return Consumer<ClinicProvider>(
              builder: (context, clinicProvider, child) {
                // Find the latest clinic data from provider
                final updatedClinic = clinicProvider.clinics.firstWhere(
                  (c) => c['id'] == clinic['id'],
                  orElse: () => clinic,
                );

                final isOpen = updatedClinic['isOpen'] ?? true;
                final clinicName = updatedClinic['name'] ?? 'Unknown Clinic';
                final clinicAddress = updatedClinic['address'] ?? 'No address';
                final clinicDistance = updatedClinic['distance'] != null
                    ? '${updatedClinic['distance'].toStringAsFixed(1)} km away'
                    : 'Distance not available';

                return Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: cardColor,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                        spreadRadius: 1,
                        blurRadius: 5,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: ListTile(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              HospitalInform(clinic: updatedClinic),
                        ),
                      );
                    },
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    leading: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        color: isOpen
                            ? context.primaryColor.withOpacity(0.1)
                            : Colors.grey.withOpacity(0.1),
                        border: Border.all(
                          color: isOpen ? context.primaryColor : Colors.grey,
                          width: 1,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(9),
                        child: updatedClinic['profilePhoto'] != null
                            ? Image.network(
                                updatedClinic['profilePhoto'].startsWith(
                                      'https://',
                                    )
                                    ? updatedClinic['profilePhoto']
                                    : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${updatedClinic['profilePhoto']}',
                                width: 48,
                                height: 48,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Center(
                                    child: Icon(
                                      Icons.local_hospital_outlined,
                                      color: isOpen
                                          ? context.primaryColor
                                          : Colors.grey,
                                      size: 28,
                                    ),
                                  );
                                },
                              )
                            : Center(
                                child: Icon(
                                  Icons.local_hospital_outlined,
                                  color: isOpen
                                      ? context.primaryColor
                                      : Colors.grey,
                                  size: 28,
                                ),
                              ),
                      ),
                    ),
                    title: Text(
                      clinicName,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: textColor,
                      ),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(
                          clinicAddress,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: subtextColor,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          clinicDistance,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w400,
                            color: subtextColor.withOpacity(0.8),
                          ),
                        ),
                      ],
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (!isOpen)
                              FutureBuilder<bool>(
                                future: NotificationService()
                                    .isClinicNotificationEnabled(clinic['id']),
                                builder: (context, snapshot) {
                                  final isEnabled = snapshot.data ?? false;
                                  return GestureDetector(
                                    onTap: () async {
                                      if (isEnabled) {
                                        await NotificationService()
                                            .removeClinicNotificationWithSync(
                                              clinic['id'],
                                            );
                                      } else {
                                        await NotificationService()
                                            .addClinicNotificationWithSync(
                                              clinic['id'],
                                              clinicName,
                                            );
                                      }
                                      setState(() {});
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: BoxDecoration(
                                        color: isEnabled
                                            ? Colors.orange
                                            : context.primaryColor.withOpacity(
                                                0.1,
                                              ),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Icon(
                                        isEnabled
                                            ? Icons.notifications_off
                                            : Icons.notifications,
                                        size: 14,
                                        color: isEnabled
                                            ? Colors.white
                                            : context.primaryColor,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: isOpen
                                    ? Colors.green.withOpacity(
                                        isDarkMode ? 0.2 : 0.1,
                                      )
                                    : Colors.red.withOpacity(
                                        isDarkMode ? 0.2 : 0.1,
                                      ),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isOpen
                                      ? Colors.green.withOpacity(
                                          isDarkMode ? 0.5 : 0.3,
                                        )
                                      : Colors.red.withOpacity(
                                          isDarkMode ? 0.5 : 0.3,
                                        ),
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                isOpen ? 'OPEN' : 'CLOSED',
                                style: TextStyle(
                                  color: isOpen ? Colors.green : Colors.red,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Previously visited',
                            style: TextStyle(
                              fontSize: 10,
                              color: context.primaryColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }
}
