// hey, this is the toolbar popup. anything that makes protection WEAKER (off, pause, site off) goes through the lock
// phrase if you set one. adding keywords makes it stronger, so that never asks.
(async function () {
  const SS = globalThis.SpoilerShield;
  const $ = (id) => document.getElementById(id);
  const PAUSE_MS = 10 * 60 * 1000;

  let state = null;
  let tab = null;
  let status = null;
  let host = null;
  let pending = null;

  const hostOf = (url) => {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) ? u.hostname : null;
    } catch (e) {
      return null;
    }
  };
  const mmss = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  async function getTab() {
    try {
      const [t] = await SS.api.tabs.query({ active: true, currentWindow: true });
      return t || null;
    } catch (e) {
      return null;
    }
  }

  async function askTab() {
    if (!tab) return null;
    try {
      return (await SS.api.tabs.sendMessage(tab.id, { type: 'ss:status' }, { frameId: 0 })) || null;
    } catch (e) {
      return null; // chrome:// pages, the web store, PDFs... content scripts aren't allowed there
    }
  }

  async function refresh() {
    state = await SS.store.loadState();
    status = await askTab();
    host = (status && status.host) || hostOf(tab && tab.url);
    render();
  }

  function render() {
    const s = state.settings;
    const paused = s.pausedUntil > Date.now();
    const siteOff = host && s.hostsOff.includes(host);
    const live = state.livePacks;

    $('enabled').checked = !!s.enabled;
    const st = $('state');
    st.classList.toggle('off', !s.enabled || paused || !!siteOff || !live.length);
    if (!s.enabled) st.textContent = "Off everywhere. You're raw-dogging the internet.";
    else if (paused) st.textContent = `Paused for ${mmss(s.pausedUntil - Date.now())} more.`;
    else if (!live.length) st.textContent = 'No active packs. Nothing to block.';
    else if (siteOff) st.textContent = 'Off on this site.';
    else st.textContent = 'Blocking: ' + live.map((p) => p.name).join(', ');

    $('count').textContent = status ? String(status.count) : '–';
    $('count-label').textContent = status
      ? status.count === 1 ? 'thing blurred on this page' : 'things blurred on this page'
      : "can't run on this page (browser or store pages)";

    $('pause').textContent = paused ? `Resume now (${mmss(s.pausedUntil - Date.now())})` : 'Pause 10 min';
    $('pause').disabled = !s.enabled;

    $('site').checked = !siteOff;
    $('site').disabled = !host;
    $('site-name').textContent = host ? host.replace(/^www\./, '') : 'This site';

    const sel = $('pack');
    const keep = sel.value;
    sel.innerHTML = '';
    for (const p of state.packs) sel.add(new Option(p.name + (SS.packs.isLive(p) ? '' : ' (off)'), p.id));
    if (keep && state.packs.some((p) => p.id === keep)) sel.value = keep;
    else if (live[0]) sel.value = live[0].id;

    const banners = $('banners');
    banners.innerHTML = '';
    for (const p of state.packs) {
      const left = SS.packs.expiringSoon(p);
      if (left === null) continue;
      const b = document.createElement('div');
      b.className = 'banner';
      b.textContent = `${p.name} switches off in ${left} day${left === 1 ? '' : 's'} (${p.expires}). Push it back in settings if the PC version isn't out yet.`;
      banners.appendChild(b);
    }

    $('storage').textContent = state.area === 'sync' ? 'settings sync with your browser' : 'settings saved on this device only';
  }

  // lock gate: runs fn now, or asks for the phrase first
  function gated(why, fn) {
    const lock = state.settings.lock;
    if (!lock || !lock.on) return fn();
    pending = fn;
    $('lock-why').textContent = why;
    $('lockbox').hidden = false;
    $('phrase').value = '';
    $('phrase').focus();
  }

  async function save(patch) {
    await SS.store.patchSettings(patch);
    await refresh();
  }

  $('phrase-go').addEventListener('click', async () => {
    if (!SS.store.checkLock(state.settings, $('phrase').value)) {
      $('lock-why').textContent = 'Nope, wrong phrase. Stay strong.';
      $('phrase').select();
      return;
    }
    $('lockbox').hidden = true;
    const fn = pending;
    pending = null;
    if (fn) await fn();
  });
  $('phrase').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('phrase-go').click();
  });
  $('phrase-cancel').addEventListener('click', () => {
    pending = null;
    $('lockbox').hidden = true;
    render();
  });

  $('enabled').addEventListener('change', (e) => {
    if (e.target.checked) return save({ enabled: true });
    e.target.checked = true; // stays on until the phrase checks out
    gated('Locked. Type your phrase to switch the spoiler blocker off everywhere.', () => save({ enabled: false }));
  });

  $('pause').addEventListener('click', () => {
    if (state.settings.pausedUntil > Date.now()) return save({ pausedUntil: 0 });
    gated('Locked. Type your phrase to pause for 10 minutes.', () => save({ pausedUntil: Date.now() + PAUSE_MS }));
  });

  $('site').addEventListener('change', (e) => {
    if (!host) return;
    const off = state.settings.hostsOff.filter((h) => h !== host);
    if (e.target.checked) return save({ hostsOff: off });
    e.target.checked = true;
    gated(`Locked. Type your phrase to switch it off on ${host}.`, () => save({ hostsOff: [...off, host] }));
  });

  $('add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('add-msg');
    const term = $('term').value.trim();
    if (!term) return;
    try {
      const r = await SS.edit.addTerm(state, $('pack').value, $('tier').value, term);
      if (r === 'added') {
        msg.className = 'msg ok';
        msg.textContent = `Added "${term}". Open tabs pick it up right away.`;
        $('term').value = '';
      } else if (r === 'exists') {
        msg.className = 'msg';
        msg.textContent = 'Already in there.';
      } else if (r.startsWith('other-tier:')) {
        msg.className = 'msg';
        msg.textContent = `Already in there as ${r.split(':')[1]}. Move it in settings if you want.`;
      }
      await refresh();
    } catch (err) {
      msg.className = 'msg bad';
      msg.textContent = String(err.message || err);
    }
  });

  $('settings').addEventListener('click', () => {
    SS.api.runtime.openOptionsPage();
    window.close();
  });

  tab = await getTab();
  await refresh();
  SS.store.onChange(refresh);
  setInterval(async () => {
    status = await askTab();
    if (state) render();
  }, 1000);
})();
