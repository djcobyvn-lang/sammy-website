const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const filePath = 'file:///' + path.resolve(__dirname, 'index.html').split('\').join('/');
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 30000 });
  const totalH = await page.evaluate(() => document.body.scrollHeight);
  for (let i = 1; i <= 20; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.floor((totalH / 20) * i));
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 500));
  const numsTop = await page.evaluate(() => { const el = document.getElementById('numbers'); return el ? el.offsetTop : 900; });
  await page.evaluate((y) => window.scrollTo(0, y - 60), numsTop);
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: 'ss_cards_close.png', fullPage: false });
  await browser.close();
  console.log('done y=' + numsTop);
})().catch(e => { console.error(e); process.exit(1); });
