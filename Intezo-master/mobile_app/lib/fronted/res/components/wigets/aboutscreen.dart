import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("About"),
        centerTitle: true,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 🔹 Logo & App Name
          Center(
            child: Column(
              children: [
                ClipOval(
                  child: Image.asset(
                    'assets/images/logo.JPG',
                    width: 100,
                    height: 100,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return CircleAvatar(
                        radius: 50,
                        backgroundColor: Colors.blue.withOpacity(0.1),
                        child: Icon(
                          Icons.medical_services,
                          size: 50,
                          color: Colors.blue,
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  "Intezo",
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const Text("Smart Queue Management"),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 🔹 Description Card
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 3,
            child: const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                "Intezo helps you manage queues efficiently by booking, "
                    "tracking, and managing waiting lines in real-time. "
                    "Designed to save time for both users and businesses.",
                style: TextStyle(fontSize: 16),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // 🔹 App Info
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text("Version"),
            subtitle: const Text("1.0.0"),
          ),
          ListTile(
            leading: const Icon(Icons.update),
            title: const Text("Release Date"),
            subtitle: const Text("August 2025"),
          ),
          const Divider(),

          // 🔹 Developer Info
          ListTile(
            leading: const Icon(Icons.person),
            title: const Text("Developed by"),
            subtitle: const Text("Qabool & Zaheer"),
          ),
          ListTile(
            leading: const Icon(Icons.email_outlined),
            title: const Text("Contact"),
            subtitle: const Text("support@queueapp.com"),
          ),

          // 🔹 Social Links (optional)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.language),
                onPressed: () {
                  // launch website
                },
              ),
              IconButton(
                icon: const Icon(Icons.code),
                onPressed: () {
                  // launch GitHub
                },
              ),
              IconButton(
                icon: const Icon(Icons.linked_camera), // replace with LinkedIn
                onPressed: () {},
              ),
            ],
          ),
        ],
      ),
    );
  }
}
