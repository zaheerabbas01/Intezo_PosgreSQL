import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/theme_provider.dart';
import '../../res/components/wigets/colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isRegistering = false;

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
          _isRegistering ? 'Register' : 'Login',
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
              Container(
                width: 100,
                height: 100,
                child: Image.asset(
                  'assets/images/logo.png',
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: colors().bluecolor1.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.medical_services,
                        size: 50,
                        color: colors().bluecolor1,
                      ),
                    );
                  },
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
                _isRegistering ? 'Create your account' : 'Sign in to continue',
                style: TextStyle(
                  fontSize: 14,
                  color: isDarkMode
                      ? AppColors.darkSubtext
                      : Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 32),

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
                  color: isDarkMode ? AppColors.darkText : AppColors.lightText,
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
                      final phone = _phoneController.text;

                      if (_isRegistering) {
                        final name = _nameController.text;
                        final result = await authProvider.register(
                          name,
                          'placeholder@email.com',
                          phone,
                        );
                        if (result is Map && result['success'] == true) {
                          setState(() {
                            _isRegistering = false;
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text(
                                'Registration successful! Please login.',
                              ),
                              backgroundColor: Colors.green,
                            ),
                          );
                        }
                      } else {
                        final result = await authProvider.login(phone);
                        if (result is Map && result['success'] != true) {
                          // Error is already handled by the provider error state
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
                    _isRegistering ? 'Create Account' : 'Sign In',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

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
      return 'Invalid credentials. Please check your phone number.';
    } else if (error.contains('500') || error.contains('server')) {
      return 'Server error. Please try again later.';
    } else if (error.contains('already exists')) {
      return 'This phone number is already registered. Please sign in instead.';
    } else {
      return 'Something went wrong. Please try again.';
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    super.dispose();
  }
}