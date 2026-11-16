// Makes the synthetic test images the browser scenarios upload (no real documents, ever).
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const dir = path.join(__dirname, '.out', 'testimg');
fs.mkdirSync(dir, { recursive: true });

function photo(file, w, h) {
  const png = new PNG({ width: w, height: h });
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const inFace = (x - w / 2) ** 2 + (y - h * 0.42) ** 2 < (w * 0.27) ** 2;
      const n = rand() * 60;
      png.data[i] = inFace ? 214 : 110 + n;
      png.data[i + 1] = inFace ? 192 : 90 + n;
      png.data[i + 2] = inFace ? 160 : 60 + n;
      png.data[i + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(dir, file), PNG.sync.write(png));
}
photo('photo-test.png', 1200, 1500);
photo('page-2.png', 800, 1100);
console.log('made', fs.readdirSync(dir).join(', '));
