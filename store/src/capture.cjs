// Captures real Almari screens (web build, sample family) for the Play listing.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8081';
const RAW = path.resolve(__dirname, '../raw');
fs.mkdirSync(RAW, { recursive: true });
const SETS = {
  phone: { w: 384, h: 766, dpr: 3, mobile: true },
  tab7: { w: 576, h: 996, dpr: 2.5, mobile: true },
  tab10: { w: 810, h: 1412, dpr: 2.5, mobile: true },
  chromebook: { w: 1152, h: 648, dpr: 2.5, mobile: false },
};
const SHOTS = {
  phone: [
    ['1-home', '/'],
    ['2-locker', '/locker', { dark: true }],
    ['3-person', '/person/s-papa'],
    ['4-reminders', '/reminders'],
    ['5-pack', '/extras/pack/hospital'],
    ['6-family', '/', { scrollToText: 'Family', exact: true }],
    ['7-emergency', '/extras/emergency'],
    ['8-money', '/extras/money-map'],
  ],
};
const LARGE = [['1-home', '/'], ['2-locker', '/locker'], ['3-person', '/person/s-papa'], ['4-reminders', '/reminders'], ['5-pack', '/extras/pack/hospital'], ['6-emergency', '/extras/emergency']];
SHOTS.tab7 = LARGE; SHOTS.tab10 = LARGE; SHOTS.chromebook = LARGE;

async function tidy(page, opts = {}) {
  await page.evaluate(async (opts) => {
    // The sample family's "made-up family" banner is for people trying the app, not part of a real family's home.
    const viewAs = document.querySelector('[data-testid="view-as"]');
    if (viewAs) {
      let el = viewAs;
      while (el.parentElement && !el.parentElement.textContent.includes('Namaste')) el = el.parentElement;
      el.style.display = 'none';
    }
    if (opts.scrollToText) {
      const scrollers = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 20 && ['auto', 'scroll'].includes(getComputedStyle(d).overflowY));
      const sc = scrollers.sort((a, b) => b.clientHeight - a.clientHeight)[0];
      const target = [...document.querySelectorAll('*')].find((d) => d.childElementCount === 0 && d.textContent.trim() === opts.scrollToText);
      if (sc && target) sc.scrollTop = target.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8;
    }
  }, opts);
  await page.waitForTimeout(500);
}

(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [set, v] of Object.entries(SETS)) {
    if (only && only !== set) continue;
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.dpr, isMobile: v.mobile, hasTouch: v.mobile, colorScheme: 'light', locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(800);
    await page.getByTestId('explore-sample').click();
    await page.waitForTimeout(1500);
    for (const [name, route, opts = {}] of SHOTS[set]) {
      await page.emulateMedia({ colorScheme: opts.dark ? 'dark' : 'light' });
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1400);
      await tidy(page, opts);
      await page.screenshot({ path: path.join(RAW, `${set}-${name}.png`) });
      console.log(set, name);
    }
    await ctx.close();
  }
  await browser.close();
})();
