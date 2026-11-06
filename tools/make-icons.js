// renders icons/source/pfp.png into the png sizes browsers want (center-cropped to a square),
// using playwright's chromium so there's no image library to install. run: npm run icons
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SIZES = [16, 19, 32, 38, 48, 96, 128, 256];

(async () => {
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icons', 'source', 'pfp.png')).toString('base64');
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><img src="${src}" style="display:block;width:${size}px;height:${size}px;object-fit:cover"></body></html>`,
    );
    await page.waitForFunction(() => document.images[0].complete);
    const out = path.join(ROOT, 'icons', `icon-${size}.png`);
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', path.relative(ROOT, out));
  }
  await browser.close();
})();
