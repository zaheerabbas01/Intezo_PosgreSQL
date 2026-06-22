import 'package:flutter_test/flutter_test.dart';
import 'package:intezo_app/config/api_config.dart';

void main() {
  test('production endpoints are HTTPS and use the public domains', () {
    final api = Uri.parse(ApiConfig.currentBaseUrl);
    final socket = Uri.parse(ApiConfig.socketBaseUrl);

    expect(api.scheme, 'https');
    expect(api.host, 'api.intezo.online');
    expect(api.path, '/api');
    expect(socket.scheme, 'https');
    expect(socket.host, 'api.intezo.online');
  });
}
