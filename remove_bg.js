const { Jimp } = require('jimp');
const path = require('path');

const icons = [
  'icon duong doi.png',
  'icon van menh.png',
  'icon linh hon.png',
  'icon tinh cach.png',
  'icon ngay sinh.png',
];

const ICON_DIR = path.join(__dirname, 'icons');

async function removeDarkBackground(filename) {
  const src = path.join(ICON_DIR, filename);
  const img = await Jimp.read(src);

  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    // Perceived brightness (0-255)
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    // Dark background: brightness < 55 → fully transparent
    // Transition zone 55–120 → partial alpha for smooth edges
    // Bright icon art: brightness > 120 → fully opaque
    let alpha;
    if (brightness < 55) {
      alpha = 0;
    } else if (brightness < 120) {
      alpha = Math.round(((brightness - 55) / (120 - 55)) * 255);
    } else {
      alpha = 255;
    }

    this.bitmap.data[idx + 3] = alpha;
  });

  await img.write(src);
  console.log('Done:', filename);
}

(async () => {
  for (const f of icons) {
    await removeDarkBackground(f);
  }
  console.log('All icons processed.');
})().catch(e => { console.error(e); process.exit(1); });
