// renders icons/icon.svg into the png sizes browsers want, using playwright's chromium because
// installing an svg library just for this felt dumb. run: npm run icons
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SIZES = [16, 19, 32, 38, 48, 96, 128, 256];

(async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'icons', 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    const out = path.join(ROOT, 'icons', `icon-${size}.png`);
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', path.relative(ROOT, out));
  }
  await browser.close();
})();
