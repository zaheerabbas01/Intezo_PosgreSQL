import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/clinic_provider.dart';
import '../../providers/theme_provider.dart';
import '../res/components/wigets/colors.dart';
import '../res/components/wigets/hospitalinfrom.dart';
import '../res/components/wigets/searchflutter.dart';
import 'doctor_detail_screen.dart';
import '../../services/notification_service.dart';
import '../../services/event_bus.dart';
import '../../main.dart';
import '../../config/api_config.dart';

class TopClinicsDoctorsScreen extends StatefulWidget {
  const TopClinicsDoctorsScreen({super.key});

  @override
  State<TopClinicsDoctorsScreen> createState() => _TopClinicsDoctorsScreenState();
}

class _TopClinicsDoctorsScreenState extends State<TopClinicsDoctorsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Map<String, dynamic>> _clinics = [];
  List<Map<String, dynamic>> _doctors = [];
  List<Map<String, dynamic>> _filteredClinics = [];
  List<Map<String, dynamic>> _filteredDoctors = [];
  bool _isLoading = true;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _setupRealTimeUpdates();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }
  
  void _setupRealTimeUpdates() {
    // Connect to global socket
    SocketService.instance.connect();
    
    // Listen for clinic status updates
    EventBus().onClinicStatusUpdate.listen((event) {
      if (mounted) {
        _updateClinicStatus(event.clinicId, event.statusData);
      }
    });
    
    // Listen for doctor availability updates
    EventBus().onDoctorAvailabilityUpdate.listen((event) {
      if (mounted) {
        _updateDoctorAvailability(event.doctorId, event.isAvailable);
      }
    });
  }
  
  void _updateClinicStatus(String clinicId, Map<String, dynamic> statusData) {
    setState(() {
      final clinicIndex = _clinics.indexWhere((c) => c['_id'] == clinicId);
      if (clinicIndex != -1) {
        _clinics[clinicIndex]['isOpen'] = statusData['isOpen'] ?? true;
      }
      
      final filteredIndex = _filteredClinics.indexWhere((c) => c['_id'] == clinicId);
      if (filteredIndex != -1) {
        _filteredClinics[filteredIndex]['isOpen'] = statusData['isOpen'] ?? true;
      }
    });
  }
  
  void _updateDoctorAvailability(String doctorId, bool isAvailable) {
    setState(() {
      final doctorIndex = _doctors.indexWhere((d) => d['_id'] == doctorId);
      if (doctorIndex != -1) {
        _doctors[doctorIndex]['isAvailable'] = isAvailable;
        // Update clinic availability in doctor's clinics list
        final clinics = _doctors[doctorIndex]['clinics'] as List<Map<String, dynamic>>? ?? [];
        for (var clinic in clinics) {
          clinic['isAvailable'] = isAvailable;
        }
      }
      
      final filteredIndex = _filteredDoctors.indexWhere((d) => d['_id'] == doctorId);
      if (filteredIndex != -1) {
        _filteredDoctors[filteredIndex]['isAvailable'] = isAvailable;
        final clinics = _filteredDoctors[filteredIndex]['clinics'] as List<Map<String, dynamic>>? ?? [];
        for (var clinic in clinics) {
          clinic['isAvailable'] = isAvailable;
        }
      }
    });
  }



  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    
    final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
    
    // Use post frame callback to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await clinicProvider.loadClinics();
      
      if (mounted) {
        setState(() {
          _clinics = clinicProvider.clinics.take(10).toList();
          _filteredClinics = _clinics;
        });
        
        await _loadDoctors();
        
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    });
  }

  Future<void> _loadDoctors() async {
    final clinicProvider = Provider.of<ClinicProvider>(context, listen: false);
    Map<String, Map<String, dynamic>> uniqueDoctors = {};
    
    for (var clinic in _clinics) {
      try {
        final doctors = await clinicProvider.getDoctors(clinic['_id']);
        if (doctors != null && doctors is List) {
          for (var doctor in doctors) {
            if (doctor is Map<String, dynamic>) {
              final doctorId = doctor['_id'];
              if (!uniqueDoctors.containsKey(doctorId)) {
                uniqueDoctors[doctorId] = Map<String, dynamic>.from(doctor);
                uniqueDoctors[doctorId]!['clinics'] = <Map<String, dynamic>>[];
              }
              (uniqueDoctors[doctorId]!['clinics'] as List<Map<String, dynamic>>).add({
                'clinicId': clinic['_id'],
                'clinicName': clinic['name'],
                'clinicAddress': clinic['address'],
                'profilePhoto': clinic['profilePhoto'], // Preserve clinic profile photo
                'isOpen': clinic['isOpen'] ?? true,
                'fee': doctor['consultationFee'] ?? 0,
                'timing': doctor['availableHours'] ?? doctor['timing'] ?? 'Not specified',
                'isAvailable': doctor['isAvailable'] ?? false,
              });
            }
          }
        }
      } catch (e) {
        print('Error loading doctors for clinic ${clinic['name']}: $e');
      }
    }
    
    _doctors = uniqueDoctors.values.take(10).toList();
    _filteredDoctors = _doctors;
  }

  void _filterData(String query) {
    setState(() {
      _searchQuery = query;
      
      if (query.isEmpty) {
        _filteredClinics = _clinics;
        _filteredDoctors = _doctors;
      } else {
        _filteredClinics = _clinics.where((clinic) {
          return clinic['name']?.toLowerCase().contains(query.toLowerCase()) == true ||
                 clinic['address']?.toLowerCase().contains(query.toLowerCase()) == true;
        }).toList();
        
        _filteredDoctors = _doctors.where((doctor) {
          return doctor['name']?.toLowerCase().contains(query.toLowerCase()) == true ||
                 doctor['specialty']?.toLowerCase().contains(query.toLowerCase()) == true ||
                 doctor['clinicName']?.toLowerCase().contains(query.toLowerCase()) == true;
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;
    
    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        backgroundColor: context.cardColor,
        title: Text(
          'Top Clinics & Doctors',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: context.textColor,
          ),
        ),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: colors().bluecolor1,
          unselectedLabelColor: context.subtextColor,
          indicatorColor: colors().bluecolor1,
          tabs: const [
            Tab(text: 'Clinics'),
            Tab(text: 'Doctors'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Search Bar
          Container(
            padding: const EdgeInsets.all(16),
            color: context.cardColor,
            child: TextField(
              controller: _searchController,
              onChanged: _filterData,
              decoration: InputDecoration(
                hintText: _tabController.index == 0 
                    ? 'Search clinics...' 
                    : 'Search doctors...',
                prefixIcon: Icon(Icons.search, color: colors().bluecolor1),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _filterData('');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: colors().bluecolor1.withOpacity(0.3)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: colors().bluecolor1),
                ),
                filled: true,
                fillColor: context.backgroundColor,
              ),
            ),
          ),
          
          // Tab Content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildClinicsTab(),
                      _buildDoctorsTab(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicsTab() {
    if (_filteredClinics.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.business,
              size: 64,
              color: context.subtextColor,
            ),
            const SizedBox(height: 16),
            Text(
              _searchQuery.isEmpty ? 'No clinics available' : 'No clinics found',
              style: TextStyle(
                fontSize: 18,
                color: context.subtextColor,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _filteredClinics.length,
      itemBuilder: (context, index) {
        final clinic = _filteredClinics[index];
        return _buildClinicCard(clinic);
      },
    );
  }

  Widget _buildDoctorsTab() {
    if (_filteredDoctors.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.person,
              size: 64,
              color: context.subtextColor,
            ),
            const SizedBox(height: 16),
            Text(
              _searchQuery.isEmpty ? 'No doctors available' : 'No doctors found',
              style: TextStyle(
                fontSize: 18,
                color: context.subtextColor,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _filteredDoctors.length,
      itemBuilder: (context, index) {
        final doctor = _filteredDoctors[index];
        return _buildDoctorCard(doctor);
      },
    );
  }

  Widget _buildClinicCard(Map<String, dynamic> clinic) {
    final isDarkMode = context.isDarkMode;
    final isOpen = clinic['isOpen'] ?? true;
    
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
      child: InkWell(
        onTap: () => _showClinicDetails(clinic),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: colors().bluecolor1.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(25),
                      child: clinic['profilePhoto'] != null && clinic['profilePhoto'].toString().isNotEmpty
                          ? Image.network(
                              clinic['profilePhoto'].startsWith('https://') 
                                  ? clinic['profilePhoto']
                                  : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${clinic['profilePhoto']}',
                              width: 50,
                              height: 50,
                              fit: BoxFit.cover,
                              loadingBuilder: (context, child, loadingProgress) {
                                if (loadingProgress == null) return child;
                                return Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: colors().bluecolor1.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(25),
                                  ),
                                  child: Center(
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
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
                                  size: 30,
                                );
                              },
                            )
                          : Icon(
                              Icons.business,
                              color: colors().bluecolor1,
                              size: 30,
                            ),
                    ),
                  ),
                  const SizedBox(width: 16),
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
                        const SizedBox(height: 4),
                        if (clinic['address'] != null)
                          Text(
                            clinic['address'],
                            style: TextStyle(
                              fontSize: 14,
                              color: context.subtextColor,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isOpen ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      isOpen ? 'OPEN' : 'CLOSED',
                      style: TextStyle(
                        color: isOpen ? Colors.green : Colors.red,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Icon(Icons.access_time, size: 16, color: context.subtextColor),
                        const SizedBox(width: 8),
                        Text(
                          '${clinic['operatingHours']?['opening'] ?? '09:00'} - ${clinic['operatingHours']?['closing'] ?? '17:00'}',
                          style: TextStyle(
                            fontSize: 14,
                            color: context.subtextColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  FutureBuilder<bool>(
                    future: NotificationService().isClinicNotificationEnabled(clinic['_id']),
                    builder: (context, snapshot) {
                      final isEnabled = snapshot.data ?? false;
                      return GestureDetector(
                        onTap: () async {
                          if (isEnabled) {
                            await NotificationService().removeClinicNotificationWithSync(clinic['_id']);
                          } else {
                            await NotificationService().addClinicNotificationWithSync(clinic['_id'], clinic['name']);
                          }
                          if (mounted) setState(() {});
                        },
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: isEnabled ? Colors.orange : colors().bluecolor1.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            isEnabled ? Icons.notifications_off : Icons.notifications,
                            size: 18,
                            color: isEnabled ? Colors.white : colors().bluecolor1,
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDoctorCard(Map<String, dynamic> doctor) {
    final isDarkMode = context.isDarkMode;
    final clinics = doctor['clinics'] as List<Map<String, dynamic>>? ?? [];
    final hasAvailableClinic = clinics.any((c) => c['isOpen'] == true && c['isAvailable'] == true);
    final clinicCount = clinics.length;
    
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
      child: InkWell(
        onTap: () => _showDoctorDetails(doctor),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: hasAvailableClinic 
                          ? colors().bluecolor1.withOpacity(0.1)
                          : Colors.grey.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(25),
                      child: doctor['profilePhoto'] != null && doctor['profilePhoto'].toString().isNotEmpty
                          ? Image.network(
                              doctor['profilePhoto'].startsWith('https://') 
                                  ? doctor['profilePhoto']
                                  : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${doctor['profilePhoto']}',
                              width: 50,
                              height: 50,
                              fit: BoxFit.cover,
                              loadingBuilder: (context, child, loadingProgress) {
                                if (loadingProgress == null) return child;
                                return Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: (hasAvailableClinic ? colors().bluecolor1 : Colors.grey).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(25),
                                  ),
                                  child: Center(
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(hasAvailableClinic ? colors().bluecolor1 : Colors.grey),
                                      ),
                                    ),
                                  ),
                                );
                              },
                              errorBuilder: (context, error, stackTrace) {
                                return Icon(
                                  Icons.person,
                                  color: hasAvailableClinic ? colors().bluecolor1 : Colors.grey,
                                  size: 30,
                                );
                              },
                            )
                          : Icon(
                              Icons.person,
                              color: hasAvailableClinic ? colors().bluecolor1 : Colors.grey,
                              size: 30,
                            ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          doctor['name'] ?? 'Doctor',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: context.textColor,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          doctor['specialty'] ?? 'General Practitioner',
                          style: TextStyle(
                            fontSize: 14,
                            color: context.subtextColor,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$clinicCount clinic${clinicCount > 1 ? 's' : ''}',
                          style: TextStyle(
                            fontSize: 12,
                            color: colors().bluecolor1,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: hasAvailableClinic ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      hasAvailableClinic ? 'AVAILABLE' : 'BUSY',
                      style: TextStyle(
                        color: hasAvailableClinic ? Colors.green : Colors.orange,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showClinicDetails(Map<String, dynamic> clinic) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        builder: (context, scrollController) => Container(
          decoration: BoxDecoration(
            color: context.cardColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: context.subtextColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Clinic Profile Photo and Name
                      Row(
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: colors().bluecolor1.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(
                                color: colors().bluecolor1,
                                width: 2,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(28),
                              child: clinic['profilePhoto'] != null && clinic['profilePhoto'].toString().isNotEmpty
                                  ? Image.network(
                                      clinic['profilePhoto'].startsWith('https://') 
                                          ? clinic['profilePhoto']
                                          : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${clinic['profilePhoto']}',
                                      width: 56,
                                      height: 56,
                                      fit: BoxFit.cover,
                                      loadingBuilder: (context, child, loadingProgress) {
                                        if (loadingProgress == null) return child;
                                        return Container(
                                          width: 56,
                                          height: 56,
                                          decoration: BoxDecoration(
                                            color: colors().bluecolor1.withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(28),
                                          ),
                                          child: Center(
                                            child: SizedBox(
                                              width: 24,
                                              height: 24,
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
                                          size: 32,
                                        );
                                      },
                                    )
                                  : Icon(
                                      Icons.business,
                                      color: colors().bluecolor1,
                                      size: 32,
                                    ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Text(
                              clinic['name'] ?? 'Clinic',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: context.textColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (clinic['address'] != null) ...[
                        Row(
                          children: [
                            Icon(Icons.location_on, color: colors().bluecolor1),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                clinic['address'],
                                style: TextStyle(
                                  fontSize: 16,
                                  color: context.subtextColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],
                      Row(
                        children: [
                          Icon(Icons.access_time, color: colors().bluecolor1),
                          const SizedBox(width: 8),
                          Text(
                            '${clinic['operatingHours']?['opening'] ?? '09:00'} - ${clinic['operatingHours']?['closing'] ?? '17:00'}',
                            style: TextStyle(
                              fontSize: 16,
                              color: context.subtextColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      FutureBuilder<bool>(
                        future: NotificationService().isClinicNotificationEnabled(clinic['_id']),
                        builder: (context, snapshot) {
                          final isEnabled = snapshot.data ?? false;
                          final isOpen = clinic['isOpen'] ?? true;
                          return SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: isOpen ? null : () async {
                                if (isEnabled) {
                                  await NotificationService().removeClinicNotificationWithSync(clinic['_id']);
                                } else {
                                  await NotificationService().addClinicNotificationWithSync(clinic['_id'], clinic['name']);
                                }
                                Navigator.pop(context);
                                setState(() {});
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isOpen ? Colors.grey : (isEnabled ? Colors.orange : colors().bluecolor1.withOpacity(0.1)),
                                foregroundColor: isOpen ? Colors.white : (isEnabled ? Colors.white : colors().bluecolor1),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                side: BorderSide(color: isOpen ? Colors.grey : (isEnabled ? Colors.orange : colors().bluecolor1)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(isOpen ? Icons.check : (isEnabled ? Icons.notifications_off : Icons.notifications), size: 20),
                                  const SizedBox(width: 8),
                                  Text(isOpen ? 'Clinic is Open' : (isEnabled ? 'Remove Notification' : 'Notify When Open')),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => HospitalInform(clinic: clinic),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors().bluecolor1,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Visit Clinic',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDoctorDetails(Map<String, dynamic> doctor) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DoctorDetailScreen(doctor: doctor),
      ),
    );
  }
}