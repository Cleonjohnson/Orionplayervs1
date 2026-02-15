# Install Android SDK + emulator (if missing), then build APK and install on emulator.
# Set EXPO_TOKEN and EAS_NO_VCS before running, or pass -ExpoToken "xxx"
# Usage: . .\scripts\install-emulator-and-build.ps1
#    or: . .\scripts\install-emulator-and-build.ps1 -ExpoToken "your_token"

param([string]$ExpoToken = $env:EXPO_TOKEN)

$ErrorActionPreference = "Stop"
$sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
$avdName = "Orion_Emulator_API34"
$cmdlineUrl = "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
$cmdlineZip = "$env:TEMP\commandlinetools-win.zip"

# 1) Use existing SDK if present
if (Test-Path (Join-Path $sdkRoot "platform-tools\adb.exe")) {
  Write-Host "Using existing Android SDK at $sdkRoot" -ForegroundColor Green
  $env:ANDROID_HOME = $sdkRoot
  $env:ANDROID_SDK_ROOT = $sdkRoot
  $env:Path = "$sdkRoot\platform-tools;$env:Path"
} else {
  # 2) Create SDK dir and download command-line tools
  $sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
  New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null
  $cmdlineDir = Join-Path $sdkRoot "cmdline-tools\latest"
  New-Item -ItemType Directory -Force -Path $cmdlineDir | Out-Null

  if (-not (Test-Path (Join-Path $cmdlineDir "bin\sdkmanager.bat"))) {
    Write-Host "Downloading Android command-line tools..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $cmdlineUrl -OutFile $cmdlineZip -UseBasicParsing
    Expand-Archive -Path $cmdlineZip -DestinationPath $env:TEMP\cmdline-tools-extract -Force
    $extracted = Get-ChildItem "$env:TEMP\cmdline-tools-extract" -Directory | Select-Object -First 1
    if ($extracted) {
      Copy-Item -Path "$($extracted.FullName)\*" -Destination $cmdlineDir -Recurse -Force
    } else {
      Copy-Item -Path "$env:TEMP\cmdline-tools-extract\*" -Destination $cmdlineDir -Recurse -Force
    }
    Remove-Item $cmdlineZip -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\cmdline-tools-extract" -Recurse -Force -ErrorAction SilentlyContinue
  }

  $env:ANDROID_HOME = $sdkRoot
  $env:ANDROID_SDK_ROOT = $sdkRoot
  $sdkmanager = Join-Path $cmdlineDir "bin\sdkmanager.bat"
  if (-not (Test-Path $sdkmanager)) {
    Write-Host "sdkmanager not found at $sdkmanager. Aborting." -ForegroundColor Red
    exit 1
  }

  # 3) Accept licenses
  Write-Host "Accepting SDK licenses..." -ForegroundColor Cyan
  $y = "y`n" * 10
  $y | & $sdkmanager --sdk_root=$sdkRoot --licenses 2>&1 | Out-Null

  # 4) Install platform-tools, emulator, platform, system image
  Write-Host "Installing platform-tools, emulator, and API 34 system image..." -ForegroundColor Cyan
  & $sdkmanager --sdk_root=$sdkRoot "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"
  $env:Path = "$sdkRoot\platform-tools;$sdkRoot\emulator;$env:Path"
}

# 5) Create AVD if not present
$avdmanager = Join-Path $sdkRoot "cmdline-tools\latest\bin\avdmanager.bat"
if (-not (Test-Path $avdmanager)) {
  $avdmanager = Get-ChildItem -Path $sdkRoot -Recurse -Filter "avdmanager.bat" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}
if (Test-Path $avdmanager) {
  $list = & $avdmanager list avd 2>&1
  if ($list -notmatch $avdName) {
    Write-Host "Creating AVD: $avdName..." -ForegroundColor Cyan
    "no" | & $avdmanager --sdk_root=$sdkRoot create avd -n $avdName -k "system-images;android-34;google_apis;x86_64" -d "pixel_6" -f
  }
} else {
  Write-Host "avdmanager not found. Install Android Studio and create an emulator manually, then run run-build-and-install-on-emulator.ps1" -ForegroundColor Yellow
}

# 6) Start emulator in background
$emulatorExe = Join-Path $sdkRoot "emulator\emulator.exe"
if (Test-Path $emulatorExe) {
  $running = & "$sdkRoot\platform-tools\adb.exe" devices 2>&1
  if ($running -notmatch "emulator-\d+\s+device") {
    Write-Host "Starting emulator (this may take a minute)..." -ForegroundColor Cyan
    Start-Process -FilePath $emulatorExe -ArgumentList "-avd", $avdName -WindowStyle Normal
    $wait = 0
    while ($wait -lt 90) {
      Start-Sleep -Seconds 5
      $wait += 5
      $dev = & "$sdkRoot\platform-tools\adb.exe" devices 2>&1
      if ($dev -match "emulator-\d+\s+device") {
        Write-Host "Emulator is booted." -ForegroundColor Green
        Start-Sleep -Seconds 5
        break
      }
      Write-Host "  Waiting for emulator... ${wait}s"
    }
  }
} else {
  Write-Host "Emulator not found. Start an AVD from Android Studio, then run: . .\scripts\run-build-and-install-on-emulator.ps1" -ForegroundColor Yellow
}

# 7) Build and install APK via EAS
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:Path = "$sdkRoot\platform-tools;$sdkRoot\emulator;$env:Path"
if ($ExpoToken) { $env:EXPO_TOKEN = $ExpoToken }
if (-not $env:EAS_NO_VCS) { $env:EAS_NO_VCS = "1" }

Set-Location $PSScriptRoot\..

if ($ExpoToken) {
  Write-Host "Running EAS build (say Yes to install on emulator when prompted)..." -ForegroundColor Cyan
  npx eas-cli build --platform android --profile preview
} else {
  Write-Host "EXPO_TOKEN not set. Set it and run: . .\scripts\run-build-and-install-on-emulator.ps1" -ForegroundColor Yellow
  Write-Host "  Example: `$env:EXPO_TOKEN = 'your_token'; . .\scripts\run-build-and-install-on-emulator.ps1" -ForegroundColor Gray
}
