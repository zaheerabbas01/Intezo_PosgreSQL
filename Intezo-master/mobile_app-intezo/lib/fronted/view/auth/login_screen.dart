import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

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

  AuthProvider? _authProvider;
  Timer? _pollTimer;
  bool _isRegistering = false;
  bool _isWaitingForWhatsApp = false;
  bool _isOpeningWhatsApp = false;
  bool _isCheckingStatus = false;
  bool _hasNavigated = false;
  String? _requestId;
  String? _pollToken;
  String? _whatsappUrl;
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
    if (state == AppLifecycleState.resumed && _isWaitingForWhatsApp) {
      _checkVerificationStatus();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _authProvider?.removeListener(_handleAuthStateChange);
    _pollTimer?.cancel();
    _nameController.dispose();
    _phoneController.dispose();
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
    _pollTimer?.cancel();
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
      _whatsappUrl = result['whatsappUrl'].toString();
      _verifiedPhone = result['phone']?.toString() ?? phone;
      _expiresAt = DateTime.tryParse(result['expiresAt']?.toString() ?? '');
      _isWaitingForWhatsApp = true;
    });

    await SecureStorageService.savePatientAuthChallenge({
      'requestId': _requestId,
      'pollToken': _pollToken,
      'whatsappUrl': _whatsappUrl,
      'phone': _verifiedPhone,
      'expiresAt': _expiresAt?.toIso8601String(),
    });
    _startPolling();
    await _openWhatsApp();
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
      _whatsappUrl = challenge['whatsappUrl']?.toString();
      _verifiedPhone = challenge['phone']?.toString();
      _expiresAt = expiresAt;
      _isWaitingForWhatsApp =
          _requestId != null && _pollToken != null && _whatsappUrl != null;
    });
    if (_isWaitingForWhatsApp) {
      _startPolling();
      _checkVerificationStatus();
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _checkVerificationStatus();
    });
  }

  Future<void> _openWhatsApp() async {
    final url = _whatsappUrl;
    if (url == null || _isOpeningWhatsApp) return;

    setState(() => _isOpeningWhatsApp = true);
    try {
      final opened = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
      if (!opened && mounted) {
        _showMessage(
          'WhatsApp could not be opened. Make sure it is installed.',
          isError: true,
        );
      }
    } catch (_) {
      if (mounted) {
        _showMessage(
          'WhatsApp could not be opened. Make sure it is installed.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isOpeningWhatsApp = false);
    }
  }

  Future<void> _checkVerificationStatus() async {
    final requestId = _requestId;
    final pollToken = _pollToken;
    if (requestId == null ||
        pollToken == null ||
        _isCheckingStatus ||
        _hasNavigated) {
      return;
    }

    _isCheckingStatus = true;
    final provider = context.read<AuthProvider>();
    final verified = await provider.completePhoneAuth(requestId, pollToken);
    _isCheckingStatus = false;

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
    _pollTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _isWaitingForWhatsApp = false;
      _requestId = null;
      _pollToken = null;
      _whatsappUrl = null;
      _verifiedPhone = null;
      _expiresAt = null;
      _isCheckingStatus = false;
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
                    child: _isWaitingForWhatsApp
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
                  'No password or SMS code. You will verify ownership by sending a private, prepared WhatsApp message.',
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
                  : const Icon(Icons.chat_outlined),
              label: Text(
                authProvider.isLoading
                    ? 'Preparing...'
                    : 'Continue with WhatsApp',
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
            color: const Color(0xFF25D366).withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.chat, color: Color(0xFF128C7E), size: 36),
        ),
        const SizedBox(height: 22),
        Text(
          'Verify in WhatsApp',
          style: TextStyle(
            color: textColor,
            fontSize: 24,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Send the prepared message from $_verifiedPhone, then return to Intezo. We will sign you in automatically.',
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
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _isOpeningWhatsApp ? null : _openWhatsApp,
            icon: _isOpeningWhatsApp
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.open_in_new),
            label: const Text('Open WhatsApp'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF128C7E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _isCheckingStatus ? null : _checkVerificationStatus,
            icon: _isCheckingStatus
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
            label: const Text('Check verification status'),
            style: OutlinedButton.styleFrom(
              foregroundColor: primary,
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
          'Never share the prepared verification message or token with anyone.',
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
