const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const filePath = 'file:///' + path.resolve(__dirname, 'index.html').split('\\').join('/');
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 30000 });

  // Scroll through to trigger animations
  const totalH = await page.evaluate(() => document.body.scrollHeight);
  for (let i = 1; i <= 20; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.floor((totalH / 20) * i));
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 500));

  // Scroll to numbers section
  const numsTop = await page.evaluate(() => {
    const el = document.getElementById('numbers');
    return el ? el.offsetTop : 900;
  });
  await page.evaluate((y) => window.scrollTo(0, y - 80), numsTop);
  await new Promise(r => setTimeout(r, 600));

  // Full viewport screenshot at this scroll position
  await page.screenshot({ path: 'ss_cards_zoom.png', fullPage: false });
  // Crop cards grid area (navbar ~60px + section offset)
  await page.screenshot({ path: 'ss_cards_close.png', fullPage: false, clip: { x: 20, y: 120, width: 1400, height: 360 } });
  console.log('Done at y=' + numsTop);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
