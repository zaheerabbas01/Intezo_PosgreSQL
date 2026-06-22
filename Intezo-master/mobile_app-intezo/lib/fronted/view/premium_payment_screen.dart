import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../res/components/wigets/colors.dart';
import '../../services/auth_service.dart';
import '../../services/api_service.dart';

class PremiumPaymentScreen extends StatefulWidget {
  const PremiumPaymentScreen({super.key});

  @override
  State<PremiumPaymentScreen> createState() => _PremiumPaymentScreenState();
}

class _PremiumPaymentScreenState extends State<PremiumPaymentScreen> {
  String? selectedPaymentMethod;
  File? paymentImage;
  bool isLoading = false;
  bool isSubmitting = false;
  bool isPremium = false;
  bool hasPendingPayment = false;
  DateTime? premiumExpiresAt;

  final ImagePicker _picker = ImagePicker();
  final String paymentNumber = "03114972154";
  final String accountHolderName = "Zaheer Abbas";
  final String preferredPaymentMethod = "EasyPaisa";
  final int premiumPrice = 100;

  final Map<String, Map<String, dynamic>> paymentMethods = {
    'easypesa': {
      'name': 'EasyPaisa',
      'icon': Icons.account_balance_wallet,
      'color': Color(0xFF00A651),
    },
    'jazzcash': {
      'name': 'JazzCash',
      'icon': Icons.payment,
      'color': Color(0xFFFF6B35),
    },
    'nayapay': {
      'name': 'NayaPay',
      'icon': Icons.credit_card,
      'color': Color(0xFF6C5CE7),
    },
    'sadapay': {
      'name': 'SadaPay',
      'icon': Icons.account_balance,
      'color': Color(0xFF00D4AA),
    },
  };

  @override
  void initState() {
    super.initState();
    _checkPremiumStatus();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Refresh premium status when screen becomes active
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkPremiumStatus();
    });
  }

  Future<void> _checkPremiumStatus() async {
    setState(() => isLoading = true);
    try {
      // Use AuthService to refresh premium status and sync caches
      final data = await AuthService.refreshPremiumStatus();

      if (data != null) {
        setState(() {
          isPremium = data['isPremium'] ?? false;
          hasPendingPayment = data['hasPendingPayment'] ?? false;
          if (data['premiumExpiresAt'] != null) {
            premiumExpiresAt = DateTime.parse(data['premiumExpiresAt']);
            // Check if premium is actually active (not expired)
            isPremium = isPremium && premiumExpiresAt!.isAfter(DateTime.now());
          } else {
            isPremium = false;
          }
        });
      }
    } catch (e) {
      print('Error checking premium status: $e');
    } finally {
      setState(() => isLoading = false);
    }
  }

  Future<void> _pickImage() async {
    try {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
          title: Text(
            'Select Image',
            style: TextStyle(color: colors().bluecolor1),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(Icons.camera, color: colors().bluecolor1),
                title: Text('Camera'),
                onTap: () async {
                  Navigator.pop(context);
                  await _getImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Icon(Icons.photo_library, color: colors().bluecolor1),
                title: Text('Gallery'),
                onTap: () async {
                  Navigator.pop(context);
                  await _getImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _getImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 80,
      );

      if (image != null) {
        setState(() {
          paymentImage = File(image.path);
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error picking image: $e')));
    }
  }

  Future<String> _convertImageToBase64(File imageFile) async {
    final bytes = await imageFile.readAsBytes();
    return base64Encode(bytes);
  }

  Future<void> _submitPayment() async {
    if (selectedPaymentMethod == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Please select a payment method')));
      return;
    }

    if (paymentImage == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Please upload payment receipt')));
      return;
    }

    setState(() => isSubmitting = true);

    try {
      final base64Image = await _convertImageToBase64(paymentImage!);

      await ApiService.post('premium/submit-payment', {
        'paymentMethod': selectedPaymentMethod,
        'paymentImage': base64Image,
      });

      setState(() => hasPendingPayment = true);
      _showSuccessDialog();
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error submitting payment: $e')));
    } finally {
      setState(() => isSubmitting = false);
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        title: Row(
          children: [
            Icon(Icons.check_circle, color: colors().greencolor1, size: 28),
            SizedBox(width: 8),
            Text(
              'Payment Submitted',
              style: TextStyle(color: colors().bluecolor1),
            ),
          ],
        ),
        content: Text(
          'Your payment has been submitted successfully. Please wait for admin approval to unlock premium features.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop();
            },
            child: Text('OK', style: TextStyle(color: colors().bluecolor1)),
          ),
        ],
      ),
    );
  }

  Widget _buildPremiumStatusCard() {
    if (isPremium &&
        premiumExpiresAt != null &&
        premiumExpiresAt!.isAfter(DateTime.now())) {
      final daysLeft = premiumExpiresAt!.difference(DateTime.now()).inDays;
      return Container(
        margin: EdgeInsets.all(16),
        padding: EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [colors().greencolor1, colors().greencolor2],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(15),
          boxShadow: [
            BoxShadow(
              color: colors().greencolor1.withOpacity(0.3),
              blurRadius: 10,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(Icons.star, color: Colors.white, size: 40),
            SizedBox(height: 12),
            Text(
              'Premium Active',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 8),
            Text(
              '$daysLeft days remaining',
              style: TextStyle(color: Colors.white70, fontSize: 16),
            ),
          ],
        ),
      );
    }

    if (hasPendingPayment) {
      return Container(
        margin: EdgeInsets.all(16),
        padding: EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.orange.shade50,
          border: Border.all(color: Colors.orange.shade200),
          borderRadius: BorderRadius.circular(15),
        ),
        child: Column(
          children: [
            Icon(Icons.hourglass_empty, color: Colors.orange, size: 40),
            SizedBox(height: 12),
            Text(
              'Payment Under Review',
              style: TextStyle(
                color: Colors.orange.shade800,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Your payment is being reviewed by our admin team. You will receive an email notification once approved.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.orange.shade700),
            ),
          ],
        ),
      );
    }

    return SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        backgroundColor: colors.bgColor,
        appBar: AppBar(
          title: Text('Premium Subscription'),
          backgroundColor: colors().bluecolor1,
          foregroundColor: Colors.white,
          elevation: 0,
          actions: [
            IconButton(
              onPressed: _checkPremiumStatus,
              icon: Icon(Icons.refresh),
              tooltip: 'Refresh Status',
            ),
          ],
        ),
        body: Center(
          child: CircularProgressIndicator(color: colors().bluecolor1),
        ),
      );
    }

    if (isPremium || hasPendingPayment) {
      return Scaffold(
        backgroundColor: colors.bgColor,
        appBar: AppBar(
          title: Text('Premium Subscription'),
          backgroundColor: colors().bluecolor1,
          foregroundColor: Colors.white,
          elevation: 0,
          actions: [
            IconButton(
              onPressed: _checkPremiumStatus,
              icon: Icon(Icons.refresh),
              tooltip: 'Refresh Status',
            ),
          ],
        ),
        body: Column(
          children: [
            _buildPremiumStatusCard(),
            if (!isPremium)
              Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'You cannot submit another payment request while one is pending.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colors.graycolor1),
                ),
              ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.bgColor,
      appBar: AppBar(
        title: Text('Premium Subscription'),
        backgroundColor: colors().bluecolor1,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _checkPremiumStatus,
            icon: Icon(Icons.refresh),
            tooltip: 'Refresh Status',
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Premium Benefits Card
            Container(
              margin: EdgeInsets.all(16),
              padding: EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(15),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.star, color: colors().bluecolor1, size: 28),
                      SizedBox(width: 8),
                      Text(
                        'Premium Benefits',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: colors().bluecolor1,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 16),
                  Row(
                    children: [
                      Icon(Icons.check_circle, color: colors().greencolor1),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text('Book unlimited queues at the same time'),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.access_time, color: colors().bluecolor1),
                      SizedBox(width: 8),
                      Text('30 days premium access'),
                    ],
                  ),
                ],
              ),
            ),

            // Price Card
            Container(
              margin: EdgeInsets.symmetric(horizontal: 16),
              padding: EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [colors().bluecolor1, colors().bluecolor2],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(15),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Premium Price: Rs $premiumPrice',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 20),

            // Payment Details
            Container(
              margin: EdgeInsets.symmetric(horizontal: 16),
              padding: EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(15),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Payment Details:',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: colors().bluecolor1,
                    ),
                  ),
                  SizedBox(height: 16),

                  // Account Holder Name
                  Row(
                    children: [
                      Icon(Icons.person, color: colors().bluecolor1, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Name: ',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: colors().bluecolor1,
                        ),
                      ),
                      Text(
                        accountHolderName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: colors().bluecolor1,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),

                  // Payment Number
                  Row(
                    children: [
                      Icon(Icons.phone, color: colors().greencolor1, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Number: ',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: colors().bluecolor1,
                        ),
                      ),
                      Text(
                        paymentNumber,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                          color: colors().bluecolor1,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),

                  // Preferred Payment Method
                  Row(
                    children: [
                      Icon(
                        Icons.account_balance_wallet,
                        color: Color(0xFF00A651),
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Preferred: ',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: colors().bluecolor1,
                        ),
                      ),
                      Text(
                        preferredPaymentMethod,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF00A651),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            SizedBox(height: 20),

            // Payment Methods
            Container(
              margin: EdgeInsets.symmetric(horizontal: 16),
              padding: EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(15),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Select Payment Method:',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: colors().bluecolor1,
                    ),
                  ),
                  SizedBox(height: 16),

                  GridView.builder(
                    shrinkWrap: true,
                    physics: NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 2.5,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: paymentMethods.length,
                    itemBuilder: (context, index) {
                      final method = paymentMethods.keys.elementAt(index);
                      final methodData = paymentMethods[method]!;
                      final isSelected = selectedPaymentMethod == method;

                      return GestureDetector(
                        onTap: () =>
                            setState(() => selectedPaymentMethod = method),
                        child: Container(
                          decoration: BoxDecoration(
                            color: isSelected
                                ? methodData['color'].withOpacity(0.1)
                                : colors.bgColor,
                            border: Border.all(
                              color: isSelected
                                  ? methodData['color']
                                  : Colors.grey.shade300,
                              width: isSelected ? 2 : 1,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                methodData['icon'],
                                color: methodData['color'],
                                size: 28,
                              ),
                              SizedBox(height: 4),
                              Text(
                                methodData['name'],
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isSelected
                                      ? methodData['color']
                                      : Colors.black87,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            SizedBox(height: 20),

            // Upload Receipt
            Container(
              margin: EdgeInsets.symmetric(horizontal: 16),
              padding: EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(15),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Upload Payment Receipt:',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: colors().bluecolor1,
                    ),
                  ),
                  SizedBox(height: 16),

                  GestureDetector(
                    onTap: _pickImage,
                    child: Container(
                      height: 200,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: colors.bgColor,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: colors().bluecolor1.withOpacity(0.3),
                          width: 2,
                        ),
                      ),
                      child: paymentImage != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.file(
                                paymentImage!,
                                fit: BoxFit.cover,
                              ),
                            )
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.cloud_upload,
                                  size: 48,
                                  color: colors().bluecolor1,
                                ),
                                SizedBox(height: 8),
                                Text(
                                  'Tap to upload receipt',
                                  style: TextStyle(
                                    color: colors().bluecolor1,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 30),

            // Submit Button
            Container(
              margin: EdgeInsets.symmetric(horizontal: 16),
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: isSubmitting ? null : _submitPayment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: colors().bluecolor1,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 5,
                ),
                child: isSubmitting
                    ? CircularProgressIndicator(color: Colors.white)
                    : Text(
                        'Submit Payment',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),

            SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
