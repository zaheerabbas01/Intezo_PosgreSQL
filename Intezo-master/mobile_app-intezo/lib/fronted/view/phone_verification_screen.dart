import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/phone_verification_service.dart';

class PhoneVerificationScreen extends StatefulWidget {
  final String initialPhone;

  const PhoneVerificationScreen({super.key, required this.initialPhone});

  @override
  State<PhoneVerificationScreen> createState() =>
      _PhoneVerificationScreenState();
}

class _PhoneVerificationScreenState extends State<PhoneVerificationScreen>
    with WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _phoneController;

  Timer? _statusTimer;
  String? _whatsappUrl;
  String? _error;
  String? _pendingPhone;
  DateTime? _expiresAt;
  bool _isStarting = false;
  bool _isChecking = false;
  bool _waitingForMessage = false;
  bool _completed = false;
  bool _appIsActive = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _phoneController = TextEditingController(text: widget.initialPhone);
    unawaited(_refreshStatus(silent: true));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _statusTimer?.cancel();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appIsActive = state == AppLifecycleState.resumed;
    if (_appIsActive && _waitingForMessage) {
      unawaited(_refreshStatus());
    }
  }

  String? _validatePhone(String? value) {
    final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
    final valid =
        RegExp(r'^03\d{9}$').hasMatch(digits) ||
        RegExp(r'^923\d{9}$').hasMatch(digits) ||
        RegExp(r'^3\d{9}$').hasMatch(digits);
    if (!valid) return 'Enter a valid Pakistani mobile number';
    return null;
  }

  String _friendlyError(Object error) {
    return error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
  }

  Future<void> _startVerification() async {
    if (!_formKey.currentState!.validate() || _isStarting) return;

    setState(() {
      _isStarting = true;
      _error = null;
    });

    try {
      final result = await PhoneVerificationService.start(
        _phoneController.text.trim(),
      );
      if (!mounted) return;

      if (result['phoneVerified'] == true) {
        await _finishVerification();
        return;
      }

      final url = result['whatsappUrl']?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('WhatsApp verification link is unavailable.');
      }

      setState(() {
        _whatsappUrl = url;
        _pendingPhone = result['phone']?.toString();
        _expiresAt = result['expiresAt'] == null
            ? null
            : DateTime.tryParse(result['expiresAt'].toString());
        _waitingForMessage = true;
      });
      _beginStatusPolling();
      await _openWhatsApp();
    } catch (error) {
      if (mounted) {
        setState(() => _error = _friendlyError(error));
      }
    } finally {
      if (mounted) setState(() => _isStarting = false);
    }
  }

  Future<void> _openWhatsApp() async {
    final url = _whatsappUrl;
    if (url == null) return;

    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      setState(() {
        _error =
            'Unable to open WhatsApp. Make sure WhatsApp is installed, then try again.';
      });
    }
  }

  void _beginStatusPolling() {
    if (_statusTimer?.isActive == true) return;
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_appIsActive && !_isChecking && mounted) {
        unawaited(_refreshStatus(silent: true));
      }
    });
  }

  void _prepareNewRequest() {
    _statusTimer?.cancel();
    setState(() {
      _waitingForMessage = false;
      _pendingPhone = null;
      _expiresAt = null;
      _error = null;
    });
  }

  Future<void> _refreshStatus({bool silent = false}) async {
    if (_isChecking || _completed) return;

    if (!silent && mounted) setState(() => _isChecking = true);
    if (silent) _isChecking = true;

    try {
      final result = await PhoneVerificationService.getStatus();
      if (!mounted) return;

      if (result['phoneVerified'] == true) {
        await _finishVerification();
        return;
      }

      final pending = result['verificationPending'] == true;
      if (_waitingForMessage && !pending) {
        _statusTimer?.cancel();
        setState(() {
          _waitingForMessage = false;
          _whatsappUrl = null;
          _error =
              'The verification request expired. Create a new request and send it again.';
        });
      } else if (pending) {
        setState(() {
          _waitingForMessage = true;
          _pendingPhone = result['pendingPhone']?.toString();
          _expiresAt = result['expiresAt'] == null
              ? null
              : DateTime.tryParse(result['expiresAt'].toString());
        });
        _beginStatusPolling();
      }
    } catch (error) {
      if (!silent && mounted) {
        setState(() => _error = _friendlyError(error));
      }
    } finally {
      _isChecking = false;
      if (!silent && mounted) setState(() {});
    }
  }

  Future<void> _finishVerification() async {
    if (_completed) return;
    _completed = true;
    _statusTimer?.cancel();

    if (mounted) {
      setState(() {
        _waitingForMessage = false;
        _error = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Your WhatsApp number is verified.'),
          backgroundColor: Color(0xFF128C4A),
        ),
      );
      await Future<void>.delayed(const Duration(milliseconds: 700));
      if (mounted) Navigator.pop(context, true);
    }
  }

  String get _expiryText {
    final expiry = _expiresAt;
    if (expiry == null) return 'The verification link expires in 10 minutes.';
    final minutes = expiry.difference(DateTime.now()).inMinutes.clamp(0, 10);
    return 'This request expires in about ${minutes + 1} minute${minutes == 0 ? '' : 's'}.';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const whatsappGreen = Color(0xFF128C4A);

    return Scaffold(
      appBar: AppBar(title: const Text('Verify phone number')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: whatsappGreen.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chat_rounded,
                    color: whatsappGreen,
                    size: 34,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Verify through WhatsApp',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Intezo will prepare a private, single-use message. You only need to send it from your WhatsApp account.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 28),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  enabled: !_waitingForMessage,
                  validator: _validatePhone,
                  onFieldSubmitted: (_) => _startVerification(),
                  decoration: const InputDecoration(
                    labelText: 'WhatsApp phone number',
                    hintText: '03XXXXXXXXX or +923XXXXXXXXX',
                    prefixIcon: Icon(Icons.phone_outlined),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 18),
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _error!,
                      style: TextStyle(
                        color: theme.colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (!_waitingForMessage)
                  FilledButton.icon(
                    onPressed: _isStarting ? null : _startVerification,
                    style: FilledButton.styleFrom(
                      backgroundColor: whatsappGreen,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                    icon: _isStarting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.open_in_new),
                    label: Text(_isStarting ? 'Preparing...' : 'Open WhatsApp'),
                  )
                else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: whatsappGreen.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: whatsappGreen.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Column(
                      children: [
                        const CircularProgressIndicator(color: whatsappGreen),
                        const SizedBox(height: 14),
                        Text(
                          'Waiting for the message from $_pendingPhone',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _expiryText,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (_whatsappUrl != null)
                    OutlinedButton.icon(
                      onPressed: _openWhatsApp,
                      icon: const Icon(Icons.chat_outlined),
                      label: const Text('Open WhatsApp again'),
                    ),
                  if (_whatsappUrl == null)
                    OutlinedButton.icon(
                      onPressed: _prepareNewRequest,
                      icon: const Icon(Icons.restart_alt),
                      label: const Text('Create a new verification message'),
                    ),
                  TextButton.icon(
                    onPressed: _isChecking ? null : _refreshStatus,
                    icon: _isChecking
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                    label: const Text('Check verification status'),
                  ),
                ],
                const SizedBox(height: 28),
                _buildStep(context, 1, 'Tap "Open WhatsApp".'),
                _buildStep(
                  context,
                  2,
                  'Send the prepared message without changing it.',
                ),
                _buildStep(
                  context,
                  3,
                  'Return to Intezo. Verification completes automatically.',
                ),
                const SizedBox(height: 16),
                Text(
                  'Intezo will never ask you to share a WhatsApp OTP or password.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep(BuildContext context, int number, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Text(
              '$number',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(text),
            ),
          ),
        ],
      ),
    );
  }
}
