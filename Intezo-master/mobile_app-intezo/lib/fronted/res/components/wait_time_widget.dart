import 'package:flutter/material.dart';
import '../../../services/wait_time_service.dart';

class WaitTimeWidget extends StatefulWidget {
  final String clinicId;
  final String doctorId;
  final bool showDetailed;
  final EdgeInsets? padding;

  const WaitTimeWidget({
    super.key,
    required this.clinicId,
    required this.doctorId,
    this.showDetailed = false,
    this.padding,
  });

  @override
  State<WaitTimeWidget> createState() => _WaitTimeWidgetState();
}

class _WaitTimeWidgetState extends State<WaitTimeWidget> {
  Map<String, dynamic>? _waitTimeData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadWaitTime();
  }

  Future<void> _loadWaitTime() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final waitTime = await WaitTimeService.getWaitTime(
        widget.clinicId,
        widget.doctorId,
      );

      if (mounted) {
        setState(() {
          _waitTimeData = waitTime;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load wait time';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        padding: widget.padding ?? const EdgeInsets.all(12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 8),
            Text(
              'Loading wait time...',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    if (_error != null || _waitTimeData == null) {
      return Container(
        padding: widget.padding ?? const EdgeInsets.all(12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.info_outline, size: 16, color: Colors.grey[600]),
            const SizedBox(width: 8),
            Text(
              'Wait time unavailable',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: widget.padding ?? const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: widget.showDetailed ? _buildDetailedView() : _buildSimpleView(),
    );
  }

  Widget _buildSimpleView() {
    final totalWaiting = _waitTimeData!['totalWaiting'] ?? 0;
    final avgProcessTime = _waitTimeData!['avgProcessTimeMinutes'] ?? 15;
    final estimatedTime = WaitTimeService.formatWaitTime(
      totalWaiting * avgProcessTime,
    );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.access_time, size: 16, color: Colors.blue.shade700),
        const SizedBox(width: 6),
        Text(
          totalWaiting == 0 ? 'No wait' : estimatedTime,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.blue.shade700,
          ),
        ),
        if (totalWaiting > 0) ...[
          const SizedBox(width: 4),
          Text(
            '($totalWaiting waiting)',
            style: TextStyle(fontSize: 11, color: Colors.blue.shade600),
          ),
        ],
      ],
    );
  }

  Widget _buildDetailedView() {
    final currentlyServing = _waitTimeData!['currentlyServing'] ?? 0;
    final totalWaiting = _waitTimeData!['totalWaiting'] ?? 0;
    final avgProcessTime = _waitTimeData!['avgProcessTimeMinutes'] ?? 15;
    final totalEstimatedTime =
        _waitTimeData!['totalEstimatedTime'] ?? 'No wait';
    final nextPatientNumber = _waitTimeData!['nextPatientNumber'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(Icons.access_time, size: 16, color: Colors.blue.shade700),
            const SizedBox(width: 6),
            Text(
              'Queue Information',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.blue.shade700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _buildInfoRow('Currently Serving', '$currentlyServing'),
        _buildInfoRow('Total Waiting', '$totalWaiting'),
        _buildInfoRow('Avg. Process Time', '${avgProcessTime}m'),
        _buildInfoRow('Estimated Total Time', totalEstimatedTime),
        if (nextPatientNumber != null)
          _buildInfoRow('Next Patient', '#$nextPatientNumber'),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[700])),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.blue.shade700,
            ),
          ),
        ],
      ),
    );
  }
}

class PatientWaitTimeWidget extends StatefulWidget {
  final String queueId;
  final EdgeInsets? padding;
  final bool autoRefresh;

  const PatientWaitTimeWidget({
    super.key,
    required this.queueId,
    this.padding,
    this.autoRefresh = true,
  });

  @override
  State<PatientWaitTimeWidget> createState() => _PatientWaitTimeWidgetState();
}

class _PatientWaitTimeWidgetState extends State<PatientWaitTimeWidget> {
  Map<String, dynamic>? _waitTimeData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadWaitTime();

    if (widget.autoRefresh) {
      // Refresh every 30 seconds
      Future.delayed(Duration(seconds: 30), _autoRefresh);
    }
  }

  void _autoRefresh() {
    if (mounted && widget.autoRefresh) {
      _loadWaitTime();
      Future.delayed(Duration(seconds: 30), _autoRefresh);
    }
  }

  Future<void> _loadWaitTime() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final waitTime = await WaitTimeService.getPatientWaitTime(widget.queueId);

      if (mounted) {
        setState(() {
          _waitTimeData = waitTime;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load wait time';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _waitTimeData == null) {
      return Container(
        padding: widget.padding ?? const EdgeInsets.all(12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 8),
            Text(
              'Loading your wait time...',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    if (_error != null || _waitTimeData == null) {
      return Container(
        padding: widget.padding ?? const EdgeInsets.all(12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.info_outline, size: 16, color: Colors.grey[600]),
            const SizedBox(width: 8),
            Text(
              'Wait time unavailable',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    final patientsAhead = _waitTimeData!['patientsAhead'] ?? 0;
    final estimatedWaitTime = _waitTimeData!['estimatedWaitTime'] ?? 'Unknown';
    final currentlyServing = _waitTimeData!['currentlyServing'] ?? 0;
    final patientPosition = _waitTimeData!['patientPosition'] ?? 0;

    final isBeingServed = patientsAhead <= 0;

    return Container(
      padding: widget.padding ?? const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isBeingServed ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isBeingServed ? Colors.green.shade200 : Colors.orange.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                isBeingServed ? Icons.notifications_active : Icons.access_time,
                size: 16,
                color: isBeingServed
                    ? Colors.green.shade700
                    : Colors.orange.shade700,
              ),
              const SizedBox(width: 6),
              Text(
                isBeingServed ? 'Your Turn!' : 'Your Wait Time',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: isBeingServed
                      ? Colors.green.shade700
                      : Colors.orange.shade700,
                ),
              ),
              if (_isLoading) ...[
                const SizedBox(width: 8),
                SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 1.5),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          if (isBeingServed)
            Text(
              'Please proceed to the doctor',
              style: TextStyle(
                fontSize: 12,
                color: Colors.green.shade700,
                fontWeight: FontWeight.w500,
              ),
            )
          else ...[
            _buildInfoRow('Your Position', '#$patientPosition'),
            _buildInfoRow('Currently Serving', '#$currentlyServing'),
            _buildInfoRow('Patients Ahead', '$patientsAhead'),
            _buildInfoRow('Estimated Wait', estimatedWaitTime),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[700])),
          Text(
            value,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.orange.shade700,
            ),
          ),
        ],
      ),
    );
  }
}
