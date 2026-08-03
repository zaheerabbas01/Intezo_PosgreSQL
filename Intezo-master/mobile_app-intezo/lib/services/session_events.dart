import 'dart:async';

/// Broadcasts authentication-expiry events from the API layer to the app
/// shell without coupling HTTP code to widget navigation.
class SessionEvents {
  SessionEvents._();

  static final StreamController<void> _expiredController =
      StreamController<void>.broadcast();

  static Stream<void> get onExpired => _expiredController.stream;

  static void notifyExpired() {
    if (!_expiredController.isClosed) {
      _expiredController.add(null);
    }
  }
}
