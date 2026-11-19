// round 2 of launch day: the WIDE horizontal live row (thumbnail left, text right, "3.9K watching") on youtube,
// under a terminal-style theme, plus the same thing on a site we know nothing about and inside an iframe
const { test, expect, openSite } = require('./harness');

test.describe('YouTube horizontal live rows', () => {
  test('search result + both sidebar lockup styles blur, with a theme on top, no flash', async ({ context, sw }) => {
    const page = await openSite(context, 'https://www.youtube.com/results?search_query=liverow');
    for (const id of ['#search-leak', '#side-wiz', '#side-lockup']) await expect(page.locator(id)).toHaveAttribute('data-ss', 'blocked');
    for (const id of ['#search-clean', '#side-clean']) await expect(page.locator(id)).toHaveAttribute('data-ss', 'ok');
    // the whole row is covered, thumbnail included, not just the text column
    const box = await page.locator('#search-leak > ss-shield').boundingBox();
    expect(box.width).toBeGreaterThan(700);
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });
});

test.describe('Sites we have no module for', () => {
  test('wide row on a random stream directory: hidden at load, blurred, thumbnail included, no flash', async ({ context, sw }) => {
    const page = await openSite(context, 'https://streamz.example/');
    await expect(page.locator('#dir-leak')).toHaveAttribute('data-ss', 'blocked');
    await expect(page.locator('#dir-clean')).toHaveAttribute('data-ss', 'ok');
    const box = await page.locator('#dir-leak > ss-shield').boundingBox();
    expect(box.width).toBeGreaterThan(700);
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('a live card inside an about:srcdoc iframe gets checked too', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://streamz.example/');
    const frame = page.frameLocator('#embed');
    await expect(frame.locator('#frame-card')).toHaveAttribute('data-ss', 'blocked', { timeout: 8000 });
  });
});
