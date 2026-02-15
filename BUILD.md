# Building Orion Player 2

## If you see "TouchableOpacity doesn't exist" on an installed APK

That error means the installed app was built from an older bundle. **OTA updates cannot fix it** if the app crashes before the new JavaScript loads.

**Fix:** Install a **new APK** built from this repo:

- **Preview (test):** `npm run build:apk`
- **Production:** `npm run build:apk:prod`

Then install the new APK on the device. After that, future fixes can be delivered via OTA:

- `npm run update:preview` or `npm run update:production`

## TV mode

The app uses a gold focus ring on interactive elements for remote/D-pad. If you still see a system "box with cross" focus, that is Android TV’s default; our focus style (gold border, scale) is applied on top. A new build includes all TV improvements (logo, larger text, focusable buttons).
