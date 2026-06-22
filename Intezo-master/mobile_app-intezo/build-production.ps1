$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not (Test-Path 'android/key.properties')) {
    throw 'android/key.properties is missing. Configure the release keystore before building.'
}

flutter pub get
flutter analyze --no-fatal-infos
flutter test
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols/android

$bundle = Resolve-Path 'build/app/outputs/bundle/release/app-release.aab'
$hash = (Get-FileHash $bundle -Algorithm SHA256).Hash

Write-Host "Production bundle: $bundle"
Write-Host "SHA256: $hash"
Write-Host 'Keep build/symbols/android with this release for crash symbolication.'
