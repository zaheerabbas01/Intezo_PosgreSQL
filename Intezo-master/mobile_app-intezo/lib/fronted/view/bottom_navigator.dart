import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/theme_provider.dart';
import '../res/components/wigets/colors.dart';
import 'homescreen.dart';
import 'profile.dart';
import 'status.dart';
import 'top_clinics_doctors_screen.dart';

class BottomNav extends StatefulWidget {
  const BottomNav({super.key});

  @override
  _BottomNavState createState() => _BottomNavState();
}

class BottomNavWithInitialIndex extends StatefulWidget {
  final int initialIndex;
  const BottomNavWithInitialIndex({super.key, required this.initialIndex});

  @override
  _BottomNavWithInitialIndexState createState() =>
      _BottomNavWithInitialIndexState();
}

class _BottomNavState extends State<BottomNav> {
  int _selectedIndex = 0;

  static final List<Widget> _widgetOptions = <Widget>[
    const Homescreen(),
    const TopClinicsDoctorsScreen(),
    const Status(),
    const Profile(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;

    return Scaffold(
      body: _widgetOptions.elementAt(_selectedIndex),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          backgroundColor: isDarkMode ? AppColors.darkCard : Colors.white,
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
          selectedItemColor: colors().bluecolor1,
          unselectedItemColor: isDarkMode
              ? Colors.grey.shade400
              : Colors.grey.shade600,
          selectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
          unselectedLabelStyle: const TextStyle(fontSize: 12),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: [
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 0
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 0 ? Icons.home : Icons.home_outlined,
                  size: 24,
                  color: _selectedIndex == 0
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 1
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 1 ? Icons.search : Icons.search_outlined,
                  size: 24,
                  color: _selectedIndex == 1
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Search',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 2
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 2
                      ? Icons.access_time
                      : Icons.access_time_outlined,
                  size: 24,
                  color: _selectedIndex == 2
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Status',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 3
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 3 ? Icons.person : Icons.person_outlined,
                  size: 24,
                  color: _selectedIndex == 3
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomNavWithInitialIndexState extends State<BottomNavWithInitialIndex> {
  late int _selectedIndex;

  @override
  void initState() {
    super.initState();
    _selectedIndex = widget.initialIndex;
  }

  static final List<Widget> _widgetOptions = <Widget>[
    const Homescreen(),
    const TopClinicsDoctorsScreen(),
    const Status(),
    const Profile(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;

    return Scaffold(
      body: _widgetOptions.elementAt(_selectedIndex),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          backgroundColor: isDarkMode ? AppColors.darkCard : Colors.white,
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
          selectedItemColor: colors().bluecolor1,
          unselectedItemColor: isDarkMode
              ? Colors.grey.shade400
              : Colors.grey.shade600,
          selectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
          unselectedLabelStyle: const TextStyle(fontSize: 12),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: [
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 0
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 0 ? Icons.home : Icons.home_outlined,
                  size: 24,
                  color: _selectedIndex == 0
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 1
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 1 ? Icons.search : Icons.search_outlined,
                  size: 24,
                  color: _selectedIndex == 1
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Search',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 2
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 2
                      ? Icons.access_time
                      : Icons.access_time_outlined,
                  size: 24,
                  color: _selectedIndex == 2
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Status',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedIndex == 3
                      ? colors().bluecolor1.withOpacity(0.1)
                      : Colors.transparent,
                ),
                child: Icon(
                  _selectedIndex == 3 ? Icons.person : Icons.person_outlined,
                  size: 24,
                  color: _selectedIndex == 3
                      ? colors().bluecolor1
                      : isDarkMode
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}
