// Turns raw captures into Play screenshots: captioned phone shots on almari green,
// and full-bleed tablet and Chromebook shots (Play crops text on large screens).
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RAW = path.resolve(__dirname, '../raw');
const OUT = path.resolve(__dirname, process.argv[2] || '../play');

const PHONE = [
  ['1-home', 'Every family paper, in one almari', 'Ghar ke saare kaagaz, ek jagah.'],
  ['2-locker', 'Passwords and bank details, locked', 'Encrypted on your phone. Not even we can read them.', true],
  ['3-person', 'Aadhaar, PAN, licence in three taps', 'Every number for every member, ready to copy.'],
  ['4-reminders', 'Know before anything expires', 'Licence, insurance, PUC and passport dates in one list.'],
  ['5-pack', 'One PDF for the moment of need', 'Hospital, bank KYC, school admission, travel.'],
  ['6-family', 'Made for the whole family', 'See what is saved, and what is still missing.'],
  ['7-emergency', 'Blood group, allergies, who to call', 'An emergency card for every member, even offline.'],
  ['8-money', 'Every account, and its nominee', 'Spot what has no nominee, before it matters.'],
];
const LARGE = ['1-home', '2-locker', '3-person', '4-reminders', '5-pack', '6-emergency'];

const statusBar = (h, dark) => {
  const ink = dark ? '#F2EDE3' : '#1D1B16';
  const u = h / 30; // the bar is 30 units tall
  return `<div style="height:${h}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${22 * u}px 0 ${24 * u}px;background:${dark ? '#12110E' : '#F4EFE6'};color:${ink};font:600 ${14.5 * u}px/1 'Anek';letter-spacing:${0.2 * u}px">
    <span>9:30</span>
    <svg height="${13 * u}" viewBox="0 0 62 14" fill="${ink}">
      <path d="M2 11.5a1.2 1.2 0 0 1 1.2-1.2h.6a1.2 1.2 0 0 1 1.2 1.2v1.3H2zM6.3 9a1.2 1.2 0 0 1 1.2-1.2h.6A1.2 1.2 0 0 1 9.3 9v3.8h-3zM10.6 6.4a1.2 1.2 0 0 1 1.2-1.2h.6a1.2 1.2 0 0 1 1.2 1.2v6.4h-3zM14.9 3.8a1.2 1.2 0 0 1 1.2-1.2h.6a1.2 1.2 0 0 1 1.2 1.2v9h-3z"/>
      <path d="M30 13.2 21.6 4.4a12 12 0 0 1 16.8 0z"/>
      <rect x="43" y="2.2" width="16.5" height="10.6" rx="3" fill="none" stroke="${ink}" stroke-width="1.4"/>
      <rect x="45" y="4.2" width="12.5" height="6.6" rx="1.6"/>
      <rect x="60.3" y="5.6" width="1.6" height="3.8" rx="0.8"/>
    </svg>
  </div>`;
};

const page = (w, h, body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${path.resolve(__dirname, 'fonts.css')}">
<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}*{box-sizing:border-box}${extra}</style></head><body>${body}</body></html>`;

function phoneHtml([name, title, sub, dark]) {
  const W = 1440, H = 2560, cardW = 936, s = cardW / 384, sb = Math.round(30 * s), appH = Math.round(766 * s);
  const top = 540, left = (W - cardW) / 2;
  const body = `
  <div style="position:relative;width:${W}px;height:${H}px;background:radial-gradient(ellipse 1300px 1500px at 30% 8%,#4A7563 0%,#35594B 48%,#24413A 100%);">
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,0.022) 0 2px,transparent 2px 120px)"></div>
    <div style="position:absolute;left:72px;top:${top + 70}px;width:600px;height:2200px;border:3px solid rgba(210,178,122,0.16);border-radius:90px"></div>
    <div style="position:absolute;right:72px;top:${top + 70}px;width:600px;height:2200px;border:3px solid rgba(210,178,122,0.16);border-radius:90px"></div>
    <div style="position:absolute;left:100px;right:100px;top:148px;text-align:center;color:#FFFCF6">
      <div style="font:700 92px/1.06 'Eczar';letter-spacing:-0.8px;text-wrap:balance">${title}</div>
      <div style="font:500 44px/1.25 'Anek';color:#E6C892;margin-top:24px;text-wrap:balance">${sub}</div>
    </div>
    <div style="position:absolute;left:${left}px;top:${top}px;width:${cardW}px;height:${sb + appH}px;border-radius:58px;overflow:hidden;background:${dark ? '#12110E' : '#F4EFE6'};
      box-shadow:0 50px 110px rgba(6,18,13,0.5),0 0 0 2px rgba(255,255,255,${dark ? 0.14 : 0.25})">
      ${statusBar(sb, dark)}
      <img src="${RAW}/phone-${name}.png" style="display:block;width:${cardW}px;height:${appH}px">
    </div>
  </div>`;
  return { html: page(W, H, body), W, H, file: `phone/${name}.png`, cap: { top: 148 } };
}

function largeHtml(set, name) {
  const spec = { tab7: [1440, 2560, 576, 996], tab10: [1800, 3200, 810, 1412] }[set];
  const [W, H, dpW, appDp] = spec;
  const s = W / dpW, sb = H - Math.round(appDp * s);
  const body = `<div style="width:${W}px;height:${H}px;background:#F4EFE6">${statusBar(sb, false)}
    <img src="${RAW}/${set}-${name}.png" style="display:block;width:${W}px;height:${H - sb}px"></div>`;
  return { html: page(W, H, body), W, H, file: `${set === 'tab7' ? 'tablet-7in' : 'tablet-10in'}/${name}.png` };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
  const jobs = [...PHONE.map(phoneHtml), ...['tab7', 'tab10'].flatMap((set) => LARGE.map((n) => largeHtml(set, n)))];
  fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
  for (const job of jobs) {
    fs.mkdirSync(path.dirname(path.join(OUT, job.file)), { recursive: true });
    const tmp = path.join(__dirname, '../tmp', job.file.replace(/\//g, '_') + '.html');
    fs.writeFileSync(tmp, job.html);
    const p = await browser.newPage({ viewport: { width: job.W, height: job.H }, deviceScaleFactor: 1 });
    await p.goto('file://' + tmp);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    if (job.cap) {
      const capH = await p.evaluate(() => { const r = document.querySelector('div[style*="top:148px"]').getBoundingClientRect(); return r.bottom; });
      console.log(job.file, 'caption bottom', Math.round(capH), (capH / job.H * 100).toFixed(1) + '%');
    }
    await p.screenshot({ path: path.join(OUT, job.file) });
    await p.close();
  }
  // Chromebook: the app full-bleed, as it runs in a maximised window.
  fs.mkdirSync(path.join(OUT, 'chromebook'), { recursive: true });
  for (const n of LARGE) fs.copyFileSync(path.join(RAW, `chromebook-${n}.png`), path.join(OUT, 'chromebook', `${n}.png`));
  await browser.close();
})();
