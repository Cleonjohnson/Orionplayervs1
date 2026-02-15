# Install Android Emulator and Install the APK (one script)

Run **everything** from the project root in PowerShell (run as many times as needed; steps are skipped if already done):

```powershell
cd c:\Users\User\OrionPlayer2

# Set your Expo token (required for EAS build)
$env:EXPO_TOKEN = "YOUR_EXPO_TOKEN_HERE"
$env:EAS_NO_VCS = "1"

# Run the full install + build + install-on-emulator
. .\scripts\install-emulator-and-build.ps1
```

Or pass the token on the command line:

```powershell
. .\scripts\install-emulator-and-build.ps1 -ExpoToken "YOUR_EXPO_TOKEN_HERE"
```

## What the script does

1. **If Android SDK is missing:** Downloads Android command-line tools (~143 MB), installs `platform-tools`, `emulator`, and API 34 system image, accepts licenses.
2. **If no AVD exists:** Creates an emulator named `Orion_Emulator_API34`.
3. **Starts the emulator** (if not already running) and waits for it to boot.
4. **Runs EAS build** for Android (interactive). When it asks **“Install and run the Android build on an emulator?”** choose **Yes** so the APK installs on the emulator.

## Time

- First run (no SDK): ~15–25 min (download + install + first build).
- Later runs (SDK and emulator already there): ~5–15 min (EAS build only).

Run the script in a terminal you can leave open; do not close it until the build finishes and you’ve answered the install prompt.

---

## Error: `getaddrinfo ENOTFOUND expo.dev` / "request to https://expo.dev/artifacts/... failed"

This means your machine **could not resolve** `expo.dev` (DNS or network issue). The build itself succeeded; only the **download/install** step failed.

**Fix "adb executable doesn't seem to work" / "spawn adb ENOENT"**  
Install platform-tools (adb), then run the install step again:

```powershell
. .\scripts\install-platform-tools.ps1
. .\scripts\set-android-home.ps1
# then: set EXPO_TOKEN, EAS_NO_VCS and npm run install:emulator
```

**Fix "emulator executable doesn't seem to work" / "spawn ... emulator ENOENT"**  
Your SDK was missing the **emulator** package (emulator.exe). Install it once (~350 MB download, may take 5–10 min), then run the install step again:

```powershell
cd c:\Users\User\OrionPlayer2
. .\scripts\install-emulator-package.ps1
. .\scripts\set-android-home.ps1
$env:EXPO_TOKEN = "YOUR_EXPO_TOKEN"
$env:EAS_NO_VCS = "1"
npm run install:emulator
```

If the emulator download fails or the URL is outdated, install [Android Studio](https://developer.android.com/studio) (it includes the emulator), then run `set-android-home.ps1` and `npm run install:emulator`.

**Option 1 – Fix network and retry install (no new build)**  
1. Check that https://expo.dev opens in your browser (fix Wi‑Fi/DNS if it doesn’t).  
2. Ensure adb is installed (run `install-platform-tools.ps1` above if you haven’t).  
3. Start your Android emulator if it’s not running.  
4. In PowerShell from the project folder:

```powershell
. .\scripts\set-android-home.ps1
$env:EXPO_TOKEN = "YOUR_EXPO_TOKEN"
$env:EAS_NO_VCS = "1"
npm run install:emulator
```

(or `npx eas-cli build:run -p android`). Pick the latest Android build; the CLI will download the APK and install it on the emulator.

**Option 2 – Use different DNS**  
If your network blocks or mis-resolves expo.dev, try switching DNS to Google (8.8.8.8) or Cloudflare (1.1.1.1), then run the command in Option 1 again.

**Option 3 – Install APK manually**  
1. Open the build page in a **browser** (e.g. the link under the QR code: `https://expo.dev/accounts/cleonjohnson/projects/OrionPlayer2/builds/...`).  
2. Download the APK from the build’s **Artifacts** section.  
3. With the emulator running, run:
   ```powershell
   . .\scripts\set-android-home.ps1
   & "$env:ANDROID_HOME\platform-tools\adb.exe" install -r "C:\path\to\downloaded.apk"
   ```
   (Use the path where you saved the APK.)
