// lib/fronted/res/components/wigets/doctor_selection_modal.dart
import 'package:flutter/material.dart';

import '../../../../providers/theme_provider.dart';
import '../../../../config/api_config.dart';

class DoctorSelectionModal extends StatefulWidget {
  final List<Map<String, dynamic>> doctors;
  final Map<String, Map<String, dynamic>> doctorQueues;
  final Function(Map<String, dynamic>) onDoctorSelected;
  final int Function(int, Map<String, dynamic>?) calculateNextNumber;

  const DoctorSelectionModal({
    super.key,
    required this.doctors,
    required this.doctorQueues,
    required this.onDoctorSelected,
    required this.calculateNextNumber,
  });

  @override
  State<DoctorSelectionModal> createState() => _DoctorSelectionModalState();
}

class _DoctorSelectionModalState extends State<DoctorSelectionModal> {
  String _searchQuery = '';
  List<Map<String, dynamic>> _filteredDoctors = [];
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _filteredDoctors = widget.doctors;
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.cardColor,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 5,
            decoration: BoxDecoration(
              color: context.isDarkMode ? Colors.grey.shade700 : Colors.grey.shade300,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 16),

          // Title and close button
          Row(
            children: [
              Text(
                'Select Doctor',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: context.textColor,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: Icon(Icons.close, color: context.textColor),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),

          // Search bar
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: isDarkMode ? Colors.grey.shade800 : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search doctors by name or specialty...',
                hintStyle: TextStyle(color: context.subtextColor),
                prefixIcon: Icon(Icons.search, color: context.subtextColor),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              style: TextStyle(color: context.textColor),
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                  _filteredDoctors = widget.doctors.where((doctor) {
                    final name = doctor['name']?.toString().toLowerCase() ?? '';
                    final specialty = doctor['specialty']?.toString().toLowerCase() ?? '';
                    return name.contains(_searchQuery.toLowerCase()) ||
                        specialty.contains(_searchQuery.toLowerCase());
                  }).toList();
                });
              },
            ),
          ),

          // Doctor count
          Row(
            children: [
              Text(
                '${_filteredDoctors.length} of ${widget.doctors.length} doctors',
                style: TextStyle(
                  fontSize: 12,
                  color: context.subtextColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Doctors list
          Expanded(
            child: _filteredDoctors.isEmpty
                ? Center(
              child: Text(
                'No doctors found',
                style: TextStyle(
                  fontSize: 16,
                  color: context.subtextColor,
                ),
              ),
            )
                : ListView.builder(
              controller: _scrollController,
              shrinkWrap: true,
              itemCount: _filteredDoctors.length,
              itemBuilder: (context, index) {
                final doctor = _filteredDoctors[index];
                final doctorQueue = widget.doctorQueues[doctor['_id']] ??
                    {'current': 0, 'nextNumber': 1, 'totalWaiting': 0};

                return _buildDoctorCard(
                  doctor: doctor,
                  currentServing: doctorQueue['current'] ?? 0,
                  nextNumber: widget.calculateNextNumber(
                    doctorQueue['current'] ?? 0,
                    doctorQueue,
                  ),
                  totalWaiting: doctorQueue['totalWaiting'] ?? 0,
                  onTap: () {
                    widget.onDoctorSelected(doctor);
                    Navigator.pop(context);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDoctorCard({
    required Map<String, dynamic> doctor,
    required int currentServing,
    required int nextNumber,
    required int totalWaiting,
    required VoidCallback onTap,
  }) {
    final bool isAvailable = doctor['isAvailable'] ?? true;
    final bool isActive = doctor['isActive'] ?? true;
    final isDarkMode = context.isDarkMode;

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
        onTap: isAvailable && isActive ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: isAvailable && isActive ? 1.0 : 0.6,
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: (!isAvailable || !isActive)
                            ? isDarkMode ? Colors.grey.shade700 : Colors.grey.shade300
                            : context.primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(25),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(25),
                        child: doctor['profilePhoto'] != null
                            ? Image.network(
                                doctor['profilePhoto'].startsWith('https://') 
                                    ? doctor['profilePhoto']
                                    : '${ApiConfig.currentBaseUrl.replaceAll('/api', '')}${doctor['profilePhoto']}',
                                width: 50,
                                height: 50,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Icon(
                                    Icons.person,
                                    color: (!isAvailable || !isActive)
                                        ? Colors.grey
                                        : context.primaryColor,
                                    size: 30,
                                  );
                                },
                              )
                            : Icon(
                                Icons.person,
                                color: (!isAvailable || !isActive)
                                    ? Colors.grey
                                    : context.primaryColor,
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
                              color: (!isAvailable || !isActive)
                                  ? context.subtextColor
                                  : context.textColor,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            doctor['specialty'] ?? 'General Practitioner',
                            style: TextStyle(
                              fontSize: 14,
                              color: (!isAvailable || !isActive)
                                  ? context.subtextColor.withOpacity(0.7)
                                  : context.subtextColor,
                            ),
                          ),
                          if (!isAvailable || !isActive)
                            Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Text(
                                !isActive ? 'Not Active' : 'Not Available',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.red,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right,
                      color: context.subtextColor,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Queue information for this doctor
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDarkMode ? Colors.grey.shade800 : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildQueueInfoItem('Serving', '$currentServing'),
                      _buildQueueInfoItem('Next', '$nextNumber'),
                      _buildQueueInfoItem('Waiting', '$totalWaiting'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQueueInfoItem(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 12, color: context.subtextColor),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: context.primaryColor,
          ),
        ),
      ],
    );
  }
}