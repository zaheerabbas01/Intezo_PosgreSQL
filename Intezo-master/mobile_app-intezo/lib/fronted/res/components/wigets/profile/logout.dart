import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../providers/auth_provider.dart';
import '../../../../../providers/patient_provider.dart';
import '../../../../../providers/clinic_provider.dart';
import '../../../../view/auth/login_screen.dart';
import '../colors.dart';

class Logoutoptions extends StatefulWidget {
  const Logoutoptions({super.key});

  @override
  State<Logoutoptions> createState() => _LogoutoptionsState();
}

class _LogoutoptionsState extends State<Logoutoptions> {
  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height;
    final width = MediaQuery.sizeOf(context).width;

    return Scaffold(
      backgroundColor: colors.bgColor,
      appBar: AppBar(
        title: const Text("Logout Options", style: TextStyle(fontSize: 17.5)),
        backgroundColor: Colors.white,
      ),
      body: InkWell(
        onTap: () {
          showDialog(
            context: context,
            builder: (_) => Center(
              child: Container(
                width: width * 0.93,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Logout from All Devices",
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        "Are you sure?",
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          Icons.circle,
                          color: Colors.grey.withOpacity(0.8),
                          size: 7,
                        ),
                        title: const Text(
                          "You will logout from all devices including the current device.",
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          Icons.circle,
                          color: Colors.grey.withOpacity(0.8),
                          size: 7,
                        ),
                        title: const Text(
                          "You can login with same number again to see all your data.",
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.symmetric(vertical: 16),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.deepPurple.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.info,
                              size: 18.5,
                              color: Colors.deepPurple,
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                "There might be unsynced entries from other\ndevices.",
                                style: TextStyle(fontSize: 11.5),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          InkWell(
                            onTap: () async {
                              Navigator.pop(context);
                              // Show loading indicator
                              showDialog(
                                context: context,
                                barrierDismissible: false,
                                builder: (context) => const Center(
                                  child: CircularProgressIndicator(),
                                ),
                              );

                              try {
                                // Clear all provider data
                                Provider.of<PatientProvider>(
                                  context,
                                  listen: false,
                                ).clearData();
                                Provider.of<ClinicProvider>(
                                  context,
                                  listen: false,
                                ).clearData();
                                // Perform logout
                                await Provider.of<AuthProvider>(
                                  context,
                                  listen: false,
                                ).logout();
                                // Navigate to login screen and clear navigation stack
                                Navigator.of(context).pushAndRemoveUntil(
                                  MaterialPageRoute(
                                    builder: (context) => const LoginScreen(),
                                  ),
                                  (route) => false,
                                );
                              } catch (e) {
                                Navigator.pop(context); // Close loading dialog
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Logout failed: $e')),
                                );
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                vertical: 10,
                                horizontal: 24,
                              ),
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.red, width: 1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                "YES, LOGOUT",
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.red,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: width * 0.05),
                          InkWell(
                            onTap: () {
                              Navigator.pop(context);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                vertical: 10,
                                horizontal: 22,
                              ),
                              decoration: BoxDecoration(
                                color: colors().bluecolor3,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                "No",
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
        child: Container(
          height: height * 0.08,
          color: Colors.white,
          child: settingslists2(
            title: 'Logout from all devices',
            subtitle: 'Logout from all Mobile,Web & Tablets',
            leadicon: Icons.devices,
            color: Colors.red,
            colorbg: Colors.red,
          ),
        ),
      ),
    );
  }
}

class settingslists2 extends StatelessWidget {
  const settingslists2({
    super.key,
    required this.title,
    required this.subtitle,
    required this.leadicon,
    this.trailicon,
    required this.color,
    required this.colorbg,
  });

  final String title;
  final String subtitle;
  final IconData leadicon;
  final IconData? trailicon;
  final Color color;
  final Color colorbg;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ListTile(
          title: Text(
            title,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13.9,
              letterSpacing: 0.6,
            ),
          ),
          subtitle: Text(
            subtitle,
            style: TextStyle(
              letterSpacing: 0.6,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: Colors.black45.withOpacity(0.4),
            ),
          ),
          leading: SizedBox(
            width: 40,
            height: 40,
            child: CircleAvatar(
              backgroundColor: colorbg.withOpacity(0.2),
              child: Icon(leadicon, size: 20, color: color),
            ),
          ),
          trailing: trailicon != null
              ? Icon(trailicon, size: 14, color: color)
              : null,
        ),
      ],
    );
  }
}
