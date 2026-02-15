# Game sound effects

To get **reliable game sound** (tap, coin, crash, etc.) even when online URLs are blocked:

1. Add a short tap/click sound file here, e.g. `tap.mp3` (0.1–0.3 seconds).
2. In `src/services/SoundService.js`, change the SFX loader to use it first:
   - Add at the top:  
     `const LOCAL_TAP = require('../../assets/sounds/tap.mp3');`
   - In `ensureSfxLoaded()`, try `Audio.Sound.createAsync(LOCAL_TAP, { shouldPlay: false })` first, then fall back to `SFX_URIS` if you still want remote fallback.

Right now the app tries remote URLs (Mixkit, SoundHelix); if you hear no sound, add `tap.mp3` here and wire it as above.
