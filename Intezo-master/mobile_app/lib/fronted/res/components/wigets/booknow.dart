// lib/fronted/res/components/wigets/booknow.dart
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
// import 'package:qatar_app/fronted/res/components/wigets/patientdata.dart';
// import 'package:qatar_app/fronted/res/components/wigets/roundbutton.dart';

import '../../../../providers/theme_provider.dart';
import '../../../view/bottom_navigator.dart';
import '../../../view/status.dart';

class BottomNavWithStatus extends StatelessWidget {
  const BottomNavWithStatus({super.key});

  @override
  Widget build(BuildContext context) {
    return const BottomNavWithInitialIndex(initialIndex: 2);
  }
}

// lib/fronted/res/components/wigets/booknow.dart
class Booknow extends StatelessWidget {
  final dynamic clinic;
  final dynamic doctor;
  final int queueNumber;
  final bool isSuccess;
  final String? errorMessage;
  final VoidCallback? onRetry;

  const Booknow({
    super.key,
    required this.clinic,
    required this.queueNumber,
    this.doctor,
    this.isSuccess = true,
    this.errorMessage,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;
    final primaryColor = context.primaryColor;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: AppBar(
        backgroundColor: context.cardColor,
        title: Text(
          isSuccess ? 'Booking Confirmation' : 'Booking Failed',
          style: TextStyle(color: context.textColor),
        ),
        iconTheme: IconThemeData(color: context.textColor),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: isSuccess
              ? _buildSuccessContent(context, primaryColor)
              : _buildErrorContent(context, primaryColor),
        ),
      ),
    );
  }

  List<Widget> _buildSuccessContent(BuildContext context, Color primaryColor) {
    return [
      Icon(
        Icons.check_circle,
        size: 80,
        color: Colors.green.shade400,
      ),
      if (doctor != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 16.0),
          child: Text(
            'With Dr. ${doctor['name']} - ${doctor['specialty']}',
            style: TextStyle(
              fontSize: 16,
              color: context.subtextColor,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      const SizedBox(height: 24),
      Text(
        'Booking Confirmed!',
        style: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: context.textColor,
        ),
      ),
      const SizedBox(height: 16),
      Text(
        'Your queue number at ${clinic['name']}',
        style: TextStyle(
          fontSize: 16,
          color: context.subtextColor,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 32),
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: primaryColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: primaryColor.withOpacity(0.3)),
        ),
        child: Text(
          '$queueNumber',
          style: TextStyle(
            fontSize: 48,
            fontWeight: FontWeight.bold,
            color: primaryColor,
          ),
        ),
      ),
      const SizedBox(height: 32),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: () {
            // Navigate directly to Status screen
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (context) => const Status()),
              (route) => false,
            );
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryColor,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(
            'View Status',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
      ),
    ];
  }

  List<Widget> _buildErrorContent(BuildContext context, Color primaryColor) {
    return [
      Icon(
        Icons.error_outline,
        size: 80,
        color: Colors.red.shade400,
      ),
      const SizedBox(height: 24),
      Text(
        'Booking Failed',
        style: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: context.textColor,
        ),
      ),
      const SizedBox(height: 16),
      Text(
        'We couldn\'t complete your booking at ${clinic['name']}',
        style: TextStyle(
          fontSize: 16,
          color: context.subtextColor,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 8),
      if (errorMessage != null)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0),
          child: Text(
            _getUserFriendlyErrorMessage(errorMessage!),
            style: TextStyle(
              fontSize: 14,
              color: Colors.red.shade600,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      const SizedBox(height: 32),
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.shade100),
        ),
        child: Column(
          children: [
            Icon(
              Icons.info_outline,
              size: 32,
              color: Colors.red.shade600,
            ),
            const SizedBox(height: 12),
            Text(
              'What you can do:',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.red.shade800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '• Check your internet connection\n• Try again in a few moments\n• Contact support if the issue persists',
              style: TextStyle(
                fontSize: 14,
                color: Colors.red.shade700,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      const SizedBox(height: 32),
      if (onRetry != null)
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              'Try Again',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ),
      const SizedBox(height: 16),
      TextButton(
        onPressed: () {
          Navigator.pop(context); // Go back to previous screen
        },
        child: Text(
          'Go Back',
          style: TextStyle(
            fontSize: 16,
            color: primaryColor,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    ];
  }

  String _getUserFriendlyErrorMessage(String error) {
    if (error.contains('timeout') || error.contains('connect')) {
      return 'Connection issue. Please check your internet connection.';
    } else if (error.contains('409') || error.contains('conflict')) {
      return 'This time slot is no longer available. Please choose another time.';
    } else if (error.contains('400') || error.contains('bad request')) {
      return 'Invalid booking request. Please check your details.';
    } else if (error.contains('500') || error.contains('server')) {
      return 'Server error. Please try again later.';
    } else {
      return 'Unable to complete booking. Please try again.';
    }
  }
}