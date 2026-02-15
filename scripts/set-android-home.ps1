# Set ANDROID_HOME and PATH so adb works (for EAS "install on emulator" step).
# Run before build: . .\scripts\set-android-home.ps1
# If adb is missing, run: . .\scripts\install-platform-tools.ps1 first.

$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdkPath)) {
  $sdkPath = "$env:USERPROFILE\AppData\Local\Android\Sdk"
}
if (-not (Test-Path $sdkPath)) {
  Write-Host "Android SDK not found. Install Android Studio and run this script again, or install the app via the Expo build link/QR on your phone (no adb needed)." -ForegroundColor Yellow
  exit 1
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$platformTools = Join-Path $sdkPath "platform-tools"
$emulatorDir = Join-Path $sdkPath "emulator"
$adbExe = Join-Path $platformTools "adb.exe"
if (-not (Test-Path $adbExe)) {
  Write-Host "adb.exe not found. Run: . .\scripts\install-platform-tools.ps1" -ForegroundColor Yellow
  exit 1
}
$pathParts = @($platformTools)
if (Test-Path (Join-Path $emulatorDir "emulator.exe")) {
  $pathParts += $emulatorDir
}
$env:Path = ($pathParts -join ";") + ";$env:Path"
Write-Host "ANDROID_HOME set. adb is available." -ForegroundColor Green
if (-not (Test-Path (Join-Path $emulatorDir "emulator.exe"))) {
  Write-Host "emulator.exe not found. Run: . .\scripts\install-emulator-package.ps1 (download ~350 MB)" -ForegroundColor Yellow
}
