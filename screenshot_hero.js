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
  await new Promise(r => setTimeout(r, 1500));
  // Force all animations visible
  await page.evaluate(() => {
    document.querySelectorAll('.rev,.rev-l,.rev-r,.rev-scale').forEach(el => el.classList.add('in'));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'ss_hero_font.png', fullPage: false });
  console.log('done');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
