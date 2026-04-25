const { Jimp } = require('jimp');
const path = require('path');

async function removeLogoBg() {
  const src = path.join(__dirname, 'logo-chu-dao.png');
  const img = await Jimp.read(src);

  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx]     / 255;
    const g = this.bitmap.data[idx + 1] / 255;
    const b = this.bitmap.data[idx + 2] / 255;

    // HSL saturation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l   = (max + min) / 2;
    const s   = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));

    // Low saturation = gray/neutral background → transparent
    // High saturation = neon glow / lines → keep
    let alpha;
    if (s < 0.18) {
      alpha = 0;
    } else if (s < 0.40) {
      alpha = Math.round(((s - 0.18) / (0.40 - 0.18)) * 255);
    } else {
      alpha = 255;
    }
    this.bitmap.data[idx + 3] = alpha;
  });

  await img.write(src);
  console.log('Logo background removed:', src);
}

removeLogoBg().catch(e => { console.error(e); process.exit(1); });
