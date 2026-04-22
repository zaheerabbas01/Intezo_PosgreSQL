import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'package:open_filex/open_filex.dart';
import '../config/api_config.dart';


class UpdateService {
  final Dio _dio = Dio();
  String? _currentTaskId;

  // Cloudflare R2 URLs
  String get versionJsonUrl {
    return ApiConfig.useCloudflare 
        ? 'https://apk.intezo.online/version.json'
        : '$baseUrl/api/app/version.json';
  }

  String get baseUrl {
    return ApiConfig.useCloudflare 
        ? 'https://api.intezo.online' 
        : 'http://192.168.100.69:3000';
  }

  Future<Map<String, dynamic>?> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;
      final currentBuildNumber = int.parse(packageInfo.buildNumber);
      
      print('🔍 UPDATE CHECK:');
      print('Current version: $currentVersion');
      print('Current build: $currentBuildNumber');
      print('Checking URL: $versionJsonUrl');
      
      // Fetch version info from Cloudflare R2 or fallback API
      final response = await _dio.get(versionJsonUrl);
      final versionData = response.data;
      
      print('Server response: $versionData');
      
      final latestVersion = versionData['latest_version'];
      final latestBuildNumber = versionData['build_number'] ?? 0;
      final apkUrl = versionData['apk_url'];
      final forceUpdate = versionData['force_update'] ?? false;
      final releaseNotes = versionData['release_notes'] ?? '';
      final fileSize = versionData['file_size'] ?? 0;
      
      print('Latest version: $latestVersion');
      print('Latest build: $latestBuildNumber');
      print('Force update: $forceUpdate');
      
      // Compare versions
      final versionUpdateAvailable = _isUpdateAvailable(currentVersion, latestVersion);
      final buildUpdateAvailable = latestBuildNumber > currentBuildNumber;
      
      print('Version update available: $versionUpdateAvailable');
      print('Build update available: $buildUpdateAvailable');
      
      if (versionUpdateAvailable || buildUpdateAvailable) {
        print('✅ UPDATE AVAILABLE!');
        
        // Use full APK download
        return {
          'version': latestVersion,
          'buildNumber': latestBuildNumber,
          'downloadUrl': apkUrl,
          'forceUpdate': forceUpdate,
          'releaseNotes': releaseNotes,
          'fileSize': fileSize,

        };
      }
      print('❌ No update needed');
      return null;
    } catch (e) {
      print('❌ Error checking for update: $e');
      return null;
    }
  }

  bool _isUpdateAvailable(String current, String latest) {
    try {
      List<int> c = current.split('.').map(int.parse).toList();
      List<int> l = latest.split('.').map(int.parse).toList();

      for (int i = 0; i < l.length; i++) {
        if (i >= c.length) return true;
        if (l[i] > c[i]) return true;
        if (l[i] < c[i]) return false;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> downloadAndInstallUpdate(String downloadUrl, String version) async {
    try {
      if (!await Permission.storage.request().isGranted) {
        return false;
      }

      final dir = await getExternalStorageDirectory();
      final fileName = 'intezo_update_$version.apk';
      
      _currentTaskId = await FlutterDownloader.enqueue(
        url: downloadUrl,
        savedDir: dir!.path,
        fileName: fileName,
        showNotification: true,
        openFileFromNotification: false,
      );
      
      if (_currentTaskId != null) {
        FlutterDownloader.registerCallback(_downloadCallback);
        return true;
      }
      return false;
    } catch (e) {
      print('Error downloading update: $e');
      return false;
    }
  }

  @pragma('vm:entry-point')
  static void _downloadCallback(String id, int status, int progress) {
    print('Download progress: $progress% - Status: $status');
    
    if (status == 3) { // DownloadTaskStatus.complete
      _installApk(id);
    } else if (status == 4) { // DownloadTaskStatus.failed
      print('Download failed, attempting to resume...');
      FlutterDownloader.resume(taskId: id);
    }
  }

  static Future<void> _installApk(String taskId) async {
    try {
      final tasks = await FlutterDownloader.loadTasks();
      final task = tasks?.firstWhere((task) => task.taskId == taskId);
      
      if (task != null && task.filename != null) {
        final filePath = '${task.savedDir}/${task.filename}';
        await OpenFilex.open(filePath);
      }
    } catch (e) {
      print('Error installing APK: $e');
    }
  }

  Future<void> resumeDownload() async {
    if (_currentTaskId != null) {
      await FlutterDownloader.resume(taskId: _currentTaskId!);
    }
  }

  Future<void> cancelDownload() async {
    if (_currentTaskId != null) {
      await FlutterDownloader.cancel(taskId: _currentTaskId!);
      _currentTaskId = null;
    }
  }

  Future<List<DownloadTask>?> getDownloadTasks() async {
    return await FlutterDownloader.loadTasks();
  }
}