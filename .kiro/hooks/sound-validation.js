import fs from 'node:fs';
import path from 'node:path';

const soundsDir = path.resolve('public/sounds');
const manifestPath = path.resolve('assets/sounds/manifest.json');

if (!fs.existsSync(soundsDir) || !fs.existsSync(manifestPath)) process.exit(0);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const referenced = new Set((manifest.sounds ?? []).map((sound) => path.basename(sound.clipUrl ?? '')));
const audioFiles = fs.readdirSync(soundsDir).filter((file) => /\.(wav|mp3|ogg)$/i.test(file));
const invalid = audioFiles.filter((file) => !referenced.has(file));

if (invalid.length > 0) {
  console.error(`Audio files missing caption manifest entries: ${invalid.join(', ')}`);
  process.exit(1);
}
