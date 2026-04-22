import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/theme_provider.dart';
import '../../res/components/wigets/colors.dart';
import '../bottom_navigator.dart';
import '../widgets/email_suggestion_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _verificationController = TextEditingController();
  bool _isRegistering = false;
  bool _needsVerification = false;
  String? _pendingId;
  Timer? _timer;
  int _countdown = 60;
  late AuthProvider _authProvider;

  @override
  void initState() {
    super.initState();
    // Add a post-frame callback to ensure context is available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _authProvider = Provider.of<AuthProvider>(context, listen: false);
      // Listen for auth state changes
      _authProvider.addListener(_handleAuthStateChange);
    });
  }

  @override
  void dispose() {
    _authProvider.removeListener(_handleAuthStateChange);
    _timer?.cancel();
    _emailController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _verificationController.dispose();
    super.dispose();
  }

  void _handleAuthStateChange() {
    // Check if user is now logged in (successful verification)
    if (_authProvider.isLoggedIn && mounted) {
      // Navigate to home screen
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const BottomNav()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;

    return Scaffold(
      backgroundColor: isDarkMode
          ? AppColors.darkBackground
          : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: isDarkMode ? AppColors.darkCard : Colors.white,
        title: Text(
          _needsVerification ? 'Verify Email' : (_isRegistering ? 'Register' : 'Login'),
          style: TextStyle(
            color: isDarkMode ? AppColors.darkText : AppColors.lightText,
          ),
        ),
        foregroundColor: isDarkMode ? AppColors.darkText : AppColors.lightText,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // App Logo
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: colors().bluecolor1.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: ClipOval(
                  child: Image.asset(
                    'assets/images/logo.png',
                    width: 100,
                    height: 100,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      print('Logo loading error: $error');
                      return Icon(
                        Icons.medical_services,
                        size: 50,
                        color: colors().bluecolor1,
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 24),

              Text(
                'Intezo',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: isDarkMode ? AppColors.darkText : AppColors.lightText,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _needsVerification
                    ? 'Enter verification code sent to your email\nCheck spam/junk folder if not found'
                    : (_isRegistering ? 'Create your account' : 'Sign in to continue'),
                style: TextStyle(
                  fontSize: 14,
                  color: isDarkMode
                      ? AppColors.darkSubtext
                      : Colors.grey.shade600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              if (!_needsVerification) ...[
                if (_isRegistering)
                  TextFormField(
                    controller: _nameController,
                    decoration: InputDecoration(
                      labelText: 'Full Name',
                      labelStyle: TextStyle(
                        color: isDarkMode
                            ? AppColors.darkSubtext
                            : Colors.grey.shade600,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? Colors.grey.shade600
                              : Colors.grey.shade400,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? Colors.grey.shade600
                              : Colors.grey.shade400,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: colors().bluecolor1,
                          width: 2,
                        ),
                      ),
                      filled: isDarkMode,
                      fillColor: isDarkMode ? AppColors.darkCard : null,
                    ),
                    style: TextStyle(
                      color: isDarkMode
                          ? AppColors.darkText
                          : AppColors.lightText,
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your name';
                      }
                      return null;
                    },
                  ),
                if (_isRegistering) const SizedBox(height: 16),

                if (_isRegistering)
                  TextFormField(
                    controller: _phoneController,
                    decoration: InputDecoration(
                      labelText: 'Phone Number',
                      labelStyle: TextStyle(
                        color: isDarkMode
                            ? AppColors.darkSubtext
                            : Colors.grey.shade600,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? Colors.grey.shade600
                              : Colors.grey.shade400,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: isDarkMode
                              ? Colors.grey.shade600
                              : Colors.grey.shade400,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: colors().bluecolor1,
                          width: 2,
                        ),
                      ),
                      prefixText: '+92 ',
                      prefixStyle: TextStyle(
                        color: isDarkMode
                            ? AppColors.darkText
                            : AppColors.lightText,
                      ),
                      filled: isDarkMode,
                      fillColor: isDarkMode ? AppColors.darkCard : null,
                    ),
                    style: TextStyle(
                      color: isDarkMode
                          ? AppColors.darkText
                          : AppColors.lightText,
                    ),
                    keyboardType: TextInputType.phone,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your phone number';
                      }
                      if (value.length < 10) {
                        return 'Please enter a valid phone number';
                      }
                      return null;
                    },
                  ),
                if (_isRegistering) const SizedBox(height: 16),

                EmailSuggestionField(
                  controller: _emailController,
                  isDarkMode: isDarkMode,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your email address';
                    }
                    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value)) {
                      return 'Please enter a valid email address';
                    }
                    return null;
                  },
                ),
              ],

              if (_needsVerification) ...[
                TextFormField(
                  controller: _verificationController,
                  decoration: InputDecoration(
                    labelText: 'Verification Code',
                    labelStyle: TextStyle(
                      color: isDarkMode
                          ? AppColors.darkSubtext
                          : Colors.grey.shade600,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDarkMode
                            ? Colors.grey.shade600
                            : Colors.grey.shade400,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDarkMode
                            ? Colors.grey.shade600
                            : Colors.grey.shade400,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: colors().bluecolor1,
                        width: 2,
                      ),
                    ),
                    filled: isDarkMode,
                    fillColor: isDarkMode ? AppColors.darkCard : null,
                  ),
                  style: TextStyle(
                    color: isDarkMode ? AppColors.darkText : AppColors.lightText,
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter verification code';
                    }
                    if (value.length != 6) {
                      return 'Verification code must be 6 digits';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: _countdown > 0 ? null : () async {
                        if (_pendingId != null) {
                          await authProvider.resendVerification(_pendingId!);
                          setState(() {
                            _countdown = 60;
                          });
                          _startTimer();
                        }
                      },
                      child: Text(
                        _countdown > 0 ? 'Resend in ${_countdown}s' : 'Resend Code',
                        style: TextStyle(
                          color: _countdown > 0 ? Colors.grey : colors().bluecolor1,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _needsVerification = false;
                          _pendingId = null;
                        });
                      },
                      child: Text(
                        'Back',
                        style: TextStyle(
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 24),

              if (authProvider.error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDarkMode ? Colors.grey.shade800 : Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isDarkMode ? Colors.grey.shade600 : Colors.red.shade200,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.error_outline,
                        color: isDarkMode ? Colors.red.shade300 : Colors.red.shade600,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _getUserFriendlyErrorMessage(authProvider.error!),
                          style: TextStyle(
                            color: isDarkMode ? Colors.red.shade200 : Colors.red.shade800,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              if (authProvider.error != null) const SizedBox(height: 16),

              authProvider.isLoading
                  ? const CircularProgressIndicator()
                  : SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    if (_formKey.currentState!.validate()) {
                      if (_needsVerification) {
                        // Handle verification
                        final code = _verificationController.text;
                        final success = await authProvider.verifyEmail(_pendingId!, code);
                        if (success) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Email verified successfully! Welcome to Intezo!'),
                              backgroundColor: Colors.green,
                              duration: Duration(seconds: 2),
                            ),
                          );
                          // Navigation handled automatically by AuthProvider listener
                        }
                      } else {
                        final email = _emailController.text;

                        if (_isRegistering) {
                          final name = _nameController.text;
                          final phone = _phoneController.text;
                          final result = await authProvider.register(name, email, phone);
                          if (result['success']) {
                            setState(() {
                              _needsVerification = true;
                              _pendingId = result['pendingId'];
                              _countdown = 60;
                            });
                            _startTimer();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Verification code sent to your email! Check spam folder if not found.',
                                ),
                                backgroundColor: Colors.blue,
                                duration: Duration(seconds: 5),
                              ),
                            );
                          }
                        } else {
                          final result = await authProvider.login(email);
                          if (result['requiresVerification'] == true) {
                            setState(() {
                              _needsVerification = true;
                              _pendingId = result['patientId'];
                              _countdown = 60;
                            });
                            _startTimer();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Verification code sent to your email! Check spam folder if not found.',
                                ),
                                backgroundColor: Colors.blue,
                                duration: Duration(seconds: 5),
                              ),
                            );
                          }
                        }
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors().bluecolor1,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 2,
                  ),
                  child: Text(
                    _needsVerification
                        ? 'Verify Email'
                        : (_isRegistering ? 'Create Account' : 'Sign In'),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              if (!_needsVerification)
                TextButton(
                  onPressed: () {
                    setState(() {
                      _isRegistering = !_isRegistering;
                      authProvider.clearError(); // Clear error when switching modes
                    });
                  },
                  child: Text(
                    _isRegistering
                        ? 'Already have an account? Sign In'
                        : 'Don\'t have an account? Create Account',
                    style: TextStyle(
                      color: colors().bluecolor1,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _getUserFriendlyErrorMessage(String error) {
    if (error.contains('timeout') || error.contains('connect')) {
      return 'Connection failed. Please check your internet and try again.';
    } else if (error.contains('404') || error.contains('not found')) {
      return 'Account not found. Please check your details or create a new account.';
    } else if (error.contains('401') || error.contains('unauthorized')) {
      return 'Invalid credentials. Please check your email address.';
    } else if (error.contains('500') || error.contains('server')) {
      return 'Server error. Please try again later.';
    } else if (error.contains('already exists')) {
      return 'This email is already registered. Please sign in instead.';
    } else if (error.contains('not verified')) {
      return 'Email not verified. Please check your email for verification code.';
    } else {
      return 'Something went wrong. Please try again.';
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdown > 0) {
        setState(() {
          _countdown--;
        });
      } else {
        timer.cancel();
      }
    });
  }
}