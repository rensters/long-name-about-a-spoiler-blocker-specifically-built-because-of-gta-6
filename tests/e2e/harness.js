// test harness: launches chromium with the unpacked extension and serves the fake sites in
// tests/fixtures on the REAL domains (www.youtube.com etc) via request routing. so the real manifest
// content-script matching kicks in, nothing touches the network, and nothing is faked in the extension.
const { test: base, chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const EXT = path.resolve(__dirname, '..', '..');
const FIX = path.resolve(__dirname, '..', 'fixtures');

const read = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');

// url -> fixture. first match wins. {{VAR}} placeholders get filled from `vars`
const ROUTES = [
  [/^https:\/\/www\.youtube\.com\/live_chat/, () => ({ file: 'youtube-chat.html' })],
  [/^https:\/\/www\.youtube\.com\/watch\?v=gta/, () => ({ file: 'youtube-watch.html', vars: { TITLE: 'GTA 6 trailer analysis (made-up test video)', INFO: '1.2M views · 2 days ago', CHANNEL: 'Some Gamer', CHAT: '' } })],
  [/^https:\/\/www\.youtube\.com\/watch\?v=lofi/, () => ({ file: 'youtube-watch.html', vars: { TITLE: 'lofi hip hop radio - beats to relax/study to', INFO: '12,345 watching now · Started streaming 3 hours ago', CHANNEL: 'Lofi Girl', CHAT: '<ytd-live-chat-frame id="chat"><iframe id="chatframe" src="https://www.youtube.com/live_chat?v=lofi" style="width:360px;height:420px;border:0"></iframe></ytd-live-chat-frame>' } })],
  [/^https:\/\/www\.youtube\.com\//, () => ({ file: 'youtube-home.html' })],
  [/^https:\/\/(www|old)\.reddit\.com\//, () => ({ file: 'reddit-feed.html' })],
  [/^https:\/\/x\.com\//, () => ({ file: 'x-home.html' })],
  [/^https:\/\/www\.twitch\.tv\/directory/, () => ({ file: 'twitch-browse.html' })],
  [/^https:\/\/www\.twitch\.tv\/xqc/, () => ({ file: 'twitch-channel.html', vars: { LOGIN: 'xqc', NAME: 'xQc', TITLE: 'just chatting, reacting to stuff', GAME: 'Just Chatting', SLUG: 'just-chatting' } })],
  [/^https:\/\/www\.twitch\.tv\/chillstreamer/, () => ({ file: 'twitch-channel.html', vars: { LOGIN: 'chillstreamer', NAME: 'ChillStreamer', TITLE: 'chill vibes, day 40 of hardcore', GAME: 'Minecraft', SLUG: 'minecraft' } })],
  [/^https:\/\/example\.org\//, () => ({ file: 'generic.html' })],
];

function fill(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars && k in vars ? vars[k] : ''));
}

// installed in the page's MAIN world before anything runs. every animation frame (= right before
// the browser paints) it checks whether any [data-test="spoiler"] thing is visible and not blurred.
// if one ever is, that's a flash, and the test fails.
function flashSampler() {
  window.__flashes = [];
  const exposed = (el) => {
    if (!el.isConnected) return false;
    if (el.getAttribute('data-ss') === 'blocked') return false;
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (n.getAttribute('data-ss') === 'blocked') return false;
      n = n.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const tick = () => {
    for (const el of document.querySelectorAll('[data-test="spoiler"]')) {
      if (el.getAttribute('data-ss') === 'revealed') continue; // you asked for it
      if (exposed(el)) window.__flashes.push((el.textContent || '').trim().slice(0, 60));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      viewport: { width: 1280, height: 900 },
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
    });
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!/^https?:/.test(url)) return route.continue(); // the extension's own files (popup, options) load normally
      if (route.request().resourceType() !== 'document') return route.abort(); // fixtures are self-contained
      for (const [re, make] of ROUTES) {
        if (re.test(url)) {
          const { file, vars } = make(url);
          return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fill(read(file), vars) });
        }
      }
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'no fixture for ' + url });
    });
    await context.addInitScript(flashSampler);
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    // wait until the background copied the built-in packs into storage
    await expect.poll(() => sw.evaluate(async () => !!(await chrome.storage.local.get('ss:builtin'))['ss:builtin'])).toBe(true);
    await use(sw);
  },
  extensionId: async ({ sw }, use) => {
    await use(sw.url().split('/')[2]);
  },
});

// settings helper: patch settings straight into sync storage through the service worker
async function setSettings(sw, patch) {
  await sw.evaluate(async (p) => {
    const cur = (await chrome.storage.sync.get('ss:settings'))['ss:settings'] || {};
    await chrome.storage.sync.set({ 'ss:settings': { ...cur, ...p } });
  }, patch);
}

// open a page and wait until the engine has looked at every card on it
async function openSite(context, url) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('[data-test]');
    return items.length > 0 && [...items].every((el) => el.hasAttribute('data-ss') || el.closest('[data-ss="blocked"]'));
  }, null, { timeout: 10_000 });
  return page;
}

const state = (page, sel) => page.locator(sel).getAttribute('data-ss');

async function holdReveal(page, cardSel) {
  const btn = page.locator(`${cardSel} > ss-shield`).locator('button.reveal');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1250);
  await page.mouse.up();
}

module.exports = { test, expect, setSettings, openSite, state, holdReveal, EXT };
