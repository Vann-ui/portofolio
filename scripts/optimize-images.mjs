// Converts the original (very heavy, base64-embedded) photos into responsive WebP files.
// Source: ./source-images  →  Output: ./public/img
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('source-images');
const OUT = path.resolve('public/img');
fs.mkdirSync(OUT, { recursive: true });

// original index → semantic name
const map = {
  'img0.jpg': 'hero-wisuda',
  'img1.jpg': 'wisuda-untan',
  'img2.png': 'kamboja',
  'img3.jpg': 'cafe',
  'img4.jpg': 'medali',
  'img5.jpg': 'portrait-wisuda',
};

for (const [file, name] of Object.entries(map)) {
  const input = path.join(SRC, file);
  if (!fs.existsSync(input)) continue;
  const meta = await sharp(input).metadata();
  for (const w of [800, 1600]) {
    await sharp(input)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(OUT, `${name}-${w}.webp`));
  }
  console.log(name, meta.width + 'x' + meta.height);
}
