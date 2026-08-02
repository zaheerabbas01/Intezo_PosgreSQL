import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../providers/auth_provider.dart';
import '../../../providers/theme_provider.dart';
import '../../../services/secure_storage_service.dart';
import '../../res/components/wigets/colors.dart';
import '../bottom_navigator.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _verificationCodeController = TextEditingController();

  AuthProvider? _authProvider;
  bool _isRegistering = false;
  bool _isWaitingForSms = false;
  bool _isVerifyingCode = false;
  bool _hasNavigated = false;
  String? _requestId;
  String? _pollToken;
  String? _verifiedPhone;
  DateTime? _expiresAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _authProvider = context.read<AuthProvider>();
      _authProvider!.addListener(_handleAuthStateChange);
      unawaited(_restorePendingChallenge());
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // SMS codes are entered directly in this screen; no background polling is needed.
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _authProvider?.removeListener(_handleAuthStateChange);
    _nameController.dispose();
    _phoneController.dispose();
    _verificationCodeController.dispose();
    super.dispose();
  }

  void _handleAuthStateChange() {
    if ((_authProvider?.isLoggedIn ?? false) && mounted) {
      _openHome();
    }
  }

  void _openHome() {
    if (_hasNavigated || !mounted) return;
    _hasNavigated = true;
    unawaited(SecureStorageService.clearPatientAuthChallenge());
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const BottomNav()));
  }

  Future<void> _startPhoneAuth() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final provider = context.read<AuthProvider>();
    provider.clearError();

    final phone = _phoneController.text.trim();
    final result = _isRegistering
        ? await provider.register(_nameController.text.trim(), phone)
        : await provider.login(phone);

    if (!mounted || result['requestId'] == null) return;

    setState(() {
      _requestId = result['requestId'].toString();
      _pollToken = result['pollToken'].toString();
      _verifiedPhone = result['phone']?.toString() ?? phone;
      _expiresAt = DateTime.tryParse(result['expiresAt']?.toString() ?? '');
      _isWaitingForSms = true;
    });

    await SecureStorageService.savePatientAuthChallenge({
      'requestId': _requestId,
      'pollToken': _pollToken,
      'phone': _verifiedPhone,
      'expiresAt': _expiresAt?.toIso8601String(),
    });
  }

  Future<void> _restorePendingChallenge() async {
    final challenge = await SecureStorageService.readPatientAuthChallenge();
    if (!mounted || challenge == null) return;

    final expiresAt = DateTime.tryParse(
      challenge['expiresAt']?.toString() ?? '',
    );
    if (expiresAt == null || !expiresAt.isAfter(DateTime.now())) {
      await SecureStorageService.clearPatientAuthChallenge();
      return;
    }

    setState(() {
      _requestId = challenge['requestId']?.toString();
      _pollToken = challenge['pollToken']?.toString();
      _verifiedPhone = challenge['phone']?.toString();
      _expiresAt = expiresAt;
      _isWaitingForSms = _requestId != null && _pollToken != null;
    });
  }

  Future<void> _verifyCode() async {
    final requestId = _requestId;
    final pollToken = _pollToken;
    if (requestId == null ||
        pollToken == null ||
        _isVerifyingCode ||
        _hasNavigated) {
      return;
    }

    final code = _verificationCodeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      _showMessage('Enter the 6-digit code from your SMS.', isError: true);
      return;
    }

    setState(() => _isVerifyingCode = true);
    final provider = context.read<AuthProvider>();
    final verified = await provider.completePhoneAuth(
      requestId,
      pollToken,
      code,
    );
    if (mounted) setState(() => _isVerifyingCode = false);

    if (!mounted) return;
    if (verified) {
      _openHome();
      return;
    }

    if ((provider.error ?? '').toLowerCase().contains('expired')) {
      _resetChallenge();
      _showMessage(
        'The verification request expired. Please try again.',
        isError: true,
      );
    }
  }

  void _resetChallenge() {
    if (!mounted) return;
    setState(() {
      _isWaitingForSms = false;
      _requestId = null;
      _pollToken = null;
      _verifiedPhone = null;
      _expiresAt = null;
      _isVerifyingCode = false;
      _verificationCodeController.clear();
    });
    unawaited(SecureStorageService.clearPatientAuthChallenge());
  }

  void _switchMode() {
    context.read<AuthProvider>().clearError();
    _resetChallenge();
    setState(() => _isRegistering = !_isRegistering);
  }

  void _showMessage(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : Colors.green.shade700,
      ),
    );
  }

  String _friendlyError(String error) {
    return error
        .replaceFirst('Exception: ', '')
        .replaceFirst('Unable to submit data: ', '');
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final isDarkMode = context.watch<ThemeProvider>().isDarkMode;
    final background = isDarkMode
        ? AppColors.darkBackground
        : AppColors.lightBackground;
    final cardColor = isDarkMode ? AppColors.darkCard : Colors.white;
    final textColor = isDarkMode ? AppColors.darkText : AppColors.lightText;
    final secondaryText = isDarkMode
        ? AppColors.darkSubtext
        : Colors.grey.shade600;
    final primary = colors().bluecolor1;

    return Scaffold(
      backgroundColor: background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 40,
                  maxWidth: 520,
                ),
                child: Center(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: isDarkMode
                            ? Colors.white.withValues(alpha: 0.08)
                            : Colors.black.withValues(alpha: 0.06),
                      ),
                    ),
                    child: _isWaitingForSms
                        ? _buildWaitingState(
                            textColor,
                            secondaryText,
                            primary,
                            authProvider,
                          )
                        : _buildAuthForm(
                            textColor,
                            secondaryText,
                            primary,
                            authProvider,
                            isDarkMode,
                          ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildBrand(Color textColor, Color secondaryText, Color primary) {
    return Column(
      children: [
        Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            color: primary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: ClipOval(
            child: Image.asset(
              'assets/images/logo.png',
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Icon(
                Icons.medical_services_outlined,
                color: primary,
                size: 38,
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          'Intezo',
          style: TextStyle(
            color: textColor,
            fontSize: 28,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _isRegistering ? 'Create your patient account' : 'Welcome back',
          style: TextStyle(color: secondaryText, fontSize: 15),
        ),
      ],
    );
  }

  Widget _buildAuthForm(
    Color textColor,
    Color secondaryText,
    Color primary,
    AuthProvider authProvider,
    bool isDarkMode,
  ) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildBrand(textColor, secondaryText, primary),
          const SizedBox(height: 32),
          if (_isRegistering) ...[
            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              decoration: _inputDecoration(
                'Full name',
                Icons.person_outline,
                isDarkMode,
                primary,
              ),
              style: TextStyle(color: textColor),
              validator: (value) {
                final name = value?.trim() ?? '';
                if (name.length < 2) return 'Enter your full name';
                if (name.length > 120) return 'Name is too long';
                return null;
              },
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.telephoneNumber],
            decoration: _inputDecoration(
              'Mobile number',
              Icons.phone_outlined,
              isDarkMode,
              primary,
              hint: '03XXXXXXXXX',
            ),
            style: TextStyle(color: textColor),
            onFieldSubmitted: (_) => _startPhoneAuth(),
            validator: (value) {
              final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
              if (digits.isEmpty) return 'Enter your mobile number';
              if (digits.length < 10 || digits.length > 14) {
                return 'Enter a valid Pakistani mobile number';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.verified_user_outlined, size: 18, color: primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'No password. We will send a one-time SMS code to verify this number.',
                  style: TextStyle(
                    color: secondaryText,
                    fontSize: 12.5,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
          if (authProvider.error != null) ...[
            const SizedBox(height: 16),
            _errorBox(authProvider.error!, isDarkMode),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: authProvider.isLoading ? null : _startPhoneAuth,
              icon: authProvider.isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.sms_outlined),
              label: Text(
                authProvider.isLoading ? 'Preparing...' : 'Send SMS code',
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 14),
          TextButton(
            onPressed: _switchMode,
            child: Text(
              _isRegistering
                  ? 'Already have an account? Sign in'
                  : 'New to Intezo? Create an account',
              style: TextStyle(color: primary, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWaitingState(
    Color textColor,
    Color secondaryText,
    Color primary,
    AuthProvider authProvider,
  ) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: primary.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.sms_outlined, color: primary, size: 36),
        ),
        const SizedBox(height: 22),
        Text(
          'Enter SMS code',
          style: TextStyle(
            color: textColor,
            fontSize: 24,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Enter the 6-digit code sent to $_verifiedPhone.',
          textAlign: TextAlign.center,
          style: TextStyle(color: secondaryText, height: 1.5),
        ),
        const SizedBox(height: 24),
        if (authProvider.error != null) ...[
          _errorBox(
            authProvider.error!,
            Theme.of(context).brightness == Brightness.dark,
          ),
          const SizedBox(height: 16),
        ],
        TextField(
          controller: _verificationCodeController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: textColor,
            fontSize: 24,
            letterSpacing: 8,
            fontWeight: FontWeight.w700,
          ),
          decoration: _inputDecoration(
            'SMS code',
            Icons.lock_outline,
            Theme.of(context).brightness == Brightness.dark,
            primary,
          ).copyWith(counterText: ''),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _isVerifyingCode ? null : _verifyCode,
            icon: _isVerifyingCode
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
            style: ElevatedButton.styleFrom(
              backgroundColor: primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _resetChallenge,
          child: Text(
            'Use a different number',
            style: TextStyle(color: primary),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'The code expires in 10 minutes.',
          textAlign: TextAlign.center,
          style: TextStyle(color: secondaryText, fontSize: 12),
        ),
      ],
    );
  }

  InputDecoration _inputDecoration(
    String label,
    IconData icon,
    bool isDarkMode,
    Color primary, {
    String? hint,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: isDarkMode
          ? Colors.white.withValues(alpha: 0.04)
          : Colors.grey.shade50,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: isDarkMode
              ? Colors.white.withValues(alpha: 0.12)
              : Colors.grey.shade300,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
    );
  }

  Widget _errorBox(String error, bool isDarkMode) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDarkMode
            ? Colors.red.withValues(alpha: 0.1)
            : Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDarkMode ? Colors.red.shade300 : Colors.red.shade200,
        ),
      ),
      child: Text(
        _friendlyError(error),
        style: TextStyle(
          color: isDarkMode ? Colors.red.shade200 : Colors.red.shade800,
          fontSize: 13,
        ),
      ),
    );
  }
}
