const { Jimp } = require('jimp');

async function removeTealPlanet() {
  const img = await Jimp.read('nensammy.png');
  const { width, height, data } = img.bitmap;

  const cx = 950, cy = 250, radius = 88;
  const outerSampleR = radius + 35;

  // Sample background from a ring well outside the planet, skip bright teal pixels
  let sr = 0, sg = 0, sb = 0, count = 0;
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const sx = Math.round(cx + Math.cos(angle) * outerSampleR);
    const sy = Math.round(cy + Math.sin(angle) * outerSampleR);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
    const si = (sy * width + sx) * 4;
    const r = data[si], g = data[si+1], b = data[si+2];
    // Skip pixels that are clearly part of the teal glow
    if (g > 70 && b > 90 && b > r + 25) continue;
    sr += r; sg += g; sb += b; count++;
  }
  sr = Math.round(sr/count); sg = Math.round(sg/count); sb = Math.round(sb/count);
  console.log('Space colour sampled:', sr, sg, sb, '(from', count, 'ring samples)');

  // Paint filled circle with soft feathered edge
  const feather = 18;
  for (let y = cy - radius - feather; y <= cy + radius + feather; y++) {
    for (let x = cx - radius - feather; x <= cx + radius + feather; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > radius + feather) continue;
      const idx = (y * width + x) * 4;
      const blend = dist < radius
        ? 1
        : Math.max(0, 1 - (dist - radius) / feather);
      data[idx]     = Math.round(data[idx]     * (1 - blend) + sr * blend);
      data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + sg * blend);
      data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + sb * blend);
    }
  }

  await img.write('nensammy.png');
  console.log('Done — teal planet removed.');
}

removeTealPlanet().catch(e => { console.error(e); process.exit(1); });
