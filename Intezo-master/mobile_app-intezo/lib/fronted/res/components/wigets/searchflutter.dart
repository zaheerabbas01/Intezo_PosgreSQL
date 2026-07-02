import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../providers/theme_provider.dart';
import '../../../../providers/clinic_provider.dart';
import '../../../../services/clinic_service.dart';
import '../../../../services/location_service.dart';
import 'hospitalinfrom.dart';

class MainPageState extends StatefulWidget {
  const MainPageState({super.key});

  @override
  State<MainPageState> createState() => _MainPageStateState();
}

class _MainPageStateState extends State<MainPageState> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _allClinics = [];
  List<Map<String, dynamic>> _searchResults = [];
  bool _isLoading = false;
  bool _usingNearbyLocation = false;
  bool _requiresAppSettings = false;
  bool _requiresLocationSettings = false;
  String? _locationMessage;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _loadClinics();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadClinics() async {
    setState(() => _isLoading = true);
    try {
      final position = await PatientLocationService.getCurrentPosition();
      final clinics = await ClinicService.getNearbyClinics(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      if (!mounted) return;
      setState(() {
        _allClinics = clinics;
        _searchResults = clinics;
        _usingNearbyLocation = true;
        _requiresAppSettings = false;
        _requiresLocationSettings = false;
        _locationMessage = clinics.isEmpty
            ? 'No mapped clinics were found within 50 km.'
            : 'Showing the nearest clinics within 50 km.';
        _isLoading = false;
      });
    } on LocationAccessException catch (locationError) {
      await _loadAllClinics(
        message: locationError.message,
        requiresAppSettings: locationError.requiresAppSettings,
        requiresLocationSettings: locationError.requiresLocationSettings,
      );
    } catch (_) {
      await _loadAllClinics(
        message: 'Nearby search is unavailable right now. Showing all clinics.',
      );
    }
  }

  Future<void> _loadAllClinics({
    String? message,
    bool requiresAppSettings = false,
    bool requiresLocationSettings = false,
  }) async {
    try {
      final clinics = await ClinicService.getClinics(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _allClinics = clinics;
        _searchResults = clinics;
        _usingNearbyLocation = false;
        _requiresAppSettings = requiresAppSettings;
        _requiresLocationSettings = requiresLocationSettings;
        _locationMessage = message ?? 'Showing all clinics.';
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _locationMessage = 'Clinics could not be loaded. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _retryLocation() async {
    if (_requiresAppSettings) {
      await PatientLocationService.openAppSettings();
      return;
    }
    if (_requiresLocationSettings) {
      await PatientLocationService.openLocationSettings();
      return;
    }
    await _loadClinics();
  }

  Future<void> _showAllClinics() => _loadAllClinics(
    message:
        'Showing all clinics. Only mapped clinics can be ranked by distance.',
  );

  void _searchClinics(String query) {
    if (query.isEmpty) {
      setState(() => _searchResults = _allClinics);
      return;
    }

    final results = _allClinics.where((clinic) {
      final name = (clinic['name'] ?? '').toLowerCase();
      final address = (clinic['address'] ?? '').toLowerCase();
      final services =
          (clinic['services'] as List?)?.join(' ').toLowerCase() ?? '';
      final searchQuery = query.toLowerCase();

      return name.contains(searchQuery) ||
          address.contains(searchQuery) ||
          services.contains(searchQuery);
    }).toList();

    setState(() => _searchResults = results);
  }

  void _onSearchChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      _searchClinics(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = context.isDarkMode;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Search Clinics'),
        backgroundColor: context.cardColor,
        foregroundColor: context.textColor,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Refresh nearby clinics',
            onPressed: _isLoading ? null : _loadClinics,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      backgroundColor: context.backgroundColor,
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: context.cardColor,
            child: TextField(
              controller: _searchController,
              autofocus: false,
              decoration: InputDecoration(
                hintText: 'Search by name, location, or specialty...',
                hintStyle: TextStyle(color: context.subtextColor),
                prefixIcon: Icon(Icons.search, color: context.primaryColor),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.clear, color: context.subtextColor),
                        onPressed: () {
                          _searchController.clear();
                          _searchClinics('');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: context.primaryColor.withOpacity(0.3),
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: context.primaryColor, width: 2),
                ),
                filled: true,
                fillColor: context.backgroundColor,
              ),
              style: TextStyle(color: context.textColor),
              onChanged: _onSearchChanged,
            ),
          ),
          if (_locationMessage != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _usingNearbyLocation
                    ? Colors.green.withOpacity(0.1)
                    : Colors.orange.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    _usingNearbyLocation
                        ? Icons.near_me
                        : Icons.location_off_outlined,
                    size: 20,
                    color: _usingNearbyLocation ? Colors.green : Colors.orange,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _locationMessage!,
                      style: TextStyle(color: context.textColor, fontSize: 13),
                    ),
                  ),
                  if (_usingNearbyLocation && _allClinics.isEmpty)
                    TextButton(
                      onPressed: _isLoading ? null : _showAllClinics,
                      child: const Text('Show all'),
                    )
                  else if (!_usingNearbyLocation)
                    TextButton(
                      onPressed: _isLoading ? null : _retryLocation,
                      child: Text(
                        _requiresAppSettings || _requiresLocationSettings
                            ? 'Settings'
                            : 'Enable',
                      ),
                    ),
                ],
              ),
            ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _searchResults.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _searchController.text.isEmpty
                              ? Icons.search
                              : Icons.search_off,
                          size: 64,
                          color: context.subtextColor.withOpacity(0.5),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _searchController.text.isEmpty
                              ? 'Search for clinics'
                              : 'No clinics found',
                          style: TextStyle(
                            color: context.subtextColor,
                            fontSize: 18,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        if (_searchController.text.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              'Try different keywords',
                              style: TextStyle(
                                color: context.subtextColor.withOpacity(0.7),
                                fontSize: 14,
                              ),
                            ),
                          ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _searchResults.length,
                    itemBuilder: (context, index) {
                      final clinic = _searchResults[index];
                      final isOpen = clinic['isOpen'] ?? true;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: context.cardColor,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(
                                isDarkMode ? 0.1 : 0.05,
                              ),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                              color: isOpen
                                  ? context.primaryColor.withOpacity(0.1)
                                  : Colors.grey.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.local_hospital,
                              color: isOpen
                                  ? context.primaryColor
                                  : Colors.grey,
                              size: 28,
                            ),
                          ),
                          title: Text(
                            clinic['name'] ?? 'Unknown Clinic',
                            style: TextStyle(
                              color: context.textColor,
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              if (clinic['address'] != null)
                                Text(
                                  clinic['address'],
                                  style: TextStyle(
                                    color: context.subtextColor,
                                    fontSize: 14,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              const SizedBox(height: 4),
                              if (clinic['distanceKm'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.near_me,
                                        size: 14,
                                        color: context.primaryColor,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '${clinic['distanceKm']} km away',
                                        style: TextStyle(
                                          color: context.primaryColor,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isOpen
                                          ? Colors.green.withOpacity(0.1)
                                          : Colors.red.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      isOpen ? 'OPEN' : 'CLOSED',
                                      style: TextStyle(
                                        color: isOpen
                                            ? Colors.green
                                            : Colors.red,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (clinic['services'] != null)
                                    Expanded(
                                      child: Padding(
                                        padding: const EdgeInsets.only(left: 8),
                                        child: Text(
                                          (clinic['services'] as List).join(
                                            ', ',
                                          ),
                                          style: TextStyle(
                                            color: context.subtextColor
                                                .withOpacity(0.8),
                                            fontSize: 12,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                          trailing: Icon(
                            Icons.arrow_forward_ios,
                            color: context.subtextColor,
                            size: 16,
                          ),
                          onTap: () async {
                            // Mark as visited
                            await Provider.of<ClinicProvider>(
                              context,
                              listen: false,
                            ).markClinicAsVisited(clinic['id']);

                            if (mounted) {
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      HospitalInform(clinic: clinic),
                                ),
                              );
                            }
                          },
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
