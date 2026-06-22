import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiConfig {
  static const String _productionApiUrl = 'https://api.intezo.online/api';
  static const String _productionSocketUrl = 'https://api.intezo.online';

  static String? _resolvedBaseUrl;
  static String? _resolvedSocketUrl;

  /// Resolve URLs once after dotenv has loaded. Local development must opt in
  /// by setting explicit HTTP URLs in .env; production never guesses a LAN IP.
  static Future<void> initialize() async {
    if (kReleaseMode) {
      _resolvedBaseUrl = _productionApiUrl;
      _resolvedSocketUrl = _productionSocketUrl;
      return;
    }

    final envApiUrl = dotenv.env['API_BASE_URL']?.trim() ?? '';
    final envSocketUrl = dotenv.env['SOCKET_BASE_URL']?.trim() ?? '';

    _resolvedBaseUrl = envApiUrl.isNotEmpty ? envApiUrl : _productionApiUrl;
    _resolvedSocketUrl = envSocketUrl.isNotEmpty
        ? envSocketUrl
        : (_resolvedBaseUrl!.endsWith('/api')
              ? _resolvedBaseUrl!.substring(0, _resolvedBaseUrl!.length - 4)
              : _productionSocketUrl);
  }

  static String get currentBaseUrl => _resolvedBaseUrl ?? _productionApiUrl;

  static String get socketBaseUrl => _resolvedSocketUrl ?? _productionSocketUrl;
}
