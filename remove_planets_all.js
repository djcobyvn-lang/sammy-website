const { Jimp } = require('jimp');

async function run() {
  const orig = await Jimp.read('C:/Users/Admin/Downloads/nensammy.png');
  const img  = orig.clone();
  const { width, height, data } = img.bitmap;
  const src  = orig.bitmap.data;

  function sp(x, y) {
    const xi = Math.max(0, Math.min(width-1,  Math.round(x)));
    const yi = Math.max(0, Math.min(height-1, Math.round(y)));
    const i  = (yi * width + xi) * 4;
    return [src[i], src[i+1], src[i+2]];
  }
  function di(x, y) {
    return (Math.max(0,Math.min(height-1,Math.round(y)))*width +
            Math.max(0,Math.min(width-1, Math.round(x))))*4;
  }

  function hsl(r,g,b) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    const l=(max+min)/2;
    const s=max===min ? 0 : (max-min)/(1-Math.abs(2*l-1));
    return {l, s};
  }

  // isPlanet: true if pixel is clearly planet material (not dark space or faint nebula)
  function isPlanet(r, g, b) {
    const {l, s} = hsl(r, g, b);
    // Rocky planet body: medium brightness + low saturation
    if (l > 0.15 && l < 0.65 && s < 0.25) return true;
    // Colourful planet / ring: medium brightness + higher saturation
    if (l > 0.12 && s > 0.28) return true;
    return false;
  }

  // Replace planet pixels using same-column vertical clone (no horizontal tiling).
  // donorDY: vertical offset into the clean donor strip.
  function verticalClone(x0, x1, y0, y1, donorDY, feather = 20) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const [r, g, b] = sp(x, y);
        if (!isPlanet(r, g, b)) continue;

        const edge  = Math.min(x-x0, x1-x, y-y0, y1-y);
        const blend = Math.min(1, edge / feather);

        // Add small hash offset to break any residual pattern
        const jitter = ((x * 7 + y * 13) & 0x0F) - 8; // -8..+7
        const [dr, dg, db] = sp(x + jitter, y + donorDY);

        const idx = di(x, y);
        data[idx]   = Math.round(r*(1-blend) + dr*blend);
        data[idx+1] = Math.round(g*(1-blend) + dg*blend);
        data[idx+2] = Math.round(b*(1-blend) + db*blend);
      }
    }
  }

  // ── Saturn + ring  (left side  x:0→450  y:0→860) ──────────────────────────
  // Donor: same columns but y+900 (bottom of image = dark space, same x strip)
  console.log('Removing Saturn...');
  verticalClone(0, 450, 0, 860, +900, 24);

  // ── Teal planet  (upper right  x:830→1086  y:120→390) ─────────────────────
  // Donor: same x, y+700 (lower dark area)
  console.log('Removing teal planet...');
  verticalClone(830, width, 120, 390, +700, 16);

  // ── Large purple/pink planet  (right  x:650→1086  y:380→860) ──────────────
  // Donor: same columns but y-360 (upper dark area at same x)
  console.log('Removing purple planet...');
  verticalClone(650, width, 380, 860, -360, 24);

  await img.write('C:/Users/Admin/website sammy/nensammy.png');
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
