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
  console.log('Loading:', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Scroll through entire page to trigger all scroll animations
  const totalH = await page.evaluate(() => document.body.scrollHeight);
  for (let i = 1; i <= 25; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.floor((totalH / 25) * i));
    await new Promise(r => setTimeout(r, 150));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));

  // Hero screenshot
  await page.screenshot({ path: 'ss_hero.png', fullPage: false });
  console.log('Hero done');

  // Numbers section
  const numsY = await page.evaluate(() => {
    const el = document.getElementById('numbers');
    return el ? el.getBoundingClientRect().top + window.scrollY - 80 : 900;
  });
  await page.evaluate((y) => window.scrollTo(0, y), numsY);
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'ss_numbers.png', fullPage: false });
  console.log('Numbers done at y=' + numsY);

  // Full page
  await page.screenshot({ path: 'ss_full.png', fullPage: true });
  console.log('Full page done');

  await browser.close();
  console.log('All done.');
})().catch(e => { console.error(e); process.exit(1); });
