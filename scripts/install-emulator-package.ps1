# Install Android Emulator (emulator.exe) into existing SDK. No Java required.
# Run from project root: . .\scripts\install-emulator-package.ps1
# Requires: platform-tools (adb) already installed.

$sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdkRoot)) {
  Write-Host "Android SDK not found at $sdkRoot." -ForegroundColor Red
  exit 1
}

$dest = "$sdkRoot\emulator"
if (Test-Path "$dest\emulator.exe") {
  Write-Host "Emulator already installed at $dest" -ForegroundColor Green
  exit 0
}

# Google's emulator archive - Windows x64 (version number may change; check developer.android.com/studio/emulator_archive)
$emulatorZipUrl = "https://dl.google.com/android/repository/emulator-windows_x64-11257478.zip"
$zip = "$env:TEMP\emulator-windows.zip"
$extractDir = "$env:TEMP\emulator-extract"

Write-Host "Downloading Android Emulator (~350 MB, may take a few minutes)..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri $emulatorZipUrl -OutFile $zip -UseBasicParsing
} catch {
  Write-Host "Download failed: $_" -ForegroundColor Red
  Write-Host "Try installing Android Studio (includes emulator), or check https://developer.android.com/studio/emulator_archive for the latest emulator-windows_x64 zip URL." -ForegroundColor Yellow
  exit 1
}

Write-Host "Extracting to $dest ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Expand-Archive -Path $zip -DestinationPath $extractDir -Force
$inner = Get-ChildItem $extractDir -Directory | Select-Object -First 1
if ($inner) {
  Copy-Item -Path "$($inner.FullName)\*" -Destination $dest -Recurse -Force
} else {
  Copy-Item -Path "$extractDir\*" -Destination $dest -Recurse -Force
}
Remove-Item $zip -ErrorAction SilentlyContinue
Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue

if (Test-Path "$dest\emulator.exe") {
  Write-Host "Emulator installed at $dest\emulator.exe" -ForegroundColor Green
} else {
  Write-Host "Install may have failed. Check $dest for emulator.exe" -ForegroundColor Yellow
  exit 1
}
