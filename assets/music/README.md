# Game music – KingTuffhead: Studio Rush

**Project owner:** Cleon Orion Johnson (KingTuffhead)

## Adding "Inna I and I" and other tracks

The game uses background music from the `DUBPLATES` list in `src/screens/KingTuffheadGameScreen.js`.

### Option 1: Local MP3 files (recommended for "Inna I and I")

1. Place your MP3 file in this folder, e.g.:
   - `InnaIAndI.mp3` – **Inna I and I** by KingTuffhead (Cleon Orion Johnson)
2. In `KingTuffheadGameScreen.js`, update the `DUBPLATES` array to use a require:
   ```js
   { id: 'inna', name: 'Inna I and I', uri: require('../../../assets/music/InnaIAndI.mp3') }
   ```
   Note: `expo-av`'s `createAsync` accepts `require()` for local assets.

### Option 2: Remote URL

If the track is hosted online (with proper rights), set the track’s `uri` in `DUBPLATES` to that URL (e.g. your Bandcamp, SoundCloud, or CDN link).

### Rights

Only include music you have rights to use. For "Inna I and I" by KingTuffhead (Cleon Orion Johnson), use the official release or a file you’re authorized to use.
