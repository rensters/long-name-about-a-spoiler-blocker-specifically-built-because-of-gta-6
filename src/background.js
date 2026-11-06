// hey, why are you looking at this? ok fine. this is the background: badge number, built-in pack files,
// the pause timer and the "your GTA VI pack switches off in 3 days" pings. chromium runs it as a service worker
// (it naps whenever it wants, so NOTHING important lives in memory, don't even try), firefox runs it as an
// event page via "scripts" in the manifest. same file both ways. you're welcome
if (typeof importScripts === 'function' && !(globalThis.SpoilerShield && globalThis.SpoilerShield.store)) {
  importScripts('lib/shim.js', 'lib/normalize.js', 'lib/packs.js', 'lib/store.js');
}

(function () {
  const SS = globalThis.SpoilerShield;
  const api = SS.api;
  const action = api.action || api.browserAction;
  const DAILY = 'ss:daily';
  const RESUME = 'ss:resume';

  // ---------- built-in packs (content scripts can't read extension files, so we copy them to storage) ----------
  async function loadBuiltins() {
    const index = await (await fetch(api.runtime.getURL('packs/index.json'))).json();
    const packs = {};
    for (const file of index.builtin || []) {
      try {
        const p = await (await fetch(api.runtime.getURL('packs/' + file))).json();
        if (p && p.id) packs[p.id] = p;
      } catch (e) {
        console.warn('[no spoilers] couldn\'t load pack', file, e); // a broken json shouldn't take the others down
      }
    }
    const version = api.runtime.getManifest().version;
    await api.storage.local.set({ [SS.store.K.builtin]: { version, packs, at: Date.now() } });
    return packs;
  }

  // ---------- badge: per tab, summed over frames (youtube chat iframe counts too) ----------
  const counts = new Map(); // tabId -> Map(frameId -> n)

  async function paintBadge(tabId) {
    const frames = counts.get(tabId);
    let n = 0;
    if (frames) for (const v of frames.values()) n += v;
    try {
      await action.setBadgeText({ tabId, text: n > 0 ? (n > 99 ? '99+' : String(n)) : '' });
      await action.setBadgeBackgroundColor({ tabId, color: '#ff3d6e' });
      if (action.setBadgeTextColor) await action.setBadgeTextColor({ tabId, color: '#ffffff' });
    } catch (e) {
      /* tab closed mid-update. it happens, chill */
    }
  }

  api.tabs.onRemoved.addListener((tabId) => counts.delete(tabId));
  api.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'loading') return;
    counts.delete(tabId); // fresh page, fresh count. the content script will tell us its number in a sec, relax
    paintBadge(tabId);
  });

  // ---------- messages from content scripts / popup ----------
  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'ss:builtins') {
      api.storage.local
        .get(SS.store.K.builtin)
        .then((r) => (r[SS.store.K.builtin] && r[SS.store.K.builtin].packs) || loadBuiltins())
        .then((packs) => sendResponse({ packs }))
        .catch(() => sendResponse({ packs: {} }));
      return true; // async response. yes this has to return true. don't ask
    }
    if (msg.type === 'ss:count' && sender.tab) {
      const tabId = sender.tab.id;
      if (!counts.has(tabId)) counts.set(tabId, new Map());
      counts.get(tabId).set(sender.frameId || 0, Math.max(0, Number(msg.count) || 0));
      paintBadge(tabId);
      return;
    }
    if (msg.type === 'ss:options') {
      api.runtime.openOptionsPage();
      return;
    }
    if (msg.type === 'ss:reload-builtins') {
      loadBuiltins().then((packs) => sendResponse({ packs }));
      return true;
    }
  });

  // ---------- pause + expiry ----------
  async function schedulePause() {
    const { settings } = await SS.store.loadRaw();
    await api.alarms.clear(RESUME);
    if (settings.pausedUntil && settings.pausedUntil > Date.now()) {
      api.alarms.create(RESUME, { when: settings.pausedUntil + 500 });
    }
  }

  function notify(id, title, message) {
    if (!api.notifications) return; // firefox android + some kiwi-likes just don't have this. sad
    try {
      api.notifications.create(id, { type: 'basic', iconUrl: api.runtime.getURL('icons/icon-128.png'), title, message });
    } catch (e) {
      /* OS said no to notifications. eh, the popup shows the same warning anyway */
    }
  }

  // once a day: "switches off in N days" + "switched off today". only ever for a date YOU set, i'm not making one up for you
  async function checkExpiry() {
    const st = await SS.store.loadState();
    const today = SS.packs.today();
    const { 'ss:reminded': reminded = {} } = await api.storage.local.get('ss:reminded');
    let changed = false;
    for (const p of st.packs) {
      if (!p.expires || p.active === false) continue;
      const left = SS.packs.daysUntil(p.expires);
      const key = p.id + '@' + p.expires;
      if (reminded[key] === today) continue;
      if (left !== null && left <= 0 && left > -2) {
        notify('ss-expired-' + p.id, `${p.name} blocking is off now. go nuts`, `you set it to switch off on ${p.expires}, so here we are. enjoy! (if that was a mistake, change the date in settings. quickly.)`);
        reminded[key] = today;
        changed = true;
      } else if (SS.packs.expiringSoon(p) !== null) {
        notify('ss-soon-' + p.id, `heads up: ${p.name} blocking switches off in ${left} day${left === 1 ? '' : 's'}`, `on ${p.expires}, the date you picked. not out on PC yet? push it back in settings.`);
        reminded[key] = today;
        changed = true;
      }
    }
    if (changed) await api.storage.local.set({ 'ss:reminded': reminded });
  }

  api.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === RESUME) {
      const { settings } = await SS.store.loadRaw();
      if (settings.pausedUntil && settings.pausedUntil <= Date.now()) await SS.store.patchSettings({ pausedUntil: 0 });
    }
    if (alarm.name === DAILY) checkExpiry();
  });

  if (api.notifications && api.notifications.onClicked) {
    api.notifications.onClicked.addListener(() => api.runtime.openOptionsPage());
  }

  api.storage.onChanged.addListener((changes) => {
    if (changes[SS.store.K.settings]) schedulePause();
  });

  api.runtime.onInstalled.addListener(async (details) => {
    await loadBuiltins();
    api.alarms.create(DAILY, { periodInMinutes: 360, delayInMinutes: 1 });
    if (details.reason === 'install') api.runtime.openOptionsPage();
  });

  api.runtime.onStartup.addListener(async () => {
    await loadBuiltins();
    api.alarms.create(DAILY, { periodInMinutes: 360, delayInMinutes: 1 });
    schedulePause();
    checkExpiry();
  });
})();
