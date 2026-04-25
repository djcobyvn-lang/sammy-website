const { Jimp } = require('jimp');
const path = require('path');

async function removeLogoBg() {
  const src  = path.join(__dirname, 'logo-chu-dao-original.png');
  const dest = path.join(__dirname, 'logo-chu-dao.png');
  const img  = await Jimp.read(src);
  const { width, height, data } = img.bitmap;

  // Sample all 4 corners to get the background colour
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [
    sample(0, 0), sample(width - 1, 0),
    sample(0, height - 1), sample(width - 1, height - 1),
  ];
  const bgR = corners.reduce((s, c) => s + c[0], 0) / 4;
  const bgG = corners.reduce((s, c) => s + c[1], 0) / 4;
  const bgB = corners.reduce((s, c) => s + c[2], 0) / 4;
  console.log(`Background colour sampled: rgb(${Math.round(bgR)}, ${Math.round(bgG)}, ${Math.round(bgB)})`);

  // Blur-estimation approach:
  // 1. Heavy-blur the image → approximates the smooth gradient background
  // 2. Subtract blurred from original → isolates the sharp neon contribution
  // 3. Boost result so neon stays bright
  // 4. mix-blend-mode:screen on the website makes black invisible
  const blurred = img.clone();
  blurred.blur(30);
  const blurData = blurred.bitmap.data;

  const BOOST = 1.8;
  img.scan(0, 0, width, height, function (x, y, idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const br = blurData[idx], bg2 = blurData[idx + 1], bb = blurData[idx + 2];

    data[idx]     = Math.min(255, Math.max(0, Math.round((r  - br)  * BOOST)));
    data[idx + 1] = Math.min(255, Math.max(0, Math.round((g  - bg2) * BOOST)));
    data[idx + 2] = Math.min(255, Math.max(0, Math.round((b  - bb)  * BOOST)));
    data[idx + 3] = 255;
  });

  await img.write(dest);
  console.log('Done →', dest);
}

removeLogoBg().catch(e => { console.error(e); process.exit(1); });
