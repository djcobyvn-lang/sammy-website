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
  await new Promise(r => setTimeout(r, 1000));

  // Step 1: get page height, scroll through 40 steps to trigger all animations
  const totalH = await page.evaluate(() => document.body.scrollHeight);
  for (let i = 1; i <= 40; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.floor((totalH / 40) * i));
    await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Step 2: get absolute page offsetTop of #numbers section (walk offsetParent chain)
  const sectionTop = await page.evaluate(() => {
    let el = document.getElementById('numbers');
    let top = 0;
    while (el) { top += el.offsetTop; el = el.offsetParent; }
    return top;
  });
  console.log('numbers section offsetTop:', sectionTop);

  // Step 3: scroll to show the section (navbar is ~70px, so subtract it)
  await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 70)), sectionTop);
  await new Promise(r => setTimeout(r, 1200));

  // Step 4: force-add .in to any rev elements still invisible
  await page.evaluate(() => {
    document.querySelectorAll('.rev,.rev-l,.rev-r,.rev-scale').forEach(el => el.classList.add('in'));
  });
  await new Promise(r => setTimeout(r, 800));

  // Step 5: get grid rect
  const rect = await page.evaluate(() => {
    const el = document.querySelector('.numbers-grid');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
  });
  console.log('grid rect:', JSON.stringify(rect));

  // Full viewport
  await page.screenshot({ path: 'ss_cards_final.png', fullPage: false });
  console.log('Saved ss_cards_final.png');

  // Grid crop
  if (rect && rect.top >= 0 && rect.top < 800) {
    await page.screenshot({
      path: 'ss_cards_grid.png',
      fullPage: false,
      clip: { x: rect.left - 30, y: Math.max(0, rect.top - 20), width: rect.width + 60, height: rect.height + 40 }
    });
    console.log('Saved ss_cards_grid.png rect:', rect);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
