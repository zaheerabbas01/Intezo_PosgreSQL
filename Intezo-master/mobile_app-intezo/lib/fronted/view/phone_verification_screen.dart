import 'package:flutter/material.dart';

import '../../services/phone_verification_service.dart';

class PhoneVerificationScreen extends StatefulWidget {
  final String initialPhone;

  const PhoneVerificationScreen({super.key, required this.initialPhone});

  @override
  State<PhoneVerificationScreen> createState() =>
      _PhoneVerificationScreenState();
}

class _PhoneVerificationScreenState extends State<PhoneVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _phoneController;
  final _codeController = TextEditingController();
  String? _requestId;
  String? _pollToken;
  String? _pendingPhone;
  DateTime? _expiresAt;
  String? _error;
  bool _isStarting = false;
  bool _isVerifying = false;
  bool _waitingForCode = false;

  @override
  void initState() {
    super.initState();
    _phoneController = TextEditingController(text: widget.initialPhone);
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  String? _validatePhone(String? value) {
    final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^(03\d{9}|923\d{9}|3\d{9})$').hasMatch(digits)) {
      return 'Enter a valid Pakistani mobile number';
    }
    return null;
  }

  String _friendlyError(Object error) =>
      error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');

  Future<void> _startVerification() async {
    if (!(_formKey.currentState?.validate() ?? false) || _isStarting) return;
    setState(() {
      _isStarting = true;
      _error = null;
    });
    try {
      final result = await PhoneVerificationService.start(
        _phoneController.text.trim(),
      );
      if (!mounted) return;
      if (result['phoneVerified'] == true) return _finishVerification();
      setState(() {
        _requestId = result['requestId']?.toString();
        _pollToken = result['pollToken']?.toString();
        _pendingPhone = result['phone']?.toString();
        _expiresAt = DateTime.tryParse(result['expiresAt']?.toString() ?? '');
        _waitingForCode = _requestId != null && _pollToken != null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _isStarting = false);
    }
  }

  Future<void> _verifyCode() async {
    final requestId = _requestId;
    final pollToken = _pollToken;
    final code = _codeController.text.trim();
    if (requestId == null ||
        pollToken == null ||
        !RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'Enter the 6-digit code from your SMS.');
      return;
    }
    setState(() {
      _isVerifying = true;
      _error = null;
    });
    try {
      final result = await PhoneVerificationService.verify(
        requestId: requestId,
        pollToken: pollToken,
        verificationCode: code,
      );
      if (mounted && result['phoneVerified'] == true)
        await _finishVerification();
    } catch (error) {
      if (mounted) setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  void _prepareNewRequest() {
    setState(() {
      _requestId = null;
      _pollToken = null;
      _pendingPhone = null;
      _expiresAt = null;
      _codeController.clear();
      _error = null;
      _waitingForCode = false;
    });
  }

  Future<void> _finishVerification() async {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Your phone number is verified.')),
    );
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (mounted) Navigator.pop(context, true);
  }

  String get _expiryText {
    final expiry = _expiresAt;
    if (expiry == null) return 'The code expires in 10 minutes.';
    final minutes = expiry.difference(DateTime.now()).inMinutes.clamp(0, 10);
    return 'This code expires in about ${minutes + 1} minute${minutes == 0 ? '' : 's'}.';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
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
                Icon(Icons.sms_outlined, color: primary, size: 58),
                const SizedBox(height: 16),
                Text(
                  'Verify with SMS',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'We will send a one-time code to your mobile number.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  enabled: !_waitingForCode,
                  validator: _validatePhone,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    hintText: '03XXXXXXXXX or +923XXXXXXXXX',
                    prefixIcon: Icon(Icons.phone_outlined),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
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
                if (!_waitingForCode)
                  FilledButton.icon(
                    onPressed: _isStarting ? null : _startVerification,
                    icon: _isStarting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.sms_outlined),
                    label: Text(_isStarting ? 'Sending...' : 'Send SMS code'),
                  )
                else ...[
                  Text(
                    'Enter the code sent to $_pendingPhone.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 24,
                      letterSpacing: 8,
                      fontWeight: FontWeight.w700,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'SMS code',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: _isVerifying ? null : _verifyCode,
                    icon: _isVerifying
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.check_circle_outline),
                    label: const Text('Verify code'),
                  ),
                  TextButton(
                    onPressed: _prepareNewRequest,
                    child: const Text('Use a different number'),
                  ),
                  Text(
                    _expiryText,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
