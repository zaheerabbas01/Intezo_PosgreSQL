import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';

const _defaultApiBase = 'https://api.intezo.online/api';
const _channel = MethodChannel('intezo.sms_gateway');
const _storage = FlutterSecureStorage();

void main() => runApp(const SmsGatewayApp());

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
  Timer? _timer;
  bool _running = false;
  bool _busy = false;
  String _status = 'Enter the private gateway key, then start the gateway.';

  @override
  void initState() {
    super.initState();
    _restoreKey();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _baseController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _restoreKey() async {
    final key = await _storage.read(key: 'sms_gateway_key');
    if (mounted && key != null) _keyController.text = key;
  }

  Future<void> _toggle() async {
    if (_running) {
      _timer?.cancel();
      setState(() {
        _running = false;
        _status = 'Gateway stopped.';
      });
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
    await _storage.write(key: 'sms_gateway_key', value: key);
    setState(() {
      _running = true;
      _status =
          'Gateway is running. Keep this app open and keep the SIM connected.';
    });
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _poll());
    await _poll();
  }

  Uri _uri(String path) => Uri.parse('${_baseController.text.trim()}$path');

  Future<void> _poll() async {
    if (!_running || _busy) return;
    _busy = true;
    final key = _keyController.text.trim();
    try {
      final response = await http
          .get(
            _uri('/sms-gateway/jobs/next'),
            headers: {'X-SMS-Gateway-Key': key, 'Accept': 'application/json'},
          )
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200)
        throw Exception('Gateway request failed (${response.statusCode}).');
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final job = body['job'];
      if (job == null) {
        if (mounted)
          setState(() => _status = 'Waiting for a verification request...');
        return;
      }
      final jobMap = Map<String, dynamic>.from(job as Map);
      final phone = jobMap['phone'].toString();
      final code = jobMap['code'].toString();
      if (mounted) setState(() => _status = 'Sending code to $phone...');
      final sent =
          await _channel.invokeMethod<bool>('sendSms', {
            'phone': phone,
            'message':
                'Intezo verification code: $code. Do not share this code.',
          }) ??
          false;
      await http.post(
        _uri('/sms-gateway/jobs/${jobMap['jobId']}/result'),
        headers: {'X-SMS-Gateway-Key': key, 'Content-Type': 'application/json'},
        body: jsonEncode({
          'success': sent,
          if (!sent) 'error': 'Android SMS service returned false.',
        }),
      );
      if (mounted)
        setState(
          () => _status = sent
              ? 'SMS sent successfully.'
              : 'Android could not send the SMS; it will be retried.',
        );
    } catch (error) {
      if (mounted) setState(() => _status = 'Gateway error: $error');
    } finally {
      _busy = false;
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
          label: Text(_running ? 'Stop gateway' : 'Start gateway'),
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
          'Keep this screen open, disable battery optimization for this app, and keep the phone charged. The gateway polls the backend every five seconds.',
        ),
      ],
    ),
  );
}
