import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';

const _defaultApiBase = 'https://api.intezo.online/api';
const _channel = MethodChannel('intezo.sms_gateway');
const _storage = FlutterSecureStorage();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const SmsGatewayApp());
}

class SmsGatewayApp extends StatelessWidget {
  const SmsGatewayApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Intezo SMS Gateway',
    theme: ThemeData(
      colorSchemeSeed: const Color(0xff2364aa),
      useMaterial3: true,
    ),
    home: const SmsGatewayScreen(),
  );
}

class SmsGatewayScreen extends StatefulWidget {
  const SmsGatewayScreen({super.key});

  @override
  State<SmsGatewayScreen> createState() => _SmsGatewayScreenState();
}

class _SmsGatewayScreenState extends State<SmsGatewayScreen> {
  final _baseController = TextEditingController(text: _defaultApiBase);
  final _keyController = TextEditingController();
  String? _deviceId;
  String? _fcmToken;
  bool _running = false;
  String _status = 'Enter the private gateway key, then enable the gateway.';

  @override
  void initState() {
    super.initState();
    _restoreConfig();
    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      _fcmToken = token;
      if (_running) unawaited(_register(enabled: true));
    });
  }

  @override
  void dispose() {
    _baseController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _restoreConfig() async {
    final key = await _storage.read(key: 'sms_gateway_key');
    final deviceId = await _storage.read(key: 'sms_gateway_device_id');
    if (!mounted) return;
    setState(() {
      if (key != null) _keyController.text = key;
      _deviceId = deviceId;
    });
  }

  Future<String> _getDeviceId() async {
    final existing = _deviceId;
    if (existing != null && existing.isNotEmpty) return existing;
    final bytes = List<int>.generate(18, (_) => Random.secure().nextInt(256));
    final generated = base64UrlEncode(bytes);
    await _storage.write(key: 'sms_gateway_device_id', value: generated);
    _deviceId = generated;
    return generated;
  }

  Uri _uri(String path) => Uri.parse('${_baseController.text.trim()}$path');

  Future<void> _toggle() async {
    if (_running) {
      try {
        await _register(enabled: false);
        if (mounted) {
          setState(() {
            _running = false;
            _status = 'Gateway disabled. It will no longer receive SMS jobs.';
          });
        }
      } catch (error) {
        if (mounted) setState(() => _status = 'Unable to disable gateway: $error');
      }
      return;
    }

    final key = _keyController.text.trim();
    if (key.length < 32) {
      setState(
        () => _status = 'The gateway key must be at least 32 characters.',
      );
      return;
    }
    final permission = await Permission.sms.request();
    if (!permission.isGranted) {
      setState(() => _status = 'SMS permission is required on this phone.');
      return;
    }

    try {
      final deviceId = await _getDeviceId();
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        throw Exception('Firebase could not create a device token.');
      }
      _fcmToken = token;
      await _storage.write(key: 'sms_gateway_key', value: key);
      await _channel.invokeMethod('configureGateway', {
        'baseUrl': _baseController.text.trim(),
        'key': key,
        'deviceId': deviceId,
      });
      await _register(enabled: true);
      if (mounted) {
        setState(() {
          _running = true;
          _status =
              'FCM gateway enabled. This app can now run in the background.';
        });
      }
    } catch (error) {
      if (mounted) setState(() => _status = 'Gateway setup error: $error');
    }
  }

  Future<void> _register({required bool enabled}) async {
    final token = _fcmToken ?? await FirebaseMessaging.instance.getToken();
    final deviceId = await _getDeviceId();
    if (token == null || token.isEmpty)
      throw Exception('FCM token unavailable.');
    _fcmToken = token;
    final response = await http
        .post(
          _uri('/sms-gateway/register'),
          headers: {
            'X-SMS-Gateway-Key': _keyController.text.trim(),
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'deviceId': deviceId,
            'fcmToken': token,
            'enabled': enabled,
          }),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception('Gateway registration failed (${response.statusCode}).');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Intezo SMS Gateway')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Private gateway phone',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        const Text(
          'Use a dedicated Android phone and SIM. Never install this gateway build on patient phones.',
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _baseController,
          decoration: const InputDecoration(
            labelText: 'Backend API base URL',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _keyController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Private SMS gateway key',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _toggle,
          icon: Icon(_running ? Icons.stop : Icons.play_arrow),
          label: Text(_running ? 'Disable gateway' : 'Enable gateway'),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(_status),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'FCM wakes the gateway when a code is requested. Keep the phone charged, allow notifications, disable battery optimization for this app, and keep the SIM connected.',
        ),
      ],
    ),
  );
}
