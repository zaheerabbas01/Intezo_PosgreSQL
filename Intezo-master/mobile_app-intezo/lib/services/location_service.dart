import 'package:geolocator/geolocator.dart';

class LocationAccessException implements Exception {
  final String message;
  final bool requiresAppSettings;
  final bool requiresLocationSettings;

  const LocationAccessException(
    this.message, {
    this.requiresAppSettings = false,
    this.requiresLocationSettings = false,
  });

  @override
  String toString() => message;
}

class PatientLocationService {
  static Future<Position> getCurrentPosition() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw const LocationAccessException(
        'Turn on device location to see nearby clinics.',
        requiresLocationSettings: true,
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw const LocationAccessException(
        'Location permission is needed to find nearby clinics.',
      );
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationAccessException(
        'Enable location permission in app settings to find nearby clinics.',
        requiresAppSettings: true,
      );
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 15),
      ),
    );
  }

  static Future<bool> openAppSettings() => Geolocator.openAppSettings();

  static Future<bool> openLocationSettings() =>
      Geolocator.openLocationSettings();
}
