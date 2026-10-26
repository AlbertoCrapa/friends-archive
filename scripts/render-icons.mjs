// Renders every PNG icon and iOS splash screen from app/icon.svg. Run after
// changing the mark:
//   node scripts/render-icons.mjs
// Apple icons are full-bleed squares (iOS applies its own mask; transparent
// corners would show as black), so the plate's corner radius is dropped there.
// The same square doubles as Android's maskable icon: the rings reach 23.75
// from the centre, inside the 25.6 safe circle.
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { SPLASH_SCREENS } from '../lib/splash.mjs';

const svg = readFileSync('app/icon.svg', 'utf8');
const square = svg.replace(/ rx="[\d.]+"/g, '');
const render = (src, size) =>
  sharp(Buffer.from(src), { density: (72 * size) / 64 }).resize(size, size).png().toBuffer();

const out = [
  [svg, 192, 'public/icon-192.png'],
  [svg, 512, 'public/icon-512.png'],
  [square, 512, 'public/icon-maskable-512.png'],
  [square, 180, 'app/apple-icon.png'],
  [square, 180, 'public/apple-touch-icon.png'],
];

for (const [src, size, file] of out) {
  await sharp(await render(src, size)).toFile(file);
  console.log(file);
}

// iOS splash: the rounded icon centred on the app's background colour, about
// the size the home-screen icon would be if it zoomed in.
mkdirSync('public/splash', { recursive: true });
for (const { width, height, file } of SPLASH_SCREENS) {
  const size = Math.round(width * 0.3);
  await sharp({ create: { width, height, channels: 4, background: '#0b0b0f' } })
    .composite([{ input: await render(svg, size), gravity: 'center' }])
    .png()
    .toFile(`public${file}`);
  console.log(`public${file}`);
}
