// kick, the launch day leak, and the stuff around it (lazy titles, recycled cards, shadow dom, guide sites).
// if "the exact leaked card blurs" ever fails again, that's a red alert. ren will find out the hard way
const { test, expect, openSite } = require('./harness');

const expectAll = async (page, sel, value) => {
  const n = await page.locator(sel).count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(page.locator(sel).nth(i)).toHaveAttribute('data-ss', value);
};

test.describe('Kick', () => {
  test('the exact launch-day leaked card blurs, with no flash', async ({ context, sw }) => {
    const page = await openSite(context, 'https://kick.com/');
    await expect(page.locator('#leak')).toHaveAttribute('data-ss', 'blocked');
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('every spelling variant blurs, the false positives stay', async ({ context, sw }) => {
    const page = await openSite(context, 'https://kick.com/');
    await expectAll(page, '#variants [data-test="spoiler"]', 'blocked');
    for (const id of ['#calm', '#rp', '#speedrun']) await expect(page.locator(id)).toHaveAttribute('data-ss', 'ok');
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('lazy title: card stays hidden until the title shows up, then blurs. never visible in between', async ({ context, sw }) => {
    const page = await openSite(context, 'https://kick.com/');
    await page.evaluate(() => window.__addLazy());
    await page.waitForTimeout(250);
    expect(await page.locator('#lazy').getAttribute('data-ss')).toBeNull(); // still waiting, still invisible
    await expect(page.locator('#lazy')).toHaveAttribute('data-ss', 'blocked', { timeout: 3000 });
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('recycled card: a checked-ok card that gets a new title is checked again', async ({ context, sw }) => {
    const page = await openSite(context, 'https://kick.com/');
    await expect(page.locator('#calm')).toHaveAttribute('data-ss', 'ok');
    await page.evaluate(() => window.__recycle());
    await expect(page.locator('#calm')).toHaveAttribute('data-ss', 'blocked');
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('cards inside an open shadow root get checked too', async ({ context, sw }) => {
    const page = await openSite(context, 'https://kick.com/');
    await expect.poll(() => page.evaluate(() => document.querySelector('#shadowcard').shadowRoot.querySelector('[data-testid]').getAttribute('data-ss'))).toBe('blocked');
  });

  test('GTA VI category page and gta-6 slug pages get the full block screen', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://kick.com/category/grand-theft-auto-vi');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    await page.goto('https://kick.com/video/gta-6-day-1-highlights');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    await page.goto('https://kick.com/category/minecraft');
    await page.waitForTimeout(800);
    await expect(page.locator('ss-wall')).toHaveCount(0);
  });
});

test.describe('Twitch fallback', () => {
  test('a card shape nobody told us about still gets found by its LIVE badge', async ({ context, sw }) => {
    const page = await openSite(context, 'https://www.twitch.tv/directory/all');
    await expect(page.locator('#mystery')).toHaveAttribute('data-ss', 'blocked');
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });
});

test.describe('Guide + wiki pages', () => {
  test('blocked guide sites get the full block screen, other wiki pages are fine', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://www.powerpyx.com/gta-6-walkthrough-all-missions/');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    await page.goto('https://gta.fandom.com/wiki/Grand_Theft_Auto_VI');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    await page.goto('https://gta.fandom.com/wiki/Vice_City_Stories');
    await page.waitForTimeout(800);
    await expect(page.locator('ss-wall')).toHaveCount(0);
  });
});
