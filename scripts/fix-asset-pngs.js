/**
 * Re-encode PNGs in assets/images so Android AAPT can compile them.
 * Run: npm run fix:assets  (or: node scripts/fix-asset-pngs.js)
 * Fixes: "AAPT: error: file failed to compile" on EAS Android build.
 */

const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');
const FILES = ['OrionBanner.png', 'OrionLogo.png', 'culture-fm-logo.png'];

async function main() {
  let Jimp;
  try {
    Jimp = require('jimp');
  } catch (e) {
    console.error('Install jimp first: npm install --save-dev jimp');
    process.exit(1);
  }

  for (const file of FILES) {
    const inputPath = path.join(ASSETS_DIR, file);
    if (!fs.existsSync(inputPath)) {
      console.warn('Skip (not found):', file);
      continue;
    }
    try {
      const image = await Jimp.read(inputPath);
      await image.writeAsync(inputPath);
      console.log('Fixed:', file);
    } catch (err) {
      console.error('Error processing', file, err.message);
      process.exit(1);
    }
  }
  console.log('Done. Re-encoded PNGs are AAPT-safe.');
}

main();
