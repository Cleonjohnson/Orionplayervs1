# Install Android platform-tools (adb.exe) into existing SDK. No Java required.
# Run from project root: . .\scripts\install-platform-tools.ps1

$sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdkRoot)) {
  Write-Host "Android SDK not found at $sdkRoot. Run install-emulator-and-build.ps1 first." -ForegroundColor Red
  exit 1
}

$dest = "$sdkRoot\platform-tools"
if (Test-Path "$dest\adb.exe") {
  Write-Host "platform-tools (adb) already installed at $dest" -ForegroundColor Green
  exit 0
}

$zip = "$env:TEMP\platform-tools-windows.zip"
$extractDir = "$env:TEMP\platform-tools-extract"

Write-Host "Downloading platform-tools from Google..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" -OutFile $zip -UseBasicParsing
} catch {
  Write-Host "Download failed: $_" -ForegroundColor Red
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

if (Test-Path "$dest\adb.exe") {
  Write-Host "platform-tools installed. adb is at $dest\adb.exe" -ForegroundColor Green
} else {
  Write-Host "Install may have failed. Check $dest for adb.exe" -ForegroundColor Yellow
  exit 1
}
