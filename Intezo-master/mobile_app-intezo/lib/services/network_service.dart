import 'package:connectivity_plus/connectivity_plus.dart';

class NetworkService {
  static Future<bool> isConnected() async {
    try {
      final connectivityResults = await Connectivity().checkConnectivity();
      final hasConnection =
          connectivityResults.contains(ConnectivityResult.mobile) ||
          connectivityResults.contains(ConnectivityResult.wifi);
      print(
        'NetworkService: Connectivity result: $connectivityResults, hasConnection: $hasConnection',
      );
      return hasConnection;
    } catch (e) {
      print('NetworkService: Error checking connectivity: $e');
      return false;
    }
  }
}
