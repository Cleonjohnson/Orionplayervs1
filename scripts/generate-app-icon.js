/**
 * Generate square app icon and adaptive icon from Orion logo.
 * Run: npm run generate:icon  (or: node scripts/generate-app-icon.js)
 * Writes: assets/icon.png, assets/adaptive-icon.png (1024x1024) for launcher.
 */

const path = require('path');
const fs = require('fs');

const SIZE = 1024; // Expo/Android recommend 1024x1024 for icon
const SOURCE = path.join(__dirname, '..', 'assets', 'images', 'OrionLogo.png');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICON_PATH = path.join(ASSETS_DIR, 'icon.png');
const ADAPTIVE_PATH = path.join(ASSETS_DIR, 'adaptive-icon.png');

async function main() {
  let Jimp;
  try {
    Jimp = require('jimp');
  } catch (e) {
    console.error('Install jimp first: npm install --save-dev jimp');
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE)) {
    console.error('Source not found:', SOURCE);
    process.exit(1);
  }

  try {
    const image = await Jimp.read(SOURCE);
    // Center-crop to square so logo fills the icon
    const square = image.cover(SIZE, SIZE);
    await square.writeAsync(ICON_PATH);
    await square.writeAsync(ADAPTIVE_PATH);
    console.log('Generated:', path.relative(process.cwd(), ICON_PATH));
    console.log('Generated:', path.relative(process.cwd(), ADAPTIVE_PATH));
    console.log('App launcher will show Orion logo on next build.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
