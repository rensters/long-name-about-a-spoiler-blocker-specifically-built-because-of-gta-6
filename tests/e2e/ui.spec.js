// popup + settings page, driven like a person would
const { test, expect, setSettings, openSite } = require('./harness');

test('popup: master switch off un-blurs open tabs, on again re-blurs', async ({ context, sw, extensionId }) => {
  const site = await openSite(context, 'https://www.youtube.com/');
  await expect(site.locator('#s1')).toHaveAttribute('data-ss', 'blocked');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await expect(popup.locator('#enabled')).toBeChecked();
  await popup.locator('.top .switch').click();
  await expect(popup.locator('#state')).toContainText('Off everywhere');
  await expect(site.locator('#s1')).not.toHaveAttribute('data-ss', 'blocked');
  await expect(site.locator('ss-shield')).toHaveCount(0);
  await popup.locator('.top .switch').click();
  await expect(site.locator('#s1')).toHaveAttribute('data-ss', 'blocked');
});

test('popup: pause for 10 minutes', async ({ context, sw, extensionId }) => {
  const site = await openSite(context, 'https://www.youtube.com/');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await popup.locator('#pause').click();
  await expect(popup.locator('#pause')).toContainText('Resume now');
  await expect(site.locator('ss-shield')).toHaveCount(0);
  const until = await sw.evaluate(async () => (await chrome.storage.sync.get('ss:settings'))['ss:settings'].pausedUntil);
  expect(until - Date.now()).toBeGreaterThan(9 * 60 * 1000);
  await popup.locator('#pause').click();
  await expect(site.locator('#s1')).toHaveAttribute('data-ss', 'blocked');
});

test('popup: quick add keyword reaches open tabs right away', async ({ context, sw, extensionId }) => {
  const site = await openSite(context, 'https://www.youtube.com/');
  await expect(site.locator('#c1')).toHaveAttribute('data-ss', 'ok'); // "Minecraft hardcore: day 1000"
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await popup.locator('#term').fill('minecraft hardcore');
  await popup.locator('#add button[type="submit"]').click();
  await expect(popup.locator('#add-msg')).toContainText('Added');
  await expect(site.locator('#c1')).toHaveAttribute('data-ss', 'blocked');
});

test('lock: switching off needs the phrase', async ({ context, sw, extensionId }) => {
  await setSettings(sw, { lock: { on: true, phrase: 'i accept my fate' } });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await popup.locator('.top .switch').click();
  await expect(popup.locator('#lockbox')).toBeVisible();
  await expect(popup.locator('#enabled')).toBeChecked();
  await popup.locator('#phrase').fill('please');
  await popup.locator('#phrase-go').click();
  await expect(popup.locator('#lock-why')).toContainText('wrong phrase');
  await expect(popup.locator('#enabled')).toBeChecked();
  await popup.locator('#phrase').fill('i accept my fate');
  await popup.locator('#phrase-go').click();
  await expect(popup.locator('#enabled')).not.toBeChecked();
});

test('settings: locked page refuses changes until unlocked', async ({ context, sw, extensionId }) => {
  await setSettings(sw, { lock: { on: true, phrase: 'i accept my fate' } });
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await expect(opts.locator('#lockgate')).toBeVisible();
  await expect(opts.locator('body')).toHaveClass(/locked/);
  await opts.locator('#unlock-phrase').fill('i accept my fate');
  await opts.locator('#unlock-go').click();
  await expect(opts.locator('#lockgate')).toBeHidden();
  await opts.locator('#strict').check();
  await expect.poll(() => sw.evaluate(async () => (await chrome.storage.sync.get('ss:settings'))['ss:settings'].strictStreams)).toBe(true);
});

test('settings: edit the pack, test box explains matches, expiry date saves', async ({ context, sw, extensionId }) => {
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await expect(opts.locator('.pack').first()).toContainText('GTA VI');

  await opts.locator('#test-text').fill('Jason and Lucia in the new trailer');
  await expect(opts.locator('#test-out')).toContainText('Would blur');
  await opts.locator('#test-text').fill('my friend Raul');
  await expect(opts.locator('#test-out')).toContainText('Would NOT blur');

  await opts.locator('.pack').first().getByRole('button', { name: 'Edit' }).click();
  const strong = opts.locator('#ed-strong');
  await strong.fill((await strong.inputValue()) + '\n// Added by you\nZebra Unicorn Quest');
  await opts.locator('#ed-save').click();
  await expect(opts.locator('#ed-msg')).toContainText('Saved');
  await opts.locator('#test-text').fill('zebra unicorn quest gameplay');
  await expect(opts.locator('#test-out')).toContainText('Would blur');
  const diff = await sw.evaluate(async () => {
    const all = await chrome.storage.sync.get(null);
    let json = '';
    for (let i = 0; i < all['ss:packs']; i++) json += all['ss:packs:' + i];
    return JSON.parse(json).diffs.gta6;
  });
  expect(diff.strong.add).toEqual([['Zebra Unicorn Quest', 'Added by you']]);

  await opts.locator('.pack').first().locator('input[type="date"]').fill('2027-02-20');
  await opts.locator('.pack').first().locator('input[type="date"]').dispatchEvent('change');
  await expect.poll(() => sw.evaluate(async () => {
    const all = await chrome.storage.sync.get(null);
    let json = '';
    for (let i = 0; i < all['ss:packs']; i++) json += all['ss:packs:' + i];
    return JSON.parse(json).diffs.gta6.set && JSON.parse(json).diffs.gta6.set.expires;
  })).toBe('2027-02-20');
});

test('settings: change the spoiler text, open tabs show it right away', async ({ context, sw, extensionId }) => {
  const site = await openSite(context, 'https://www.youtube.com/');
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await expect(opts.locator('#ov-text')).toHaveValue(/Not today, spoiling shitbag\./);
  await opts.locator('#ov-text').fill('nope, not for you\nwait for the PC version');
  await expect(opts.locator('#pv-lines')).toContainText('nope, not for you'); // live preview
  await opts.locator('#ov-save').click();
  await expect(opts.locator('#ov-msg')).toContainText('Saved');
  await expect.poll(() => site.locator('#s1 > ss-shield').evaluate((h) => h.shadowRoot.textContent)).toContain('wait for the PC version');
  await opts.locator('#ov-reset').click();
  await expect.poll(() => site.locator('#s1 > ss-shield').evaluate((h) => h.shadowRoot.textContent)).toContain('Not today, spoiling shitbag.');
});
