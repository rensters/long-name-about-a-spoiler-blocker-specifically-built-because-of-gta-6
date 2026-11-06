// hey, why are you looking at this? it's the settings page. big file, boring file. everything saves through SS.store / SS.edit and every open
// tab picks the change up live through storage.onChanged, no reloads needed.
(async function () {
  const SS = globalThis.SpoilerShield;
  const P = SS.packs;
  const $ = (id) => document.getElementById(id);
  const LIST_FIELDS = ['allow', 'allowChannels', 'blockedCommunities', 'blockedCategories', 'blockedChannels', 'watchlist', 'contextIgnores'];

  let state = null;
  let unlocked = false; // per tab. close the tab and it locks again, no cheating
  let editing = null;
  let testMatcher = null;

  const locked = () => !!(state.settings.lock && state.settings.lock.on) && !unlocked;

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) n.append(kid);
    return n;
  }

  function switchEl(checked, onchange, label) {
    const input = el('input', { type: 'checkbox', 'aria-label': label || 'toggle' });
    input.checked = !!checked;
    input.addEventListener('change', onchange);
    return el('label', { class: 'switch' }, input, el('span', { class: 'track' }));
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function say(id, text, kind) {
    const m = $(id);
    m.textContent = text;
    m.className = 'msg' + (kind ? ' ' + kind : '');
  }

  // every change goes through here. locked = nope, not happening
  function guard() {
    if (!locked()) return true;
    $('lockgate').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('unlock-phrase').focus();
    say('unlock-msg', 'Locked. Phrase first.', 'bad');
    render();
    return false;
  }

  async function patch(p) {
    if (!guard()) return;
    await SS.store.patchSettings(p);
    await load();
  }

  async function load() {
    state = await SS.store.loadState();
    testMatcher = null;
    render();
  }

  function render() {
    renderLockGate();
    renderBanners();
    renderPacks();
    renderSites();
    renderLook();
    renderStreams();
    renderLockSection();
    renderBackupInfo();
    runTest();
  }

  // ---------------- lock gate ----------------
  function renderLockGate() {
    const on = !!(state.settings.lock && state.settings.lock.on);
    document.body.classList.toggle('locked', locked());
    $('lockgate').hidden = !locked();
    $('lockstate').hidden = !on;
    $('lockstate').textContent = locked() ? 'locked' : 'unlocked (this tab)';
  }

  $('unlock-go').addEventListener('click', () => {
    if (SS.store.checkLock(state.settings, $('unlock-phrase').value)) {
      unlocked = true;
      $('unlock-phrase').value = '';
      say('unlock-msg', '');
      render();
    } else {
      say('unlock-msg', "Wrong phrase. Maybe that's a sign.", 'bad');
    }
  });
  $('unlock-phrase').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('unlock-go').click();
  });

  // ---------------- banners ----------------
  function renderBanners() {
    const box = $('banners');
    box.innerHTML = '';
    const add = (text, kind, button) => box.append(el('div', { class: 'banner' + (kind ? ' ' + kind : '') }, el('span', { text }), button || null));
    if (state.area !== 'sync') add('Browser sync isn\'t available (or it filled up), so settings are saved on this device only. Use Backup to move them around.');
    if (!state.livePacks.length) add('No pack is active right now, so nothing is being blocked.', 'bad');
    for (const p of state.packs) {
      const left = P.expiringSoon(p);
      if (left !== null) {
        add(
          `${p.name} switches off in ${left} day${left === 1 ? '' : 's'} (${p.expires}), the date you set.`,
          '',
          el('button', { class: 'btn', type: 'button', text: 'Push back a week', onclick: () => bump(p, 7) }),
        );
      } else if (p.active !== false && p.expires && !P.isLive(p)) {
        add(
          `${p.name} switched off on ${p.expires}, the date you set.`,
          '',
          el('button', { class: 'btn', type: 'button', text: 'Keep blocking (+7 days)', onclick: () => bump(p, 7, true) }),
        );
      }
    }
    const errs = new SS.Matcher(state.packs).errors;
    for (const e of errs) add(e, 'bad');
  }

  async function bump(p, days, fromToday) {
    if (!guard()) return;
    const base = fromToday || !p.expires ? new Date() : new Date(p.expires + 'T12:00:00');
    base.setDate(base.getDate() + days);
    await SS.edit.setField(state, p.id, { expires: P.today(base.getTime()) });
    await load();
  }

  // ---------------- packs ----------------
  function counts(p) {
    const n = (k) => P.entries(p[k]).length;
    const bits = [`${n('strong')} strong`, `${n('weak')} weak`, `${n('context')} context`];
    if ((p.regex || []).length) bits.push(`${p.regex.length} regex`);
    if ((p.blockedCommunities || []).length) bits.push(`${p.blockedCommunities.length} subreddits`);
    if ((p.blockedChannels || []).length) bits.push(`${p.blockedChannels.length} channels`);
    if ((p.watchlist || []).length) bits.push(`${p.watchlist.length} streamers`);
    return bits.join(' · ');
  }

  function renderPacks() {
    const list = $('pack-list');
    list.innerHTML = '';
    for (const p of state.packs) {
      const live = P.isLive(p);
      const soon = P.expiringSoon(p);
      const tags = [];
      if (p.builtin) tags.push(el('span', { class: 'tag', text: 'built-in' }));
      if (soon !== null) tags.push(el('span', { class: 'tag warn', text: `off in ${soon}d` }));
      if (p.active !== false && !live) tags.push(el('span', { class: 'tag warn', text: 'expired' }));

      const date = el('input', { type: 'date', value: p.expires || '', 'aria-label': 'switch-off date' });
      date.addEventListener('change', async () => {
        if (!guard()) return;
        await SS.edit.setField(state, p.id, { expires: date.value || null });
        await load();
      });
      const remind = el('input', { type: 'number', min: '0', max: '60', value: String(p.remindDaysBefore ?? 3), 'aria-label': 'remind days before' });
      remind.addEventListener('change', async () => {
        if (!guard()) return;
        await SS.edit.setField(state, p.id, { remindDaysBefore: Math.max(0, Math.min(60, parseInt(remind.value, 10) || 0)) });
        await load();
      });
      const clear = p.expires
        ? el('button', { class: 'link', type: 'button', text: 'no date', onclick: async () => {
          if (!guard()) return;
          await SS.edit.setField(state, p.id, { expires: null });
          await load();
        } })
        : null;

      const card = el(
        'div',
        { class: 'pack' + (live ? '' : ' off') },
        switchEl(p.active !== false, async (e) => {
          if (!guard()) return;
          await SS.edit.setField(state, p.id, { active: e.target.checked });
          await load();
        }, 'pack on/off'),
        el('div', {}, el('span', { class: 'pack-name', text: p.name }), ...tags),
        el('div', { class: 'actions' },
          el('button', { class: 'btn', type: 'button', text: 'Edit', onclick: () => openEditor(p.id) }),
          el('button', { class: 'btn', type: 'button', text: 'Export', onclick: () => download(`${p.id}.json`, P.exportPack(p)) })),
        el('div', { class: 'pack-meta', text: counts(p) }),
        el('div', { class: 'pack-expiry' },
          el('span', { class: 'muted', text: 'Switch off on' }), date,
          el('span', { class: 'muted', text: 'remind me' }), remind, el('span', { class: 'muted', text: 'days before' }), clear),
      );
      list.append(card);
    }
  }

  $('new-pack').addEventListener('click', async () => {
    if (!guard()) return;
    const name = prompt('Name for the new pack (a game, a show, a team, whatever):', '');
    if (!name || !name.trim()) return;
    const p = await SS.edit.createPack(state, name.trim());
    await load();
    openEditor(p.id);
  });

  $('import-pack').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !guard()) return;
    try {
      const text = await file.text();
      let replace = false;
      try {
        const obj = JSON.parse(text);
        const id = P.slug(obj.id || obj.name);
        if (state.builtins[id]) replace = confirm(`This file is a version of the built-in "${state.builtins[id].name}" pack.\n\nOK = replace your ${state.builtins[id].name} pack with it\nCancel = import it as a separate copy`);
      } catch (err) {
        /* importPack will complain about it properly, not my job here */
      }
      const { pack, warnings } = await SS.edit.importPack(state, text, replace);
      await load();
      alert(`Imported "${pack.name}".` + (warnings.length ? `\n\nHeads up:\n- ${warnings.join('\n- ')}` : ''));
    } catch (err) {
      alert('Import failed: ' + (err.message || err));
    }
  });

  // ---------------- editor ----------------
  function openEditor(id) {
    const p = state.packs.find((x) => x.id === id);
    if (!p) return;
    editing = id;
    $('editor').hidden = false;
    $('editor-title').textContent = `Edit: ${p.name}`;
    $('ed-name').value = p.name || '';
    $('ed-desc').value = p.description || '';
    $('ed-overlay').value = (p.overlayText || []).join('\n');
    for (const k of P.TIERS) $('ed-' + k).value = P.toLines(p[k] || {});
    $('ed-regex').value = P.regexToLines(p.regex || []);
    for (const k of LIST_FIELDS) $('ed-' + k).value = (p[k] || []).join('\n');
    $('ed-reset').hidden = !p.builtin;
    $('ed-delete').hidden = !!p.builtin;
    say('ed-msg', p.builtin ? 'Built-in pack: your changes are stored on top of it, so future updates to the pack still reach you.' : '');
    $('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    editing = null;
    $('editor').hidden = true;
    $('packs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('ed-cancel').addEventListener('click', closeEditor);

  $('ed-save').addEventListener('click', async () => {
    if (!guard()) return;
    const p = state.packs.find((x) => x.id === editing);
    if (!p) return closeEditor();
    const rx = P.regexFromLines($('ed-regex').value);
    if (rx.bad.length) return say('ed-msg', 'These regex lines are broken, fix or remove them: ' + rx.bad.join(' | '), 'bad');
    const overlay = $('ed-overlay').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const edited = {
      ...JSON.parse(JSON.stringify(p)),
      name: $('ed-name').value.trim() || p.name,
      description: $('ed-desc').value.trim(),
      overlayText: overlay.length ? overlay : P.DEFAULT_OVERLAY.slice(),
      regex: rx.list,
    };
    for (const k of P.TIERS) edited[k] = P.fromLines($('ed-' + k).value);
    for (const k of LIST_FIELDS) edited[k] = P.fromLines($('ed-' + k).value, true);
    try {
      await SS.edit.savePack(state, edited);
      await load();
      openEditor(edited.id);
      say('ed-msg', 'Saved. Open tabs already updated.', 'ok');
    } catch (err) {
      say('ed-msg', 'Save failed: ' + (err.message || err), 'bad');
    }
  });

  $('ed-export').addEventListener('click', () => {
    const p = state.packs.find((x) => x.id === editing);
    if (p) download(`${p.id}.json`, P.exportPack(p));
  });

  $('ed-reset').addEventListener('click', async () => {
    if (!guard()) return;
    if (!confirm('Throw away all your changes to this pack and go back to the shipped version?')) return;
    await SS.edit.resetPack(state, editing);
    await load();
    openEditor(editing);
    say('ed-msg', 'Back to the built-in version.', 'ok');
  });

  $('ed-delete').addEventListener('click', async () => {
    if (!guard()) return;
    if (!confirm('Delete this pack for good? (Export it first if you might want it back.)')) return;
    await SS.edit.deletePack(state, editing);
    await load();
    closeEditor();
  });

  // ---------------- sites ----------------
  function renderSites() {
    const box = $('site-list');
    box.innerHTML = '';
    const sites = SS.sites.list.slice().sort((a, b) => (a.id === 'generic') - (b.id === 'generic'));
    for (const s of sites) {
      const on = state.settings.sites[s.id] !== false;
      box.append(
        el('div', { class: 'site' }, el('span', { text: s.name }), switchEl(on, async (e) => {
          const sites2 = { ...state.settings.sites };
          if (e.target.checked) delete sites2[s.id];
          else sites2[s.id] = false;
          await patch({ sites: sites2 });
        }, s.name)),
      );
    }
    const off = $('hosts-off');
    off.innerHTML = '';
    if (!state.settings.hostsOff.length) off.append(el('span', { class: 'muted', text: 'none' }));
    for (const h of state.settings.hostsOff) {
      off.append(el('span', { class: 'host-chip' }, el('span', { text: h }),
        el('button', { class: 'link', type: 'button', text: 'turn back on', onclick: () => patch({ hostsOff: state.settings.hostsOff.filter((x) => x !== h) }) })));
    }
  }

  // ---------------- look & feel ----------------
  function renderLook() {
    const s = state.settings;
    $('blur').value = String(s.blurPx);
    $('blur-val').textContent = s.blurPx + 'px';
    $('preview').style.setProperty('--pv-blur', s.blurPx + 'px');
    for (const r of document.querySelectorAll('input[name="reveal"]')) r.checked = r.value === s.revealMode;
    $('show-matched').checked = !!s.showMatched;
    $('pv-btn').textContent = s.revealMode === 'confirm' ? 'Reveal…' : 'Hold to reveal';

    // spoiler text editor. don't stomp on the textarea while you're mid-typing, that's just mean
    const sel = $('ov-pack');
    const keep = sel.value;
    sel.innerHTML = '';
    for (const p of state.packs) sel.add(new Option(p.name + (P.isLive(p) ? '' : ' (off)'), p.id));
    if (keep && state.packs.some((p) => p.id === keep)) sel.value = keep;
    else if (state.livePacks[0]) sel.value = state.livePacks[0].id;
    if (!ovDirty) fillOverlay();
    previewLines();
  }

  let ovDirty = false;
  const ovPack = () => state.packs.find((p) => p.id === $('ov-pack').value);
  const ovLines = () => $('ov-text').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 5);

  function fillOverlay() {
    const p = ovPack();
    $('ov-text').value = ((p && p.overlayText) || P.DEFAULT_OVERLAY).join('\n');
    ovDirty = false;
  }

  function previewLines() {
    const box = $('pv-lines');
    box.innerHTML = '';
    const lines = ovLines();
    (lines.length ? lines : P.DEFAULT_OVERLAY).forEach((line, i) => box.append(el('p', { class: 'l' + i, text: line })));
  }

  $('ov-text').addEventListener('input', () => {
    ovDirty = true;
    previewLines();
  });
  $('ov-pack').addEventListener('change', () => {
    fillOverlay();
    previewLines();
    say('ov-msg', '');
  });
  $('ov-save').addEventListener('click', async () => {
    if (!guard()) return;
    const p = ovPack();
    if (!p) return;
    const lines = ovLines();
    if (!lines.length) return say('ov-msg', 'Needs at least one line. Even "no." works.', 'bad');
    await SS.edit.setField(state, p.id, { overlayText: lines });
    ovDirty = false;
    await load();
    say('ov-msg', 'Saved. Every open tab shows the new text right away.', 'ok');
  });
  $('ov-reset').addEventListener('click', async () => {
    if (!guard()) return;
    const p = ovPack();
    if (!p) return;
    const original = (state.builtins[p.id] && state.builtins[p.id].overlayText) || P.DEFAULT_OVERLAY;
    await SS.edit.setField(state, p.id, { overlayText: original.slice() });
    ovDirty = false;
    await load();
    say('ov-msg', 'Back to the original text.', 'ok');
  });

  $('blur').addEventListener('input', () => {
    $('blur-val').textContent = $('blur').value + 'px';
    $('preview').style.setProperty('--pv-blur', $('blur').value + 'px');
  });
  $('blur').addEventListener('change', () => patch({ blurPx: parseInt($('blur').value, 10) }));
  for (const r of document.querySelectorAll('input[name="reveal"]')) r.addEventListener('change', () => patch({ revealMode: r.value }));
  $('show-matched').addEventListener('change', (e) => patch({ showMatched: e.target.checked }));

  // ---------------- streams ----------------
  function renderStreams() {
    $('strict').checked = !!state.settings.strictStreams;
    $('collapse-chat').checked = !!state.settings.collapseChat;
  }
  $('strict').addEventListener('change', (e) => patch({ strictStreams: e.target.checked }));
  $('collapse-chat').addEventListener('change', (e) => patch({ collapseChat: e.target.checked }));

  // ---------------- lock ----------------
  function renderLockSection() {
    const on = !!(state.settings.lock && state.settings.lock.on);
    $('lock-off-box').hidden = on;
    $('lock-on-box').hidden = !on;
  }

  $('lock-on').addEventListener('click', async () => {
    const a = $('lock-1').value.trim();
    const b = $('lock-2').value.trim();
    if (a.length < 8) return say('lock-msg', 'Make it at least 8 characters. The more annoying to type, the better.', 'bad');
    if (a !== b) return say('lock-msg', "They don't match.", 'bad');
    if (!guard()) return;
    await SS.store.patchSettings({ lock: { on: true, phrase: a } });
    unlocked = true; // you literally just typed it, i believe you
    $('lock-1').value = '';
    $('lock-2').value = '';
    await load();
    say('lock-msg', 'Locked in. Next time you open this page (or try to pause from the popup) you\'ll need that phrase.', 'ok');
  });

  $('lock-remove').addEventListener('click', async () => {
    if (!guard()) return;
    if (!confirm('Remove the lock? Anyone (including weak-moment you) can switch things off again.')) return;
    await SS.store.patchSettings({ lock: { on: false, phrase: '' } });
    await load();
    say('lock-msg', 'Lock removed.', 'ok');
  });

  // ---------------- test box ----------------
  let testTimer = null;
  $('test-text').addEventListener('input', () => {
    clearTimeout(testTimer);
    testTimer = setTimeout(runTest, 150);
  });

  function runTest() {
    const text = $('test-text').value;
    const out = $('test-out');
    out.innerHTML = '';
    if (!text.trim()) return;
    if (!state.livePacks.length) return out.append(el('div', { class: 'verdict', text: 'No active packs, so nothing would be blurred.' }));
    testMatcher = testMatcher || new SS.Matcher(state.livePacks);
    for (const r of testMatcher.explain(text)) {
      const why = r.why ? (r.why.tier === 'strong' ? 'strong match' : 'weak + second clue') + ': ' + r.why.terms.join(' + ') : 'not enough clues';
      const rows = [
        el('div', {}, el('b', { class: r.blur ? 'yes' : 'no', text: r.blur ? 'Would blur' : 'Would NOT blur' }), ` with ${r.name} (${why})`),
      ];
      const line = (label, arr) => arr && arr.length ? el('div', {}, el('span', { class: 'muted', text: label + ': ' }), arr.join(', ')) : null;
      rows.push(line('strong found', r.strong), line('weak found', r.weak), line('context found', r.context), line('cut out by allow list', r.allowed));
      rows.push(el('div', {}, el('span', { class: 'muted', text: 'normalized: ' }), el('code', { text: r.normalized.replace(/\u2063/g, ' ¦ ') })));
      out.append(el('div', { class: 'verdict' + (r.blur ? ' blur' : '') }, ...rows));
    }
  }

  // ---------------- backup ----------------
  function renderBackupInfo() {
    $('storage-info').textContent = state.area === 'sync'
      ? 'Right now your settings live in browser sync storage, so they follow you to other copies of this browser you\'re signed into.'
      : 'Right now your settings live in local storage on this device only.';
  }

  $('export-all').addEventListener('click', () => {
    download(`no-spoilers-backup-${P.today()}.json`, SS.edit.exportAll(state));
    say('backup-msg', 'Downloaded.', 'ok');
  });

  $('import-all').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !guard()) return;
    if (!confirm('Replace ALL your settings and packs with this backup?')) return;
    try {
      await SS.edit.importAll(await file.text());
      unlocked = false;
      await load();
      say('backup-msg', 'Restored.', 'ok');
    } catch (err) {
      say('backup-msg', 'Import failed: ' + (err.message || err), 'bad');
    }
  });

  $('version').textContent = 'v' + (SS.api ? SS.api.runtime.getManifest().version : '?');

  await load();
  SS.store.onChange(load);
})();
