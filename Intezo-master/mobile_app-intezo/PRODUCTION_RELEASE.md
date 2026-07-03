# Intezo mobile production release

The Android release is configured for `https://api.intezo.online/api` and
`https://api.intezo.online`. Release builds ignore local `.env` URL overrides.

## Build Android

For Google Play, from PowerShell in this directory, run:

```powershell
.\build-production.ps1
```

Upload `build/app/outputs/bundle/release/app-release.aab` to a Play Console
internal-testing track first. Keep both the upload keystore and
`build/symbols/android` backed up securely. Increment the `version` build number
in `pubspec.yaml` before every later Play Store upload.

For direct website distribution, run from the repository root:

```powershell
$env:INTEZO_R2_BUCKET = 'your-r2-bucket-name'
$env:INTEZO_R2_ENDPOINT = 'https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com'
$env:AWS_ACCESS_KEY_ID = 'your-r2-access-key-id'
$env:AWS_SECRET_ACCESS_KEY = 'your-r2-secret-access-key'
powershell -ExecutionPolicy Bypass -File .\app-hosting\deploy-split-apks.ps1
```

This creates signed, obfuscated APKs for `arm64-v8a`, `armeabi-v7a`, and
`x86_64`, plus a universal compatibility fallback. It writes a versioned
release manifest with file sizes and SHA-256 hashes, uploads the APKs to the
existing Cloudflare R2 domain, and deploys the device-aware download page and
manifest to Firebase Hosting. Firebase's free Spark plan forbids executable
files such as APKs, while R2 Standard storage has free Internet egress. Store
the four values above in protected CI secrets when automating this command;
never commit either access key.

If the Firebase project is later upgraded to Blaze, APKs can instead be stored
there by running
`powershell -ExecutionPolicy Bypass -File .\app-hosting\deploy-split-apks.ps1 -FirebaseBlaze`.
Firebase Hosting transfer limits and overage pricing still apply.

Never delete or replace the release keystore: Android only accepts an update
when it is signed with the same certificate and has a higher build number.

Flutter gives split APKs ABI-prefixed Android version codes. For release
`1.0.1+5`, the highest split version code is `4005`. The first Google Play
release must therefore use build number `4006` or higher so every website APK
can upgrade to the Play Store version.

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
