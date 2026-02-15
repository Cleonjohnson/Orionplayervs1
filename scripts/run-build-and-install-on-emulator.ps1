# Build APK and install on Android emulator (interactive).
# Prereqs: Android Studio + emulator created and running; set EXPO_TOKEN and EAS_NO_VCS.
# Run from project root: . .\scripts\run-build-and-install-on-emulator.ps1

$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdkPath)) {
  $sdkPath = "$env:USERPROFILE\AppData\Local\Android\Sdk"
}
if (-not (Test-Path $sdkPath)) {
  Write-Host "Android SDK not found. Install Android Studio, create an emulator, then run this script again." -ForegroundColor Yellow
  exit 1
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$platformTools = Join-Path $sdkPath "platform-tools"
if (Test-Path $platformTools) {
  $env:Path = "$platformTools;$env:Path"
}
Write-Host "ANDROID_HOME set. Starting build (say Yes to install on emulator when prompted)." -ForegroundColor Green
npx eas-cli build --platform android --profile preview
