import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/clinic_provider.dart';
import '../../providers/theme_provider.dart';
import '../../config/api_config.dart';
import '../res/components/wigets/colors.dart';
import '../res/components/wigets/hospitalinfrom.dart';
import '../../services/notification_service.dart';

class DoctorDetailScreen extends StatefulWidget {
  final Map<String, dynamic> doctor;

  const DoctorDetailScreen({super.key, required this.doctor});

  @override
  State<DoctorDetailScreen> createState() => _DoctorDetailScreenState();
}

class _DoctorDetailScreenState extends State<DoctorDetailScreen> {
  List<Map<String, dynamic>> _doctorClinics = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDoctorClinics();
  }

  Future<void> _loadDoctorClinics() async {
    setState(() => _isLoading = true);
    
    try {
      // If doctor already has clinics data from the list, use it
      if (widget.doctor['clinics'] != null) {
        final clinics = widget.doctor['clinics'] as List<Map<String, dynamic>>;
        setState(() {
          _doctorClinics = clinics.map((c) => {
            'clinic': {
              '_id': c['clinicId'],
              'name': c['clinicName'],
              'address': c['clinicAddress'],
              'profilePhoto': c['profilePhoto'], // Include clinic profile photo
              'isOpen': c['isOpen'],
            },
            'fee': c['fee'],
            'timing': c['timing'],
            'isAvailable': c['isOpen'] == true ? c['isAvailable'] : false,
            'isActive': true,
          }).toList();
          _isLoading = false;
        });
        return;
      }
      
      // Fallback to loading from API
      final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
      await clinicProvider.loadClinics();
      List<Map<String, dynamic>> doctorClinics = [];
      
      for (var clinic in clinicProvider.clinics) {
        try {
          final doctors = await clinicProvider.getDoctors(clinic['_id']);
          if (doctors != null && doctors is List) {
            final doctorExists = doctors.any((d) => d['_id'] == widget.doctor['_id']);
            if (doctorExists) {
              final doctorInClinic = doctors.firstWhere((d) => d['_id'] == widget.doctor['_id']);
              
              doctorClinics.add({
                'clinic': clinic,
                'fee': doctorInClinic['consultationFee'] ?? 0,
                'timing': doctorInClinic['availableHours'] ?? doctorInClinic['timing'] ?? 'Not specified',
                'isAvailable': (clinic['isOpen'] ?? true) ? (doctorInClinic['isAvailable'] ?? false) : false,
                'isActive': doctorInClinic['isActive'] ?? true,
              });
            }
          }
        } catch (e) {
          print('Error loading doctors for clinic ${clinic['name']}: $e');
        }
      }
      
      setState(() {
        _doctorClinics = doctorClinics;
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading doctor clinics: $e');
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;
    final isAvailable = widget.doctor['isAvailable'] ?? true;
    
    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        backgroundColor: context.cardColor,
        title: Text(
          widget.doctor['name'] ?? 'Doctor',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: context.textColor,
          ),
        ),
        elevation: 0,
        foregroundColor: context.textColor,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Doctor Info Card
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: context.cardColor,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: isAvailable 
                            ? colors().bluecolor1.withOpacity(0.1)
                            : Colors.grey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(40),
                        border: Border.all(
                          color: isAvailable ? colors().bluecolor1 : Colors.grey,
                          width: 2,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(38),
                        child: widget.doctor['profilePhoto'] != null
                            ? Image.network(
                                widget.doctor['profilePhoto'].startsWith('https://') 
                                    ? widget.doctor['profilePhoto']
                                    : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${widget.doctor['profilePhoto']}',
                                width: 76,
                                height: 76,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Icon(
                                    Icons.person,
                                    color: isAvailable ? colors().bluecolor1 : Colors.grey,
                                    size: 40,
                                  );
                                },
                              )
                            : Icon(
                                Icons.person,
                                color: isAvailable ? colors().bluecolor1 : Colors.grey,
                                size: 40,
                              ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      widget.doctor['name'] ?? 'Doctor',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: context.textColor,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.doctor['specialty'] ?? 'General Practitioner',
                      style: TextStyle(
                        fontSize: 16,
                        color: colors().bluecolor1,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isAvailable ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isAvailable ? Colors.green.withOpacity(0.3) : Colors.orange.withOpacity(0.3),
                        ),
                      ),
                      child: Text(
                        isAvailable ? 'Currently Available' : 'Currently Busy',
                        style: TextStyle(
                          color: isAvailable ? Colors.green : Colors.orange,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    FutureBuilder<bool>(
                      future: NotificationService().isDoctorNotificationEnabled(widget.doctor['_id']),
                      builder: (context, snapshot) {
                        final isEnabled = snapshot.data ?? false;
                        final isAvailable = widget.doctor['isAvailable'] ?? true;
                        return SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: isAvailable ? null : () async {
                              if (isEnabled) {
                                await NotificationService().removeDoctorNotification(widget.doctor['_id']);
                              } else {
                                await NotificationService().addDoctorNotification(widget.doctor['_id'], widget.doctor['name']);
                              }
                              if (mounted) setState(() {});
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isAvailable ? Colors.grey : (isEnabled ? Colors.orange : colors().bluecolor1.withOpacity(0.1)),
                              foregroundColor: isAvailable ? Colors.white : (isEnabled ? Colors.white : colors().bluecolor1),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              side: BorderSide(color: isAvailable ? Colors.grey : (isEnabled ? Colors.orange : colors().bluecolor1)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(isAvailable ? Icons.check : (isEnabled ? Icons.notifications_off : Icons.notifications), size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  isAvailable ? 'Doctor Available' : (isEnabled ? 'Remove Notification' : 'Notify When Available'),
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Doctor Information
            if (widget.doctor['experience'] != null || widget.doctor['education'] != null) ...[
              Text(
                'About Doctor',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: context.textColor,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: context.cardColor,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (widget.doctor['experience'] != null) ...[
                        Row(
                          children: [
                            Icon(Icons.work, color: colors().bluecolor1, size: 20),
                            const SizedBox(width: 12),
                            Text(
                              'Experience: ${widget.doctor['experience']} years',
                              style: TextStyle(
                                fontSize: 16,
                                color: context.textColor,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (widget.doctor['education'] != null) ...[
                        Row(
                          children: [
                            Icon(Icons.school, color: colors().bluecolor1, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Education: ${widget.doctor['education']}',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: context.textColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
            
            // Clinics Section
            Text(
              'Available at Clinics',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: context.textColor,
              ),
            ),
            const SizedBox(height: 12),
            
            if (_isLoading)
              const Center(child: CircularProgressIndicator())
            else if (_doctorClinics.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: context.cardColor,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.business,
                      size: 48,
                      color: context.subtextColor,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No clinics found',
                      style: TextStyle(
                        fontSize: 16,
                        color: context.subtextColor,
                      ),
                    ),
                  ],
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _doctorClinics.length,
                itemBuilder: (context, index) {
                  final clinicData = _doctorClinics[index];
                  final clinic = clinicData['clinic'];
                  final fee = clinicData['fee'];
                  final timing = clinicData['timing'];
                  final isClinicAvailable = clinicData['isAvailable'] && clinicData['isActive'];
                  final isClinicOpen = clinic['isOpen'] ?? true;
                  
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: context.cardColor,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(isDarkMode ? 0.3 : 0.1),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: colors().bluecolor1.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(20),
                                  child: clinic['profilePhoto'] != null && clinic['profilePhoto'].toString().isNotEmpty
                                      ? Image.network(
                                          clinic['profilePhoto'].startsWith('https://') 
                                              ? clinic['profilePhoto']
                                              : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${clinic['profilePhoto']}',
                                          width: 40,
                                          height: 40,
                                          fit: BoxFit.cover,
                                          loadingBuilder: (context, child, loadingProgress) {
                                            if (loadingProgress == null) return child;
                                            return Container(
                                              width: 40,
                                              height: 40,
                                              decoration: BoxDecoration(
                                                color: colors().bluecolor1.withOpacity(0.1),
                                                borderRadius: BorderRadius.circular(20),
                                              ),
                                              child: Center(
                                                child: SizedBox(
                                                  width: 16,
                                                  height: 16,
                                                  child: CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                    valueColor: AlwaysStoppedAnimation<Color>(colors().bluecolor1),
                                                  ),
                                                ),
                                              ),
                                            );
                                          },
                                          errorBuilder: (context, error, stackTrace) {
                                            return Icon(
                                              Icons.business,
                                              color: colors().bluecolor1,
                                              size: 24,
                                            );
                                          },
                                        )
                                      : Icon(
                                          Icons.business,
                                          color: colors().bluecolor1,
                                          size: 24,
                                        ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      clinic['name'] ?? 'Clinic',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: context.textColor,
                                      ),
                                    ),
                                    if (clinic['address'] != null)
                                      Text(
                                        clinic['address'],
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: context.subtextColor,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                  ],
                                ),
                              ),
                              Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isClinicOpen ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      isClinicOpen ? 'OPEN' : 'CLOSED',
                                      style: TextStyle(
                                        color: isClinicOpen ? Colors.green : Colors.red,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: isClinicAvailable ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      isClinicAvailable ? 'AVAILABLE' : 'BUSY',
                                      style: TextStyle(
                                        color: isClinicAvailable ? Colors.green : Colors.orange,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.monetization_on, size: 16, color: context.subtextColor),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Fee: PKR $fee',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: context.subtextColor,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(Icons.access_time, size: 16, color: context.subtextColor),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Timing: $timing',
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: context.subtextColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => HospitalInform(clinic: clinic),
                                  ),
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: colors().bluecolor1,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              child: const Text(
                                'Visit Clinic',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}