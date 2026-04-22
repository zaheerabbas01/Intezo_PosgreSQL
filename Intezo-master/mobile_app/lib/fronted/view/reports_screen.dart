import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/patient_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/api_service.dart';
import '../res/components/wigets/colors.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  List<dynamic> reports = [];
  bool isLoading = true;
  String? error;
  int currentPage = 1;
  bool hasMoreData = true;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadReports();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels == _scrollController.position.maxScrollExtent) {
      if (hasMoreData && !isLoading) {
        _loadMoreReports();
      }
    }
  }

  Future<void> _loadReports() async {
    try {
      setState(() {
        isLoading = true;
        error = null;
      });

      final response = await ApiService.getPatientReports(page: 1);
      
      setState(() {
        reports = response['reports'] ?? [];
        currentPage = 1;
        final currentPageInt = int.tryParse(response['currentPage']?.toString() ?? '1') ?? 1;
        final totalPagesInt = int.tryParse(response['totalPages']?.toString() ?? '1') ?? 1;
        hasMoreData = currentPageInt < totalPagesInt;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        isLoading = false;
      });
    }
  }

  Future<void> _loadMoreReports() async {
    try {
      setState(() {
        isLoading = true;
      });

      final response = await ApiService.getPatientReports(page: currentPage + 1);
      
      setState(() {
        reports.addAll(response['reports'] ?? []);
        currentPage++;
        final totalPagesInt = int.tryParse(response['totalPages']?.toString() ?? '1') ?? 1;
        hasMoreData = currentPage < totalPagesInt;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading more reports: $e')),
      );
    }
  }

  Future<void> _downloadReport(String reportId, String title) async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Downloading...')),
      );

      // Request storage permission
      if (Platform.isAndroid) {
        final status = await Permission.storage.request();
        if (!status.isGranted) {
          throw 'Storage permission denied';
        }
      }

      // Download the PDF bytes
      final pdfBytes = await ApiService.downloadReportBytes(reportId);
      
      // Get downloads directory
      Directory? directory;
      if (Platform.isAndroid) {
        directory = Directory('/storage/emulated/0/Download');
        if (!await directory.exists()) {
          directory = await getExternalStorageDirectory();
        }
      } else {
        directory = await getApplicationDocumentsDirectory();
      }

      if (directory != null) {
        final fileName = 'medical_report_${title.replaceAll(RegExp(r'[^\w\s-]'), '')}_${DateTime.now().millisecondsSinceEpoch}.pdf';
        final file = File('${directory.path}/$fileName');
        
        await file.writeAsBytes(pdfBytes);
        
        // Mark as read
        await ApiService.markReportAsRead(reportId);
        _loadReports(); // Refresh to update read status
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Downloaded: $fileName'),
            duration: const Duration(seconds: 3),
            action: SnackBarAction(
              label: 'Open Folder',
              onPressed: () {
                // You can add logic to open file manager here if needed
              },
            ),
          ),
        );
      } else {
        throw 'Could not access storage directory';
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error downloading report: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context){
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        title: const Text("Medical Reports", style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: context.cardColor,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _loadReports,
            icon: Icon(Icons.refresh, color: isDarkMode ? Colors.white70 : Colors.black54),
          ),
        ],
      ),
      body: _buildBody(isDarkMode),
    );
  }

  Widget _buildBody(bool isDarkMode) {
    if (isLoading && reports.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (error != null && reports.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red.shade400),
            const SizedBox(height: 16),
            Text('Error loading reports', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text(error!, style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _loadReports,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (reports.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.description_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text('No reports available', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text('Your medical reports will appear here', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadReports,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: reports.length + (hasMoreData ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == reports.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }

          final report = reports[index];
          return _buildReportCard(report, isDarkMode);
        },
      ),
    );
  }

  Widget _buildReportCard(dynamic report, bool isDarkMode) {
    final isRead = report['isRead'] ?? false;
    final createdAt = DateTime.parse(report['createdAt']);
    final visitDate = report['visitDate'] != null 
        ? DateTime.parse(report['visitDate']) 
        : createdAt;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: context.cardColor,
      child: InkWell(
        onTap: () => _showReportDetails(report),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      report['title'] ?? 'Medical Report',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: context.textColor,
                      ),
                    ),
                  ),
                  if (!isRead)
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: colors().bluecolor1,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              
              // Clinic and Doctor info
              Row(
                children: [
                  Icon(Icons.local_hospital, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      report['clinic']?['name'] ?? 'Unknown Clinic',
                      style: TextStyle(
                        fontSize: 14,
                        color: context.subtextColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              
              Row(
                children: [
                  Icon(Icons.person, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Dr. ${report['doctor']?['name'] ?? 'Unknown Doctor'}',
                      style: TextStyle(
                        fontSize: 14,
                        color: context.subtextColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              
              // Diagnosis preview
              if (report['diagnosis'] != null)
                Text(
                  report['diagnosis'],
                  style: TextStyle(
                    fontSize: 14,
                    color: context.textColor,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              
              const SizedBox(height: 12),
              
              // Date and actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Visit: ${visitDate.day}/${visitDate.month}/${visitDate.year}',
                    style: TextStyle(
                      fontSize: 12,
                      color: context.subtextColor,
                    ),
                  ),
                  Row(
                    children: [
                      TextButton.icon(
                        onPressed: () => _showReportDetails(report),
                        icon: const Icon(Icons.visibility, size: 16),
                        label: const Text('View'),
                        style: TextButton.styleFrom(
                          foregroundColor: colors().bluecolor1,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () => _downloadReport(report['_id'], report['title'] ?? 'report'),
                        icon: const Icon(Icons.download, size: 16),
                        label: const Text('Download'),
                        style: TextButton.styleFrom(
                          foregroundColor: colors().bluecolor1,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showReportDetails(dynamic report) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildReportDetailsModal(report),
    );
  }

  Widget _buildReportDetailsModal(dynamic report) {
    final visitDate = report['visitDate'] != null 
        ? DateTime.parse(report['visitDate']) 
        : DateTime.parse(report['createdAt']);

    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: BoxDecoration(
        color: context.cardColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    report['title'] ?? 'Medical Report',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: context.textColor,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          
          const Divider(),
          
          // Content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDetailSection('Clinic Information', [
                    _buildDetailRow('Clinic', report['clinic']?['name'] ?? 'Unknown'),
                    _buildDetailRow('Doctor', 'Dr. ${report['doctor']?['name'] ?? 'Unknown'}'),
                    _buildDetailRow('Visit Date', '${visitDate.day}/${visitDate.month}/${visitDate.year}'),
                  ]),
                  
                  const SizedBox(height: 20),
                  
                  _buildDetailSection('Diagnosis', [
                    Text(
                      report['diagnosis'] ?? 'No diagnosis provided',
                      style: TextStyle(
                        fontSize: 14,
                        color: context.textColor,
                      ),
                    ),
                  ]),
                  
                  if (report['symptoms'] != null && report['symptoms'].isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildDetailSection('Symptoms', [
                      Text(
                        report['symptoms'],
                        style: TextStyle(
                          fontSize: 14,
                          color: context.textColor,
                        ),
                      ),
                    ]),
                  ],
                  
                  if (report['treatment'] != null && report['treatment'].isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildDetailSection('Treatment', [
                      Text(
                        report['treatment'],
                        style: TextStyle(
                          fontSize: 14,
                          color: context.textColor,
                        ),
                      ),
                    ]),
                  ],
                  
                  if (report['medications'] != null && (report['medications'] as List).isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildDetailSection('Medications', 
                      (report['medications'] as List).map((med) => 
                        _buildMedicationItem(med)
                      ).toList(),
                    ),
                  ],
                  
                  if (report['recommendations'] != null && report['recommendations'].isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildDetailSection('Recommendations', [
                      Text(
                        report['recommendations'],
                        style: TextStyle(
                          fontSize: 14,
                          color: context.textColor,
                        ),
                      ),
                    ]),
                  ],
                  
                  if (report['notes'] != null && report['notes'].isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildDetailSection('Additional Notes', [
                      Text(
                        report['notes'],
                        style: TextStyle(
                          fontSize: 14,
                          color: context.textColor,
                        ),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
          ),
          
          // Action buttons
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _downloadReport(report['_id'], report['title'] ?? 'report'),
                    icon: const Icon(Icons.download),
                    label: const Text('Download PDF'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors().bluecolor1,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: context.textColor,
          ),
        ),
        const SizedBox(height: 8),
        ...children,
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              '$label:',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: context.subtextColor,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: context.textColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMedicationItem(dynamic medication) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            medication['name'] ?? 'Unknown Medication',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: context.textColor,
            ),
          ),
          if (medication['dosage'] != null) ...[
            const SizedBox(height: 4),
            Text(
              'Dosage: ${medication['dosage']}',
              style: TextStyle(
                fontSize: 12,
                color: context.subtextColor,
              ),
            ),
          ],
          if (medication['frequency'] != null) ...[
            const SizedBox(height: 2),
            Text(
              'Frequency: ${medication['frequency']}',
              style: TextStyle(
                fontSize: 12,
                color: context.subtextColor,
              ),
            ),
          ],
          if (medication['duration'] != null) ...[
            const SizedBox(height: 2),
            Text(
              'Duration: ${medication['duration']}',
              style: TextStyle(
                fontSize: 12,
                color: context.subtextColor,
              ),
            ),
          ],
        ],
      ),
    );
  }
}