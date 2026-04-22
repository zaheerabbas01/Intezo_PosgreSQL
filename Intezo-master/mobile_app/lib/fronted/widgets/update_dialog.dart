import 'package:flutter/material.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import '../../services/update_service.dart';

class UpdateDialog extends StatefulWidget {
  final Map<String, dynamic> updateInfo;
  
  const UpdateDialog({Key? key, required this.updateInfo}) : super(key: key);

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  bool _isDownloading = false;
  int _downloadProgress = 0;
  DownloadTaskStatus _downloadStatus = DownloadTaskStatus.undefined;
  final UpdateService _updateService = UpdateService();

  @override
  void initState() {
    super.initState();
    FlutterDownloader.registerCallback(_downloadCallback);
  }

  @pragma('vm:entry-point')
  void _downloadCallback(String id, int status, int progress) {
    if (mounted) {
      setState(() {
        _downloadProgress = progress;
        _downloadStatus = DownloadTaskStatus.values[status];
        
        if (status == 3) { // DownloadTaskStatus.complete
          _isDownloading = false;
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Update downloaded! Tap to install.'),
              backgroundColor: Colors.green,
            ),
          );
        } else if (status == 4) { // DownloadTaskStatus.failed
          _isDownloading = false;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isForceUpdate = widget.updateInfo['forceUpdate'] ?? false;
    
    return WillPopScope(
      onWillPop: () async => !isForceUpdate && !_isDownloading,
      child: AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.system_update, color: Colors.blue),
            const SizedBox(width: 8),
            const Text('Update Available'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Version ${widget.updateInfo['version']} is available',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (widget.updateInfo['fileSize'] > 0) ...[
              Text('Size: ${(widget.updateInfo['fileSize'] / 1024 / 1024).toStringAsFixed(2)} MB'),

            ],
            
            if (isForceUpdate) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.warning, color: Colors.orange, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'This is a required update',
                        style: TextStyle(color: Colors.orange, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            
            if (widget.updateInfo['releaseNotes']?.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              const Text('What\'s New:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Container(
                constraints: const BoxConstraints(maxHeight: 100),
                child: SingleChildScrollView(
                  child: Text(
                    widget.updateInfo['releaseNotes'],
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ),
              ),
            ],
            
            if (_isDownloading) ...[
              const SizedBox(height: 16),
              Column(
                children: [
                  LinearProgressIndicator(
                    value: _downloadProgress / 100,
                    backgroundColor: Colors.grey[300],
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _downloadStatus == DownloadTaskStatus.failed 
                          ? Colors.red 
                          : Colors.blue,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_getStatusText()),
                      Text('$_downloadProgress%'),
                    ],
                  ),
                ],
              ),
            ],
          ],
        ),
        actions: [
          if (!_isDownloading && !isForceUpdate)
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Later'),
            ),
          if (_isDownloading && _downloadStatus == DownloadTaskStatus.failed)
            TextButton(
              onPressed: _resumeDownload,
              child: const Text('Resume'),
            ),
          if (_isDownloading)
            TextButton(
              onPressed: _cancelDownload,
              child: const Text('Cancel'),
            ),
          if (!_isDownloading)
            ElevatedButton(
              onPressed: _downloadUpdate,
              style: ElevatedButton.styleFrom(
                backgroundColor: isForceUpdate ? Colors.orange : Colors.blue,
              ),
              child: Text(isForceUpdate ? 'Update Required' : 'Update Now'),
            ),
        ],
      ),
    );
  }

  String _getStatusText() {
    switch (_downloadStatus) {
      case DownloadTaskStatus.running:
        return 'Downloading...';
      case DownloadTaskStatus.paused:
        return 'Paused';
      case DownloadTaskStatus.failed:
        return 'Failed - Tap Resume';
      case DownloadTaskStatus.complete:
        return 'Complete';
      default:
        return 'Preparing...';
    }
  }

  Future<void> _downloadUpdate() async {
    setState(() {
      _isDownloading = true;
      _downloadProgress = 0;
    });

    try {
      final success = await _updateService.downloadAndInstallUpdate(
        widget.updateInfo['downloadUrl'],
        widget.updateInfo['version'],
      );
      
      if (!success) {
        setState(() {
          _isDownloading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to start download'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isDownloading = false;
      });
    }
  }

  Future<void> _resumeDownload() async {
    await _updateService.resumeDownload();
    setState(() {
      _downloadStatus = DownloadTaskStatus.running;
    });
  }

  Future<void> _cancelDownload() async {
    await _updateService.cancelDownload();
    setState(() {
      _isDownloading = false;
      _downloadProgress = 0;
    });
  }

  @override
  void dispose() {
    super.dispose();
  }
}

void showUpdateDialog(BuildContext context, Map<String, dynamic> updateInfo) {
  showDialog(
    context: context,
    barrierDismissible: !(updateInfo['forceUpdate'] ?? false),
    builder: (context) => UpdateDialog(updateInfo: updateInfo),
  );
}