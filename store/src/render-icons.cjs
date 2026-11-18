const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { almariMark } = require('./almari-mark.js');
const svg = (parts, size = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${parts.defs}${parts.body}</svg>`;
(async () => {
  const out = path.resolve(__dirname, process.argv[2] || '../icons');
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const shoot = async (parts, size, file, transparent) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(parts, size)}</body></html>`);
    await page.screenshot({ path: path.join(out, file), omitBackground: !!transparent, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shoot(almariMark(), 1024, 'icon-1024.png');
  await shoot(almariMark({ layer: 'background' }), 1024, 'adaptive-background.png');
  // Android adaptive layers: the mark sits inside the 66% safe zone, as the old foreground did.
  await shoot(almariMark({ layer: 'foreground', scale: 0.674 }), 1024, 'adaptive-foreground.png', true);
  // Web maskable icon: mark inside the 80% safe circle.
  await shoot(almariMark({ scale: 0.76 }), 1024, 'maskable-1024.png');
  await browser.close();
})();
