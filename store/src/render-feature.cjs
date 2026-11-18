const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'feature.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, process.argv[2] || '../feature.png') });
  await browser.close();
})();
