// reddit, x, twitch and generic sites. one test per behaviour, fake pages with real markup.
const { test, expect, setSettings, openSite } = require('./harness');

const expectAll = async (page, sel, value) => {
  const n = await page.locator(sel).count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(page.locator(sel).nth(i)).toHaveAttribute('data-ss', value);
};

test.describe('Reddit', () => {
  test('posts and comments: by words, by subreddit, replies judged on their own', async ({ context, sw }) => {
    const page = await openSite(context, 'https://www.reddit.com/');
    await expectAll(page, 'shreddit-post[data-test="spoiler"]', 'blocked');
    await expectAll(page, 'shreddit-post[data-test="clean"]', 'ok');
    await expect(page.locator('shreddit-comment[thingid="t1_a"]')).toHaveAttribute('data-ss', 'blocked'); // weak + weak
    await expect(page.locator('shreddit-comment[thingid="t1_b"]')).toHaveAttribute('data-ss', 'ok'); // its reply is the spoiler, not it
    await expect(page.locator('shreddit-comment[thingid="t1_c"]')).toHaveAttribute('data-ss', 'blocked');
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('r/GTA6 gets the full-page block screen, r/aww does not', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://www.reddit.com/r/GTA6/');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    expect(await page.locator('ss-wall').evaluate((h) => h.shadowRoot.textContent)).toContain('nope, blocked subreddit');
    await page.goto('https://www.reddit.com/r/aww/');
    await page.waitForTimeout(800);
    await expect(page.locator('ss-wall')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).visibility)).toBe('visible');
  });
});

test.describe('X / Twitter', () => {
  test('timeline, quotes, image alt text and trends', async ({ context, sw }) => {
    const page = await openSite(context, 'https://x.com/home');
    await expectAll(page, 'article[data-test="spoiler"]', 'blocked');
    await expectAll(page, 'article[data-test="clean"]', 'ok');
    await expectAll(page, '[data-testid="trend"][data-test="spoiler"]', 'blocked');
    await expectAll(page, '[data-testid="trend"][data-test="clean"]', 'ok');
    // the virtual-list wrappers are never touched, only the article inside
    expect(await page.locator('[data-testid="cellInnerDiv"][data-ss]').count()).toBe(0);
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });
});

test.describe('Twitch', () => {
  test('browse: GTA VI category cards blurred even with a clean title, sidebar too', async ({ context, sw }) => {
    const page = await openSite(context, 'https://www.twitch.tv/directory/all');
    await expectAll(page, 'article[data-test="spoiler"]', 'blocked');
    await expectAll(page, 'article[data-test="clean"]', 'ok');
    await expectAll(page, '.side-nav-card[data-test="spoiler"]', 'blocked');
    await expectAll(page, '.side-nav-card[data-test="clean"]', 'ok');
    expect(await page.evaluate(() => window.__flashes)).toEqual([]);
  });

  test('the GTA VI category directory page is blocked', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://www.twitch.tv/directory/category/grand-theft-auto-vi');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    expect(await page.locator('ss-wall').evaluate((h) => h.shadowRoot.textContent)).toContain('nope, blocked category');
  });

  test('clean stream plays, chat spoilers blurred, category switches to GTA VI mid-stream -> warning', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://www.twitch.tv/chillstreamer');
    await expect.poll(() => page.evaluate(() => !document.getElementById('v').paused), { timeout: 8000 }).toBe(true);
    await expect(page.locator('ss-wall')).toHaveCount(0);
    await expect(page.locator('.chat-line__message[data-test="spoiler"]')).toHaveAttribute('data-ss', 'blocked');
    await expect(page.locator('.chat-line__message[data-test="clean"]')).toHaveAttribute('data-ss', 'ok');
    await page.evaluate(() => window.__say('newbie', 'just saw jason duval in a clip', 'spoiler'));
    await expect(page.locator('.chat-line__message[data-test="spoiler"]').last()).toHaveAttribute('data-ss', 'blocked');

    await page.evaluate(() => window.__switchCategory('Grand Theft Auto VI', 'grand-theft-auto-vi'));
    await expect(page.locator('ss-wall')).toHaveCount(1, { timeout: 6000 });
    await expect.poll(() => page.evaluate(() => [document.getElementById('v').paused, document.getElementById('v').muted])).toEqual([true, true]);
    await expect(page.locator('.stream-chat')).toHaveAttribute('data-ss', 'blocked');
  });

  test('watchlist streamer: warning before anything plays, no matter the title', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://www.twitch.tv/xqc');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => document.getElementById('v').paused)).toBe(true);
    }
  });

  test('strict streams mode warns before any gaming stream', async ({ context, sw }) => {
    await setSettings(sw, { strictStreams: true });
    const page = await context.newPage();
    await page.goto('https://www.twitch.tv/chillstreamer');
    await expect(page.locator('ss-wall')).toHaveCount(1);
    expect(await page.locator('ss-wall').evaluate((h) => h.shadowRoot.textContent)).toContain('strict streams mode is on');
  });
});

test.describe('Generic sites', () => {
  test('paragraphs, list items and image alt text with strong terms get blurred, weak-only stays', async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto('https://example.org/news');
    await expectAll(page, '[data-test="spoiler"]', 'blocked');
    for (const el of await page.locator('[data-test="clean"]').all()) expect(await el.getAttribute('data-ss')).toBeNull();
  });

  test('per-site off switch (from the popup) leaves the site alone', async ({ context, sw }) => {
    await setSettings(sw, { hostsOff: ['example.org'] });
    const page = await context.newPage();
    await page.goto('https://example.org/news');
    await page.waitForTimeout(800);
    expect(await page.locator('[data-ss]').count()).toBe(0);
  });
});

test.describe('X / Twitter reveal (bug report 2026-10-17)', () => {
  const POST = 'article:has(a[href="/newsguy/status/1111"])';

  test('one hold is enough even when the post updates mid-hold (like counter ticking)', async ({ context, sw }) => {
    const page = await openSite(context, 'https://x.com/home');
    await expect(page.locator(POST)).toHaveAttribute('data-ss', 'blocked');
    const btn = page.locator(`${POST} > ss-shield button.reveal`);
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 8);
    await page.mouse.down();
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(250);
      await page.evaluate((n) => {
        document.querySelector('a[href="/newsguy/status/1111"]').closest('article').querySelector('[data-testid="like"]').textContent = String(12 + n);
      }, i + 1);
    }
    await page.waitForTimeout(200);
    await page.mouse.up();
    await expect(page.locator(POST)).toHaveAttribute('data-ss', 'revealed');
  });

  test('stays revealed when X re-renders or re-creates the post', async ({ context, sw }) => {
    const page = await openSite(context, 'https://x.com/home');
    const btn = page.locator(`${POST} > ss-shield button.reveal`);
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 8);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    await expect(page.locator(POST)).toHaveAttribute('data-ss', 'revealed');
    // counter + timestamp update in place
    await page.evaluate(() => {
      const a = document.querySelector('a[href="/newsguy/status/1111"]').closest('article');
      a.querySelector('[data-testid="like"]').textContent = '99';
      a.querySelector('time').textContent = '3m';
    });
    await page.waitForTimeout(600);
    await expect(page.locator(POST)).toHaveAttribute('data-ss', 'revealed');
    // react throws the node away and makes a fresh one (what X's virtual list does when you scroll)
    await page.evaluate(() => {
      const old = document.querySelector('a[href="/newsguy/status/1111"]').closest('article');
      const fresh = document.createElement('div');
      fresh.innerHTML = old.outerHTML.replace(/ data-ss(-[a-z]+)?="[^"]*"/g, '').replace(/<ss-shield[\s\S]*?<\/ss-shield>/g, '');
      old.replaceWith(fresh.firstElementChild);
    });
    await page.waitForTimeout(600);
    await expect(page.locator(POST)).toHaveAttribute('data-ss', 'revealed');
    await expect(page.locator(`${POST} > ss-shield`)).toHaveCount(0);
    // other spoiler posts are still blurred
    await expect(page.locator('article[data-test="spoiler"][data-ss="blocked"]')).toHaveCount(3);
  });
});
