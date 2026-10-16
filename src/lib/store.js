// settings + packs live in storage.sync so they follow you between browsers. sync storage is TINY
// (8KB per key, 100KB total) and some browsers don't have it at all (kiwi-likes, some firefox setups),
// so: big stuff gets chopped into chunks, and if sync says no for any reason we quietly fall back to
// local and remember that we did.
(function (root) {
  const SS = (root.SpoilerShield = root.SpoilerShield || {});

  const K = {
    settings: 'ss:settings',
    packs: 'ss:packs', // chunk count lives here, chunks are ss:packs:0, ss:packs:1, ...
    builtin: 'ss:builtin', // always local: copies of the json files in packs/, written by the background
    forceLocal: 'ss:forceLocal',
    stats: 'ss:stats',
  };
  const CHUNK = 4000; // chars per chunk. ascii-escaped, so chars == bytes, and well under 8192 even with quote escaping

  const DEFAULT_SETTINGS = {
    enabled: true,
    pausedUntil: 0,
    blurPx: 24,
    revealMode: 'hold', // 'hold' (1s) or 'confirm' (click + yes)
    showMatched: false, // off by default: even the matched word can be a spoiler
    strictStreams: false, // warn before ANY gaming livestream
    collapseChat: true,
    sites: {}, // site module id -> false to turn it off. missing = on
    hostsOff: [], // hostnames switched off from the popup
    lock: { on: false, phrase: '' },
  };

  const api = () => SS.api;

  // non-ascii -> \uXXXX so chunk sizes are predictable byte counts. still valid JSON
  const asciiJson = (obj) => JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  async function pickArea() {
    const a = api();
    if (!a || !a.storage) throw new Error('no storage api (extension reloaded?)');
    const local = a.storage.local;
    let force = false;
    try {
      force = !!(await local.get(K.forceLocal))[K.forceLocal];
    } catch (e) {
      /* local broken too? then we're doomed anyway */
    }
    if (!force && a.storage.sync) {
      try {
        await a.storage.sync.get(K.settings);
        return { area: a.storage.sync, name: 'sync' };
      } catch (e) {
        /* sync exists but is grumpy. local it is */
      }
    }
    return { area: local, name: 'local' };
  }

  function readChunks(all) {
    const n = all[K.packs];
    if (!Number.isInteger(n) || n <= 0) return null;
    let json = '';
    for (let i = 0; i < n; i++) {
      const part = all[K.packs + ':' + i];
      if (typeof part !== 'string') return null; // half-written. treat as missing rather than crash
      json += part;
    }
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  // everything in one go: { settings, packState, area }
  async function loadRaw() {
    const { area, name } = await pickArea();
    const all = await area.get(null);
    const settings = { ...DEFAULT_SETTINGS, ...(all[K.settings] || {}) };
    settings.lock = { ...DEFAULT_SETTINGS.lock, ...(settings.lock || {}) };
    settings.sites = { ...(settings.sites || {}) };
    settings.hostsOff = Array.isArray(settings.hostsOff) ? settings.hostsOff : [];
    const packState = readChunks(all) || { diffs: {}, custom: {}, order: [] };
    packState.diffs = packState.diffs || {};
    packState.custom = packState.custom || {};
    packState.order = packState.order || [];
    return { settings, packState, area: name };
  }

  async function goLocal(reason) {
    const local = api().storage.local;
    await local.set({ [K.forceLocal]: reason || true });
  }

  async function write(items, removeKeys) {
    const { area, name } = await pickArea();
    try {
      await area.set(items);
      if (removeKeys && removeKeys.length) await area.remove(removeKeys);
      return name;
    } catch (e) {
      if (name !== 'sync') throw e;
      // sync full / quota / write-rate limit. copy EVERYTHING to local and stay there
      const all = await area.get(null);
      const local = api().storage.local;
      const copy = {};
      for (const [k, v] of Object.entries(all)) if (k.startsWith('ss:') && k !== K.builtin) copy[k] = v;
      Object.assign(copy, items);
      for (const k of removeKeys || []) delete copy[k];
      await local.set(copy);
      await goLocal(String(e && e.message ? e.message : e));
      return 'local';
    }
  }

  async function saveSettings(settings) {
    const clean = { ...DEFAULT_SETTINGS, ...settings };
    return write({ [K.settings]: clean });
  }

  // patch helper so callers don't clobber each other: saveSettingsPatch({ enabled: false })
  async function patchSettings(patch) {
    const { settings } = await loadRaw();
    const next = { ...settings, ...patch };
    await saveSettings(next);
    return next;
  }

  async function savePackState(state) {
    const json = asciiJson(state);
    const items = {};
    const n = Math.max(1, Math.ceil(json.length / CHUNK));
    for (let i = 0; i < n; i++) items[K.packs + ':' + i] = json.slice(i * CHUNK, (i + 1) * CHUNK);
    items[K.packs] = n;
    const { area } = await pickArea();
    const all = await area.get(null);
    const stale = Object.keys(all).filter((k) => k.startsWith(K.packs + ':') && Number(k.split(':').pop()) >= n);
    return write(items, stale);
  }

  async function getBuiltins() {
    const local = api().storage.local;
    let builtin = (await local.get(K.builtin))[K.builtin];
    if (builtin && builtin.packs) return builtin.packs;
    // content scripts can't fetch extension files, so ask the background to load + cache them
    const res = await SS.send({ type: 'ss:builtins' });
    return (res && res.packs) || {};
  }

  // the whole state the content script / popup / options page needs
  async function loadState() {
    const [raw, builtins] = await Promise.all([loadRaw(), getBuiltins()]);
    const packs = SS.packs.effectivePacks(builtins, raw.packState);
    return { ...raw, builtins, packs, livePacks: packs.filter((p) => SS.packs.isLive(p)) };
  }

  // is filtering on right now for this hostname?
  function isOn(settings, hostname) {
    if (!settings.enabled) return false;
    if (settings.pausedUntil && settings.pausedUntil > Date.now()) return false;
    if (hostname && settings.hostsOff.includes(hostname)) return false;
    return true;
  }

  function onChange(cb) {
    const a = api();
    if (!a || !a.storage || !a.storage.onChanged) return;
    let t = null;
    a.storage.onChanged.addListener((changes) => {
      if (!Object.keys(changes).some((k) => k.startsWith('ss:') && k !== K.stats)) return;
      clearTimeout(t);
      t = setTimeout(cb, 60); // chunked writes fire several events, wait for the dust to settle
    });
  }

  function checkLock(settings, typed) {
    if (!settings.lock || !settings.lock.on) return true;
    return String(typed || '').trim() === String(settings.lock.phrase || '').trim();
  }

  SS.store = {
    K, DEFAULT_SETTINGS, CHUNK,
    loadRaw, loadState, saveSettings, patchSettings, savePackState, getBuiltins, isOn, onChange, checkLock, pickArea, asciiJson,
  };
  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
