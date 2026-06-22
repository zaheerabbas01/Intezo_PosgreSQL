# Intezo mobile production release

The Android release is configured for `https://api.intezo.online/api` and
`https://api.intezo.online`. Release builds ignore local `.env` URL overrides.

## Build Android

From PowerShell in this directory, run:

```powershell
.\build-production.ps1
```

Upload `build/app/outputs/bundle/release/app-release.aab` to a Play Console
internal-testing track first. Keep both the upload keystore and
`build/symbols/android` backed up securely. Increment the `version` build number
in `pubspec.yaml` before every later Play Store upload.

## Security behavior

- Authentication and patient identity are stored in the OS secure keystore.
- Patient and booking caches use an encrypted SQLCipher database.
- Release traffic is HTTPS-only and Android cleartext traffic is disabled.
- Android cloud/device backup is disabled for the app.
- Release logs do not emit API bodies, authorization headers, or patient data.
- Updates are delivered through the Play Store instead of sideloaded APKs.

## iOS still requires Apple-side setup

An iOS App Store build must be made on macOS with an Apple Developer account.
Before that build, register the final iOS bundle ID in Apple Developer and
Firebase, enable Push Notifications/APNs, then regenerate the FlutterFire iOS
configuration and configure Xcode signing. The Windows Android build does not
validate those Apple credentials.
