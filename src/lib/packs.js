// hey, this is pack plumbing. groups, textarea <-> lists, your edits stored as a tiny diff on top of the built-in
// pack (so when i update gta6.json with new names after launch, your edits survive AND you get the
// new names), import/export, validation, expiry dates.
(function (root) {
  const SS = (root.SpoilerShield = root.SpoilerShield || {});
  const { normalize } = SS.text;

  const TIERS = ['strong', 'weak', 'context'];
  const LISTS = ['allow', 'allowChannels', 'blockedCommunities', 'blockedCategories', 'blockedChannels', 'watchlist', 'contextIgnores'];
  const SCALARS = ['name', 'description', 'active', 'expires', 'remindDaysBefore', 'overlayText'];
  const ADDED_GROUP = 'Added by you';
  const DEFAULT_OVERLAY = ["hey, it's the thing you wanted blurred"];
  // the old default. if your saved stuff still says exactly this, you never customized it, so it
  // quietly becomes the new one. anything you actually typed yourself stays put, i'm not touching that
  const OLD_DEFAULT_OVERLAYS = [
    ["Hey, it's the thing you prevented from showing up.", 'Not today, spoiling shitbag.', 'The Endgame Incident will never happen again!'],
  ].map((x) => JSON.stringify(x));
  function migrateOverlay(p) {
    if (p && Array.isArray(p.overlayText) && OLD_DEFAULT_OVERLAYS.includes(JSON.stringify(p.overlayText))) {
      p.overlayText = DEFAULT_OVERLAY.slice();
    }
    return p;
  }

  const keyOf = (term) => normalize(term).replace(/\s+/g, ' ').trim();
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // tiers can be ["a", "b"] or {"Group": ["a", "b"]}. internally always the object form
  function groups(list) {
    if (!list) return {};
    if (Array.isArray(list)) return list.length ? { '': list.filter((t) => typeof t === 'string') } : {};
    const out = {};
    for (const [g, terms] of Object.entries(list)) if (Array.isArray(terms)) out[g] = terms.filter((t) => typeof t === 'string');
    return out;
  }

  function entries(list) {
    const out = [];
    for (const [group, terms] of Object.entries(groups(list))) for (const term of terms) out.push({ term, group });
    return out;
  }

  // ---- textarea format: one term per line, "// Group name" starts a group ----
  function toLines(list) {
    if (Array.isArray(list)) return list.join('\n');
    return Object.entries(groups(list))
      .map(([g, terms]) => (g ? '// ' + g + '\n' : '') + terms.join('\n'))
      .join('\n\n');
  }

  function fromLines(text, flatList) {
    const out = {};
    const flatOut = [];
    let group = '';
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('//')) {
        group = line.replace(/^\/\/+\s*/, '');
        continue;
      }
      if (flatList) flatOut.push(line);
      else (out[group] = out[group] || []).push(line);
    }
    return flatList ? flatOut : out;
  }

  // regex lines look like:   /pattern/flags    or    weak /pattern/flags
  // a "// comment" line right above one becomes its "why"
  const REGEX_LINE = /^(?:(strong|weak|context)\s+)?\/(.+)\/([dgimsuyv]*)$/;
  function regexToLines(list) {
    return (list || [])
      .map((r) => (r.why ? '// ' + r.why + '\n' : '') + (r.tier && r.tier !== 'strong' ? r.tier + ' ' : '') + '/' + r.pattern + '/' + (r.flags || ''))
      .join('\n');
  }
  function regexFromLines(text) {
    const out = [];
    const bad = [];
    let why = '';
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('//')) {
        why = line.replace(/^\/\/+\s*/, '');
        continue;
      }
      const m = REGEX_LINE.exec(line);
      if (!m) {
        bad.push(line);
        continue;
      }
      try {
        new RegExp(m[2], m[3]);
      } catch (e) {
        bad.push(line + '  (' + e.message + ')');
        continue;
      }
      out.push({ pattern: m[2], flags: m[3] || 'u', tier: m[1] || 'strong', ...(why ? { why } : {}) });
      why = '';
    }
    return { list: out, bad };
  }

  const regexKey = (r) => (r.tier || 'strong') + '|' + r.pattern + '|' + (r.flags || '');

  // ---- diffs: what you changed vs the built-in pack ----
  function makeDiff(base, edited) {
    const diff = {};
    for (const k of TIERS) {
      const b = entries(base[k]);
      const e = entries(edited[k]);
      const bKeys = new Set(b.map((x) => keyOf(x.term)));
      const eKeys = new Set(e.map((x) => keyOf(x.term)));
      const add = e.filter((x) => !bKeys.has(keyOf(x.term))).map((x) => [x.term, x.group]);
      const remove = b.filter((x) => !eKeys.has(keyOf(x.term))).map((x) => x.term);
      if (add.length || remove.length) diff[k] = { add, remove };
    }
    for (const k of LISTS) {
      const b = base[k] || [];
      const e = edited[k] || [];
      const bKeys = new Set(b.map(keyOf));
      const eKeys = new Set(e.map(keyOf));
      const add = e.filter((t) => !bKeys.has(keyOf(t)));
      const remove = b.filter((t) => !eKeys.has(keyOf(t)));
      if (add.length || remove.length) diff[k] = { add, remove };
    }
    {
      const b = base.regex || [];
      const e = edited.regex || [];
      const bKeys = new Set(b.map(regexKey));
      const eKeys = new Set(e.map(regexKey));
      const add = e.filter((r) => !bKeys.has(regexKey(r)));
      const remove = b.filter((r) => !eKeys.has(regexKey(r))).map(regexKey);
      if (add.length || remove.length) diff.regex = { add, remove };
    }
    const set = {};
    for (const k of SCALARS) {
      if (edited[k] === undefined) continue;
      if (JSON.stringify(edited[k]) !== JSON.stringify(base[k])) set[k] = clone(edited[k]);
    }
    if (Object.keys(set).length) diff.set = set;
    return diff;
  }

  function applyDiff(base, diff) {
    const p = clone(base);
    if (!diff) return p;
    for (const k of TIERS) {
      p[k] = groups(p[k]);
      const d = diff[k];
      if (!d) continue;
      const rm = new Set((d.remove || []).map(keyOf));
      for (const g of Object.keys(p[k])) {
        p[k][g] = p[k][g].filter((t) => !rm.has(keyOf(t)));
        if (!p[k][g].length) delete p[k][g];
      }
      const have = new Set(entries(p[k]).map((x) => keyOf(x.term)));
      for (const [term, group] of d.add || []) {
        if (have.has(keyOf(term))) continue;
        const g = group || ADDED_GROUP;
        (p[k][g] = p[k][g] || []).push(term);
        have.add(keyOf(term));
      }
    }
    for (const k of LISTS) {
      const d = diff[k];
      p[k] = (p[k] || []).slice();
      if (!d) continue;
      const rm = new Set((d.remove || []).map(keyOf));
      p[k] = p[k].filter((t) => !rm.has(keyOf(t)));
      const have = new Set(p[k].map(keyOf));
      for (const t of d.add || []) if (!have.has(keyOf(t))) p[k].push(t), have.add(keyOf(t));
    }
    if (diff.regex) {
      const rm = new Set(diff.regex.remove || []);
      p.regex = (p.regex || []).filter((r) => !rm.has(regexKey(r)));
      const have = new Set(p.regex.map(regexKey));
      for (const r of diff.regex.add || []) if (!have.has(regexKey(r))) p.regex.push(r);
    }
    if (diff.set) Object.assign(p, clone(diff.set));
    return p;
  }

  // ---- validation (imports + anything typed by a human, so: trust nothing. not even me) ----
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_TERMS = 6000;
  const MAX_LEN = 300;

  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }

  function cleanStrings(arr, warn, label) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const t of arr) {
      if (typeof t !== 'string') continue;
      const s = t.trim();
      if (!s) continue;
      if (s.length > MAX_LEN) {
        warn.push(`${label}: skipped a ${s.length}-char entry (max ${MAX_LEN})`);
        continue;
      }
      out.push(s);
    }
    return out;
  }

  function validatePack(input) {
    const warn = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error("that's not a pack, it's not even a JSON object");
    const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : null;
    const id = slug(input.id) || slug(name);
    if (!id) throw new Error('pack needs an "id" or a "name"');
    const p = {
      id,
      name: name || id,
      version: typeof input.version === 'string' ? input.version.slice(0, 40) : undefined,
      description: typeof input.description === 'string' ? input.description.slice(0, 1000) : '',
      active: input.active !== false,
      expires: typeof input.expires === 'string' && DATE.test(input.expires) ? input.expires : null,
      remindDaysBefore: Number.isInteger(input.remindDaysBefore) ? Math.max(0, Math.min(60, input.remindDaysBefore)) : 3,
      overlayText: cleanStrings(input.overlayText, warn, 'overlayText').slice(0, 5),
    };
    if (!p.overlayText.length) p.overlayText = DEFAULT_OVERLAY.slice();
    migrateOverlay(p); // old backups with the old default text get the new one too
    if (input.expires && !p.expires) warn.push(`expires "${input.expires}" isn't YYYY-MM-DD, ignored`);
    let total = 0;
    for (const k of TIERS) {
      const g = {};
      for (const [name2, terms] of Object.entries(groups(input[k]))) {
        const clean = cleanStrings(terms, warn, k);
        total += clean.length;
        if (clean.length) g[String(name2).slice(0, 80)] = clean;
      }
      p[k] = g;
    }
    for (const k of LISTS) {
      p[k] = cleanStrings(input[k], warn, k);
      total += p[k].length;
    }
    p.regex = [];
    for (const r of Array.isArray(input.regex) ? input.regex : []) {
      if (!r || typeof r.pattern !== 'string') continue;
      const flags = typeof r.flags === 'string' ? r.flags.replace(/[^dgimsuyv]/g, '') : 'u';
      const tier = TIERS.includes(r.tier) ? r.tier : 'strong';
      try {
        new RegExp(r.pattern, flags);
      } catch (e) {
        warn.push(`regex /${r.pattern}/ is broken (${e.message}), skipped`);
        continue;
      }
      p.regex.push({ pattern: r.pattern, flags: flags || 'u', tier, ...(typeof r.why === 'string' ? { why: r.why.slice(0, 200) } : {}) });
    }
    if (total > MAX_TERMS) throw new Error(`${total} terms is too many (max ${MAX_TERMS}). split it into a few packs`);
    return { pack: p, warnings: warn };
  }

  function blankPack(name) {
    return {
      id: slug(name) || 'pack-' + Date.now().toString(36),
      name: name || 'New pack',
      description: '',
      active: true,
      expires: null,
      remindDaysBefore: 3,
      overlayText: DEFAULT_OVERLAY.slice(),
      strong: {},
      weak: {},
      context: {},
      regex: [],
      allow: [],
      allowChannels: [],
      blockedCommunities: [],
      blockedCategories: [],
      blockedChannels: [],
      watchlist: [],
      contextIgnores: [],
    };
  }

  // ---- built-ins + your stuff -> the packs that actually run ----
  // state = { diffs: {builtinId: diff}, custom: {id: pack}, order: [ids] }
  function effectivePacks(builtins, state) {
    const s = state || {};
    const out = [];
    for (const [id, base] of Object.entries(builtins || {})) {
      if (!base || typeof base !== 'object') continue;
      const p = migrateOverlay(applyDiff(base, (s.diffs || {})[id]));
      p.builtin = true;
      out.push(p);
    }
    for (const [id, pack] of Object.entries(s.custom || {})) {
      if (out.some((p) => p.id === id)) continue;
      out.push(migrateOverlay({ ...clone(pack), builtin: false }));
    }
    // your order first; anything you never ordered goes after it, switched-on packs before switched-off
    // ones, then by name. (storage hands keys back alphabetically, so "example-f1" would beat "gta6")
    const order = s.order || [];
    out.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || (b.active !== false) - (a.active !== false) || String(a.name).localeCompare(String(b.name));
    });
    return out;
  }

  // local calendar date, not UTC. expiring at 7pm the day before because of timezones would be a literal crime
  function today(now) {
    const d = now ? new Date(now) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function daysUntil(dateStr, now) {
    if (!dateStr || !DATE.test(dateStr)) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = today(now).split('-').map(Number);
    const a = Date.UTC(y, m - 1, d);
    const b = Date.UTC(t[0], t[1] - 1, t[2]);
    return Math.round((a - b) / 86400000);
  }

  // a pack runs if it's switched on and its expiry date (YOUR date, never a default) hasn't arrived yet
  function isLive(pack, now) {
    if (!pack || pack.active === false) return false;
    if (!pack.expires) return true;
    const left = daysUntil(pack.expires, now);
    return left === null || left > 0;
  }

  function expiringSoon(pack, now) {
    if (!pack || pack.active === false || !pack.expires) return null;
    const left = daysUntil(pack.expires, now);
    if (left === null || left <= 0) return null;
    return left <= (pack.remindDaysBefore ?? 3) ? left : null;
  }

  function exportPack(pack) {
    const p = clone(pack);
    delete p.builtin;
    p.exportedFrom = "i can't afford a PS5 but i also wish to not get spoiled";
    p.exportedAt = new Date().toISOString();
    return JSON.stringify(p, null, 2);
  }

  SS.packs = {
    TIERS, LISTS, SCALARS, DEFAULT_OVERLAY, ADDED_GROUP,
    keyOf, groups, entries, toLines, fromLines, regexToLines, regexFromLines,
    makeDiff, applyDiff, validatePack, blankPack, effectivePacks, isLive, expiringSoon, daysUntil, today, exportPack, slug,
  };
  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
