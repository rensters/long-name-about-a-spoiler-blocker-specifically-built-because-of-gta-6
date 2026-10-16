const { test, expect, setSettings, openSite, holdReveal } = require('./harness');

const BLOCKED = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
const CLEAN = ['c1', 'c2', 'c3', 'c4', 'c5'];

test('feed: spoilers blurred, clean cards visible, nothing flashes', async ({ context, sw }) => {
  const page = await openSite(context, 'https://www.youtube.com/');
  for (const id of BLOCKED) {
    await expect(page.locator('#' + id), id).toHaveAttribute('data-ss', 'blocked');
    await expect(page.locator(`#${id} > ss-shield`)).toHaveCount(1);
  }
  for (const id of CLEAN) await expect(page.locator('#' + id), id).toHaveAttribute('data-ss', 'ok');
  const overlay = await page.locator('#s1 > ss-shield').evaluate((h) => h.shadowRoot.textContent);
  expect(overlay).toContain("Hey, it's the thing you prevented from showing up.");
  expect(overlay).toContain('Not today, spoiling shitbag.');
  expect(overlay).toContain('The Endgame Incident will never happen again!');
  // blurred for real: children get a blur filter
  const filter = await page.locator('#s1 > #content').evaluate((n) => getComputedStyle(n).filter);
  expect(filter).toContain('blur(24px)');
  expect(await page.evaluate(() => window.__flashes)).toEqual([]);
});

test('infinite scroll keeps working and new cards never flash', async ({ context, sw }) => {
  const page = await openSite(context, 'https://www.youtube.com/');
  const before = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let n = 1; n <= 4; n++) {
    await page.evaluate((i) => window.__more(i), n);
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(80);
  }
  for (let n = 1; n <= 4; n++) {
    await expect(page.locator(`#m${n}a`)).toHaveAttribute('data-ss', 'blocked');
    await expect(page.locator(`#m${n}c`)).toHaveAttribute('data-ss', 'blocked');
    await expect(page.locator(`#m${n}b`)).toHaveAttribute('data-ss', 'ok');
    await expect(page.locator(`#m${n}d`)).toHaveAttribute('data-ss', 'ok');
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__flashes)).toEqual([]);
});

test('reveal: a click does nothing, a 1s hold reveals just that card', async ({ context, sw }) => {
  const page = await openSite(context, 'https://www.youtube.com/');
  const btn = page.locator('#s1 > ss-shield button.reveal');
  await btn.click(); // quick click
  await page.waitForTimeout(400);
  await expect(page.locator('#s1')).toHaveAttribute('data-ss', 'blocked');
  // short hold (300ms) doesn't count either
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(900);
  await expect(page.locator('#s1')).toHaveAttribute('data-ss', 'blocked');

  await holdReveal(page, '#s1');
  await expect(page.locator('#s1')).toHaveAttribute('data-ss', 'revealed');
  await expect(page.locator('#s1 > ss-shield')).toHaveCount(0);
  for (const id of BLOCKED.slice(1)) await expect(page.locator('#' + id)).toHaveAttribute('data-ss', 'blocked');
});

test('reveal: click + confirm mode', async ({ context, sw }) => {
  await setSettings(sw, { revealMode: 'confirm' });
  const page = await openSite(context, 'https://www.youtube.com/');
  await page.locator('#s2 > ss-shield button.reveal').click();
  await expect(page.locator('#s2 > ss-shield .confirm')).toBeVisible();
  await page.locator('#s2 > ss-shield .confirm .no').click();
  await expect(page.locator('#s2')).toHaveAttribute('data-ss', 'blocked');
  await page.locator('#s2 > ss-shield button.reveal').click();
  await page.locator('#s2 > ss-shield .confirm .yes').click();
  await expect(page.locator('#s2')).toHaveAttribute('data-ss', 'revealed');
});

test('clicking a blurred card does not open the video underneath', async ({ context, sw }) => {
  const page = await openSite(context, 'https://www.youtube.com/');
  const url = page.url();
  await page.locator('#s3 > ss-shield').click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
});

test('watch page: GTA video gets the full-screen warning, player paused + muted until you say so', async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=gta');
  await expect(page.locator('ss-wall')).toHaveCount(1);
  // the fake player keeps calling play() every 500ms. it has to stay down
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => [document.getElementById('v').paused, document.getElementById('v').muted])).toEqual([true, true]);
  }
  const wallText = await page.locator('ss-wall').evaluate((h) => h.shadowRoot.textContent);
  expect(wallText).toContain('Not today, spoiling shitbag.');
  // the warning itself must not spoil: no title, no matched term (show-matched is off). the pack's
  // own name ("GTA VI") is fine, you named it
  expect(wallText).not.toContain('trailer analysis');
  expect(wallText).not.toContain('GTA 6');

  const btn = page.locator('ss-wall button.reveal');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(1250);
  await page.mouse.up();
  await expect(page.locator('ss-wall')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !document.getElementById('v').paused)).toBe(true);
  expect(await page.evaluate(() => document.getElementById('v').muted)).toBe(false);
});

test('live stream: clean stream plays, then the title switches to GTA mid-stream -> warning + chat collapsed', async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=lofi');
  await expect.poll(() => page.evaluate(() => !document.getElementById('v').paused), { timeout: 8000 }).toBe(true);
  await expect(page.locator('ss-wall')).toHaveCount(0);
  await page.evaluate(() => (document.getElementById('video-title').textContent = 'GTA 6 trailer rewatch stream'));
  await expect(page.locator('ss-wall')).toHaveCount(1, { timeout: 6000 });
  await expect.poll(() => page.evaluate(() => document.getElementById('v').paused)).toBe(true);
  await expect(page.locator('ytd-live-chat-frame')).toHaveAttribute('data-ss', 'blocked');
});

test('live chat messages get filtered inside the chat iframe', async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=lofi');
  const chat = page.frameLocator('#chatframe');
  await expect(chat.locator('[data-test="spoiler"]').first()).toHaveAttribute('data-ss', 'blocked');
  await expect(chat.locator('[data-test="clean"]').first()).toHaveAttribute('data-ss', 'ok');
  const frame = page.frame({ url: /live_chat/ });
  await frame.evaluate(() => window.__say('@newguy', 'leonida looks unreal', 'spoiler'));
  await expect(chat.locator('[data-test="spoiler"]').last()).toHaveAttribute('data-ss', 'blocked');
  expect(await frame.evaluate(() => window.__flashes)).toEqual([]);
});

test('toolbar badge shows how many things got blurred', async ({ context, sw }) => {
  const page = await openSite(context, 'https://www.youtube.com/');
  await expect(page.locator('[data-ss="blocked"]')).toHaveCount(BLOCKED.length);
  await expect
    .poll(() => sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      return chrome.action.getBadgeText({ tabId: tab.id });
    }))
    .toBe(String(BLOCKED.length));
});
