// storage tests against a fake chrome.storage that enforces the real sync quotas
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadPack } = require('./helpers');

const SS = loadLib();
const S = SS.store;

function fakeArea(quota) {
  let data = {};
  const bytes = (k, v) => Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(v));
  return {
    _data: () => data,
    async get(keys) {
      if (keys == null) return JSON.parse(JSON.stringify(data));
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = JSON.parse(JSON.stringify(data[k]));
      return out;
    },
    async set(items) {
      const next = { ...data, ...JSON.parse(JSON.stringify(items)) };
      if (quota) {
        for (const [k, v] of Object.entries(items)) {
          if (bytes(k, v) > quota.perItem) throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
        }
        const total = Object.entries(next).reduce((n, [k, v]) => n + bytes(k, v), 0);
        if (total > quota.total) throw new Error('QUOTA_BYTES quota exceeded');
      }
      data = next;
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
    },
  };
}

function freshApi({ sync = true, total = 102400 } = {}) {
  const api = {
    runtime: { id: 'test', sendMessage: async () => undefined },
    storage: {
      local: fakeArea(null),
      onChanged: { addListener() {} },
    },
  };
  if (sync) api.storage.sync = fakeArea({ perItem: 8192, total });
  SS.api = api;
  return api;
}

test('fresh install loads defaults', async () => {
  freshApi();
  const raw = await S.loadRaw();
  assert.equal(raw.area, 'sync');
  assert.deepEqual(raw.settings, S.DEFAULT_SETTINGS);
  assert.deepEqual(raw.packState, { diffs: {}, custom: {}, order: [] });
});

test('settings save to sync and come back', async () => {
  const api = freshApi();
  await S.patchSettings({ blurPx: 30, lock: { on: true, phrase: 'i want spoilers' } });
  assert.ok(api.storage.sync._data()['ss:settings']);
  const { settings } = await S.loadRaw();
  assert.equal(settings.blurPx, 30);
  assert.equal(settings.revealMode, 'hold');
  assert.equal(S.checkLock(settings, ' i want spoilers '), true);
  assert.equal(S.checkLock(settings, 'nah'), false);
});

test('big pack state gets chunked under the 8KB-per-item limit, CJK included', async () => {
  const api = freshApi();
  const gta = loadPack('gta6.json');
  const custom = {};
  for (let i = 0; i < 3; i++) custom['copy' + i] = { ...gta, id: 'copy' + i };
  const state = { diffs: {}, custom, order: [] };
  const area = await S.savePackState(state);
  assert.equal(area, 'sync');
  const data = api.storage.sync._data();
  assert.ok(data['ss:packs'] > 3, 'should be several chunks');
  for (const [k, v] of Object.entries(data)) assert.ok(Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(v)) <= 8192, k);
  const { packState } = await S.loadRaw();
  assert.deepEqual(packState.custom.copy2.strong, gta.strong);

  // shrink it: stale chunks have to go
  await S.savePackState({ diffs: {}, custom: {}, order: [] });
  const after = api.storage.sync._data();
  assert.equal(after['ss:packs'], 1);
  assert.deepEqual(Object.keys(after).filter((k) => k.startsWith('ss:packs:')), ['ss:packs:0']);
});

test('sync quota blows up -> everything moves to local and stays there', async () => {
  const api = freshApi({ total: 20000 });
  await S.patchSettings({ blurPx: 33 });
  const gta = loadPack('gta6.json');
  const custom = { a: gta, b: { ...gta, id: 'b' } };
  const area = await S.savePackState({ diffs: {}, custom, order: [] });
  assert.equal(area, 'local');
  assert.ok(api.storage.local._data()['ss:forceLocal']);
  const raw = await S.loadRaw();
  assert.equal(raw.area, 'local');
  assert.equal(raw.settings.blurPx, 33, 'settings came along for the ride');
  assert.deepEqual(raw.packState.custom.b.weak, gta.weak);
});

test('no sync at all (kiwi-style browsers) -> local', async () => {
  freshApi({ sync: false });
  await S.patchSettings({ strictStreams: true });
  const raw = await S.loadRaw();
  assert.equal(raw.area, 'local');
  assert.equal(raw.settings.strictStreams, true);
});

test('isOn: master switch, pause, per-host off', () => {
  const s = { ...S.DEFAULT_SETTINGS };
  assert.equal(S.isOn(s, 'www.youtube.com'), true);
  assert.equal(S.isOn({ ...s, enabled: false }, 'www.youtube.com'), false);
  assert.equal(S.isOn({ ...s, pausedUntil: Date.now() + 60000 }, 'x.com'), false);
  assert.equal(S.isOn({ ...s, pausedUntil: Date.now() - 1 }, 'x.com'), true);
  assert.equal(S.isOn({ ...s, hostsOff: ['x.com'] }, 'x.com'), false);
});

test('loadState merges built-ins with your diffs', async () => {
  const api = freshApi();
  const gta = loadPack('gta6.json');
  await api.storage.local.set({ 'ss:builtin': { packs: { gta6: gta } } });
  await S.savePackState({ diffs: { gta6: { strong: { add: [['Totally New Guy', 'Added by you']], remove: [] } } }, custom: {}, order: [] });
  const st = await S.loadState();
  assert.equal(st.livePacks.length, 1);
  assert.ok(SS.packs.entries(st.livePacks[0].strong).some((e) => e.term === 'Totally New Guy'));
});
