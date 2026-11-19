// hey, not a good idea, like seriously, don't touch this file. it's the brain: takes packs (word lists), turns
// every word into a regex that survives leetspeak, dots, emoji, hashtags + roman numerals, then decides if a card is a spoiler.
//
// rules, short version:
//   strong  -> blur on sight
//   weak    -> needs a second clue: a strong term or a DIFFERENT weak/context term
//   context -> never blurs alone, never pairs with other context. "trailer" + "leak" for some other
//              game stays visible, "Rockstar" + "trailer" doesn't
//   allow   -> cut out of the text before anything else looks at it ("Jason Momoa" is not our Jason)
//
// this file took like 6 rewrites. the regex compiler below is held together with tape and prayers. why are you still reading
(function (root) {
  const SS = (root.NoSpoil = root.NoSpoil || {});
  const { normalize, squash, flat: flatText, squashed, leet, WALL } = SS.text;

  // groups with "(spoilers)" in the name are secret. the matcher still uses them, but every place that SHOWS a
  // term (overlay "why", the settings test box) gets this instead. you don't get spoiled by your own spoiler filter lol
  const MASK = '\u2022\u2022\u2022\u2022\u2022\u2022';
  const isHiddenGroup = (g) => /\(spoilers?\)/i.test(String(g || ''));
  const shown = (e) => (e.hidden ? MASK : e.term);

  // launch week(s). console launch was 2026-11-19, the internet is a minefield until new year. during this
  // window a bare "gta" on a live card or a video title counts as strong, unless it's clearly another gta
  const LAUNCH_FROM = '2026-11-10';
  const LAUNCH_TO = '2026-12-31';
  const BARE_GTA = / gta (?!(?:5|v|five|online|rp|san andreas|iv|4|iii|3|trilogy|vice city stories|liberty city|chinatown wars|london) )/;
  const localDay = (now) => {
    const d = new Date(now == null ? Date.now() : now);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  // title-ish strong groups get the squashed + leetspeak treatment. "g t a 6", "g.t.a.6", "gtav1" etc
  const TITLE_GROUP = /^(title|typos|spelling)/i;
  const KEEP_FLAT = /[*+%]/; // "R*" flattens to " r ", which matches literally every r. no thanks

  // a separator is anything that isn't a letter, a digit or our wall char. emoji, dots, dashes, #, all of it
  const SEP = '[^\\p{L}\\p{N}\\u2063]';
  const BETWEEN_WORDS = SEP + '{0,6}'; // "GTA 6", "GTA6", "GTA 🔥🔥 6", "GTA - 6"
  const INSIDE_WORD = SEP + '{0,3}'; // "Dre'Quan" / "DreQuan", "Vice-Dale" / "Vice Dale"
  const BETWEEN_LETTERS = SEP + '{0,2}'; // only for short words: "G.T.A." "G T A"

  // leetspeak per letter. i and l are cross-wired ON PURPOSE because "GTAVl" with a lowercase L is a thing people do
  const LEET = { a: 'a4@', b: 'b8', e: 'e3', g: 'g9', i: 'i1!|l', l: 'l1|i', o: 'o0', s: 's5$', t: 't7+', z: 'z2' };

  const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv',
    'xvi', 'xvii', 'xviii', 'xix', 'xx'];

  // scripts with no spaces between words (or with stuff glued onto words). "word boundary" is meaningless there
  const NO_BOUNDARY = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Arabic}]/u;
  const IS_LETTER = /\p{L}/u;
  const IS_DIGIT = /\p{N}/u;
  const KEEP_EDGE = new Set(['*', '+', '%']); // "R*", "100%". these actually mean something, keep them
  const AND = new Set(['&', 'and', 'n']);

  const escLit = (s) => s.replace(/[\^$\\.*+?()[\]{}|/]/g, '\\$&');
  const escClass = (s) => s.replace(/[\\\]\[^-]/g, '\\$&');

  function charSrc(ch) {
    if (LEET[ch]) return '[' + escClass(LEET[ch]) + ']';
    return escLit(ch);
  }

  // 6 -> (6|vi|six). single-letter romans (v, x) are skipped on purpose, "GTA V" is a different game and i'm not blocking it
  function numeralValue(run, kind) {
    if (kind === 'N') {
      if (!/^\d+$/.test(run)) return null;
      const n = parseInt(run, 10);
      return n >= 2 && n <= 20 && String(n) === run ? n : null;
    }
    const r = ROMAN.indexOf(run);
    if (r >= 2 && run.length >= 2) return r;
    const w = NUM_WORDS.indexOf(run);
    if (w >= 2) return w;
    return null;
  }

  function numeralAlts(n) {
    const alts = [String(n)];
    if (ROMAN[n].length >= 2) alts.push(ROMAN[n]);
    alts.push(NUM_WORDS[n]);
    // roman numerals don't get the "!" and "|" leet for i. "gta!!" is excitement, not GTA II (found that one on launch day lol)
    const romanChar = (ch) => (ch === 'i' ? '[i1l]' : charSrc(ch));
    return alts.map((a) => ({
      src: Array.from(a).map(a === ROMAN[n] ? romanChar : charSrc).join(''),
      first: /\d/.test(a[0]) ? 'N' : 'L',
      last: /\d/.test(a[a.length - 1]) ? 'N' : 'L',
    }));
  }

  // splits "gta6" into [gta][6], "dre'quan" into [dre]['][quan], keeps the kind of each run
  function runsOf(word) {
    const out = [];
    for (const ch of word) {
      const kind = IS_LETTER.test(ch) ? 'L' : IS_DIGIT.test(ch) ? 'N' : 'P';
      const last = out[out.length - 1];
      if (last && last.kind === kind) last.text += ch;
      else out.push({ kind, text: ch });
    }
    return out;
  }

  const boundaryKind = (ch) => (NO_BOUNDARY.test(ch) ? 'X' : IS_DIGIT.test(ch) ? 'N' : IS_LETTER.test(ch) ? 'L' : 'P');

  // hey, here's the actual compiler. please don't. returns a regex source string, or null if the term is garbage (empty, only emoji, ...)
  function compileTerm(raw, strict) {
    const norm = normalize(raw).trim();
    if (!norm) return null;
    const words = norm.split(/\s+/).map((w) => w.replace(/^[#@]+/, '')).filter(Boolean);
    if (!words.length) return null;

    const pieces = []; // {src, first, last} where first/last are boundary kinds, or {alts:[...]} for numerals
    words.forEach((word0, wi) => {
      if (wi > 0) pieces.push({ sep: BETWEEN_WORDS });
      let word = word0;
      if (AND.has(word)) {
        pieces.push({ src: '(?:and|&|n|\\+)', first: 'L', last: 'L' });
        return;
      }
      // $ and @ glued to letters are leetspeak (youngin$, lapsus$), not punctuation
      word = word.replace(/\$(?=\p{L})|(?<=\p{L})\$/gu, 's').replace(/@(?=\p{L})|(?<=\p{L})@/gu, 'a');
      const runs = runsOf(word);
      // edge punctuation: keep * + %, drop the rest (quotes, commas, trailing dots...)
      while (runs.length && runs[0].kind === 'P' && !KEEP_EDGE.has(runs[0].text[0])) runs.shift();
      while (runs.length && runs[runs.length - 1].kind === 'P' && !KEEP_EDGE.has(runs[runs.length - 1].text.slice(-1))) runs.pop();
      if (!runs.length) {
        if (pieces.length && pieces[pieces.length - 1].sep) pieces.pop();
        return;
      }
      const wholeWord = runs.length === 1;
      runs.forEach((run, ri) => {
        if (ri > 0) pieces.push({ sep: INSIDE_WORD });
        if (run.kind === 'P') {
          // inner punctuation is just a separator (already pushed above). edge * + % stay literal
          if (ri === 0 || ri === runs.length - 1) pieces.push({ src: escLit(run.text), first: 'P', last: 'P' });
          return;
        }
        const next = runs[ri + 1];
        let n = null;
        if (run.kind === 'N' && (!next || next.kind === 'P')) n = numeralValue(run.text, 'N');
        if (run.kind === 'L' && wholeWord) n = numeralValue(run.text, 'L');
        if (n != null) {
          pieces.push({ alts: numeralAlts(n) });
          return;
        }
        const chars = Array.from(run.text);
        const short = run.kind === 'L' && chars.length <= 4 && /^[a-z]+$/.test(run.text);
        pieces.push({
          src: chars.map(charSrc).join(short ? BETWEEN_LETTERS : ''),
          first: boundaryKind(chars[0]),
          last: boundaryKind(chars[chars.length - 1]),
        });
      });
    });
    // collapse doubled separators the punctuation dance above leaves lying around
    const clean = [];
    for (const p of pieces) {
      if (p.sep && (!clean.length || clean[clean.length - 1].sep)) continue;
      clean.push(p);
    }
    while (clean.length && clean[clean.length - 1].sep) clean.pop();
    if (!clean.length) return null;

    const before = (kind) => (kind === 'X' || kind === 'P' ? '' : '(?<![\\p{L}\\p{N}])');
    const after = (kind) => {
      if (kind === 'X' || kind === 'P') return '';
      if (strict) return '(?![\\p{L}\\p{N}])';
      return kind === 'N' ? '(?!\\p{N})' : '(?!\\p{L})';
    };

    // the start boundary is NOT baked in here. compileList puts one lookbehind in front of the whole
    // alternation instead of 400 copies of it, which made the scanner ~5x faster (yeah, really). "bounded" says
    // whether this term wants it (CJK / punctuation-first terms don't)
    let src = '';
    clean.forEach((p, i) => {
      const isLast = i === clean.length - 1;
      if (p.sep) {
        src += p.sep;
        return;
      }
      if (p.alts) {
        src += '(?:' + p.alts.map((a) => a.src + (isLast ? after(a.last) : '')).join('|') + ')';
        return;
      }
      src += p.src + (isLast ? after(p.last) : '');
    });
    const head = clean[0];
    const bounded = head.alts ? true : before(head.first) !== '';
    return { src, bounded };
  }

  const BOUNDARY = '(?<![\\p{L}\\p{N}])';

  // full standalone regex source for one term (tests + debugging only)
  function termSource(raw, strict) {
    const t = compileTerm(raw, strict);
    return t ? (t.bounded ? BOUNDARY : '') + t.src : null;
  }

  // flattens {group: [terms]} or [terms] into [{term, group}]
  function flat(list) {
    if (!list) return [];
    if (Array.isArray(list)) return list.filter((t) => typeof t === 'string').map((term) => ({ term, group: '' }));
    const out = [];
    for (const [group, terms] of Object.entries(list)) {
      if (Array.isArray(terms)) for (const term of terms) if (typeof term === 'string') out.push({ term, group });
    }
    return out;
  }

  // one big alternation per list, one capture group per term so we know which one hit.
  // longest terms first so "Vice City Port" wins over "Vice City" at the same spot.
  // two regexes really: "starts at a word boundary" (almost everything) and "starts anywhere" (CJK etc)
  function compileList(entries, strict) {
    const seen = new Map();
    for (const e of entries) {
      const t = compileTerm(e.term, strict);
      if (!t) continue;
      const key = (t.bounded ? 'b:' : 'f:') + t.src;
      if (seen.has(key)) continue;
      const norm = normalize(e.term);
      const entry = { ...e, key, src: t.src, bounded: t.bounded, len: norm.length, letters: (norm.match(/\p{L}/gu) || []).length, hidden: isHiddenGroup(e.group) };
      // the boring backup plan: " term " on the flat copy. no regex, no \b, nothing clever to break
      const ft = flatText(e.term);
      if (!KEEP_FLAT.test(e.term) && ft.replace(/ /g, '').length >= 3) entry.flat = ft;
      seen.set(key, entry);
    }
    const list = [...seen.values()].sort((a, b) => b.len - a.len);
    const parts = [];
    const bounded = list.filter((e) => e.bounded);
    const free = list.filter((e) => !e.bounded);
    if (bounded.length) parts.push({ re: new RegExp(BOUNDARY + '(?:' + bounded.map((e) => '(' + e.src + ')').join('|') + ')', 'gu'), list: bounded });
    if (free.length) parts.push({ re: new RegExp(free.map((e) => '(' + e.src + ')').join('|'), 'gu'), list: free });
    return { parts, list, flats: list.filter((e) => e.flat) };
  }

  // "gta 6" -> squashed keys gta6, gtavi, gtasix (leet-folded). only for title-ish groups
  function squashKeys(entries) {
    const out = [];
    const seen = new Set();
    for (const e of entries) {
      if (!TITLE_GROUP.test(e.group) || KEEP_FLAT.test(e.term)) continue;
      const words = flatText(e.term).trim().split(' ').filter(Boolean);
      let variants = [words];
      words.forEach((w, i) => {
        if (!/^(6|vi|six)$/.test(w)) return;
        variants = variants.flatMap((v) => ['6', 'vi', 'six'].map((n) => v.map((x, j) => (j === i ? n : x))));
      });
      for (const v of variants) {
        const key = leet(v.join(''));
        if (key.length < 4 || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, letters: (key.match(/\p{L}/gu) || []).length, entry: e });
      }
    }
    return out;
  }

  // strong hits the regexes missed: flat " term " + squashed title keys. returns the entry or null
  function strongExtra(cp, masked) {
    const ft = flatText(masked);
    for (const e of cp.strong.flats) if (ft.includes(e.flat)) return e;
    if (!cp.squashKeys.length) return null;
    for (const b of squashed(masked)) {
      for (const k of cp.squashKeys) {
        let at = b.leet.indexOf(k.key);
        while (at >= 0) {
          const end = at + k.key.length;
          // must start AND end on a word edge, and the original has to have real letters in it (not "9746")
          if (b.cuts.has(at) && b.cuts.has(end) && lettersIn(b.text.slice(at, end)) * 2 >= k.letters) return k.entry;
          at = b.leet.indexOf(k.key, at + 1);
        }
      }
    }
    return null;
  }

  // replaces every match of a compiled list with the wall char (that's how allow terms get cut out)
  function maskOut(compiled, text) {
    let out = text;
    for (const part of compiled.parts) out = out.replace(part.re, WALL);
    return out;
  }

  const whichGroup = (m) => {
    for (let k = 1; k < m.length; k++) if (m[k] !== undefined) return k - 1;
    return -1;
  };

  // leetspeak has a dark side: "9 7 4 6" is technically "G T A 6" lmao. so a match has to contain at least
  // half the letters the term has. "GT4 6" passes (2 of 3), a phone number doesn't (0 of 3)
  const lettersIn = (s) => {
    let n = 0;
    for (const ch of s) if (IS_LETTER.test(ch)) n++;
    return n;
  };

  // walks every real match of a compiled list, skipping the leet false alarms. cb returns true to stop
  function scan(compiled, text, cb) {
    for (const part of compiled.parts) {
      const re = part.re;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const e = part.list[whichGroup(m)];
        if (lettersIn(m[0]) * 2 < e.letters) {
          re.lastIndex = m.index + 1; // fake match, nope, try again one char later
          continue;
        }
        if (!m[0]) re.lastIndex++;
        if (cb(e)) return;
      }
    }
  }

  const squashSet = (arr, strip) => {
    const map = new Map();
    for (const raw of arr || []) {
      if (typeof raw !== 'string') continue;
      const key = squash(strip ? raw.replace(strip, '') : raw);
      if (key) map.set(key, raw);
    }
    return map;
  };

  // "powerpyx.com/gta-6*" -> regex. host: any case, subdomains ok. path: case matters ("/wiki/*VI*" shouldn't eat "Vice")
  const globRe = (g) => g.split('*').map((x) => x.replace(/[\^$\\.+?()[\]{}|/]/g, '\\$&')).join('.*');
  function compileUrls(list, errors) {
    const out = [];
    for (const raw of list || []) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const clean = raw.trim().replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '');
      const cut = clean.indexOf('/');
      const host = (cut < 0 ? clean : clean.slice(0, cut)).toLowerCase();
      const path = cut < 0 ? '' : clean.slice(cut);
      try {
        out.push({ raw, host: new RegExp('^(?:[^/]*\\.)?' + globRe(host) + '$'), path: path ? new RegExp('^' + globRe(path) + (path.endsWith('*') ? '' : '/?$')) : null });
      } catch (e) {
        errors.push('bad url pattern ' + raw + ': ' + e.message);
      }
    }
    return out;
  }

  function compilePack(pack, opts) {
    const errors = [];
    const strongEntries = flat(pack.strong).map((e) => ({ ...e, tier: 'strong' }));
    const strong = compileList(strongEntries);
    const day = localDay(opts && opts.now);
    // the temporary launch watchlist switches itself off on its date. (YYYY-MM-DD strings compare fine as text)
    const launchList = typeof pack.launchWatchlistUntil === 'string' && day < pack.launchWatchlistUntil ? pack.launchWatchlist || [] : [];
    // contextIgnores: weak groups that context words DON'T pair with. "Jason" + "review" is just some
    // guy named jason reviewing pizza (hi jason); "GTA" + "review" is the thing we're hiding
    const ignore = new Set((pack.contextIgnores || []).map((g) => String(g).trim().toLowerCase()));
    const wc = compileList([
      ...flat(pack.weak).map((e) => ({ ...e, tier: 'weak', anchor: !ignore.has(e.group.trim().toLowerCase()) })),
      ...flat(pack.context).map((e) => ({ ...e, tier: 'context' })),
    ]);
    const allow = compileList(flat(pack.allow), true);
    const regex = [];
    for (const r of pack.regex || []) {
      if (!r || !r.pattern) continue;
      try {
        const flags = Array.from(new Set(((r.flags || 'u') + 'g').split(''))).join('');
        regex.push({ re: new RegExp(r.pattern, flags), tier: r.tier || 'strong', label: '/' + r.pattern + '/' });
      } catch (e) {
        errors.push('bad regex /' + r.pattern + '/: ' + e.message);
      }
    }
    return {
      id: pack.id,
      name: pack.name || pack.id,
      overlayText: Array.isArray(pack.overlayText) && pack.overlayText.length ? pack.overlayText : null,
      strong,
      wc,
      allow,
      regex,
      allowChannels: squashSet(pack.allowChannels),
      blockedChannels: squashSet(pack.blockedChannels),
      blockedCommunities: squashSet(pack.blockedCommunities, /^\/?r\//i),
      blockedCategories: squashSet(pack.blockedCategories),
      watchlist: squashSet([...(pack.watchlist || []), ...launchList]),
      squashKeys: squashKeys(strongEntries),
      blockedUrls: compileUrls(pack.blockedUrls, errors),
      launchWeek: day >= LAUNCH_FROM && day <= LAUNCH_TO,
      counts: { strong: strong.list.length, weak: wc.list.filter((e) => e.tier === 'weak').length,
        context: wc.list.filter((e) => e.tier === 'context').length, allow: allow.list.length, regex: regex.length },
      errors,
    };
  }

  function testRegex(r, text) {
    r.re.lastIndex = 0;
    return r.re.test(text);
  }

  // the decision for one pack on already-normalized, already-masked text
  function judge(cp, text, collect) {
    const found = collect ? { strong: [], weak: [], context: [] } : null;
    let strongHit = null;
    scan(cp.strong, text, (e) => {
      if (!collect) {
        strongHit = shown(e);
        return true;
      }
      found.strong.push(shown(e));
      return false;
    });
    if (strongHit) return { tier: 'strong', terms: [strongHit] };
    const extra = strongExtra(cp, text);
    if (extra) {
      if (!collect) return { tier: 'strong', terms: [shown(extra)] };
      if (!found.strong.includes(shown(extra))) found.strong.push(shown(extra));
    }
    for (const r of cp.regex) {
      if (r.tier !== 'strong') continue;
      if (testRegex(r, text)) {
        if (!collect) return { tier: 'strong', terms: [r.label] };
        found.strong.push(r.label);
      }
    }
    const weak = new Map();
    const anchors = new Set(); // weak hits that context words are allowed to pair with
    const ctx = new Map();
    const enough = () => weak.size >= 2 || (anchors.size >= 1 && ctx.size >= 1);
    scan(cp.wc, text, (e) => {
      if (e.tier === 'weak') {
        weak.set(e.key, shown(e));
        if (e.anchor) anchors.add(e.key);
      } else ctx.set(e.key, shown(e));
      return !collect && enough();
    });
    for (const r of cp.regex) {
      if (r.tier === 'strong' || (!collect && enough())) continue;
      if (!testRegex(r, text)) continue;
      if (r.tier === 'weak') weak.set(r.label, r.label), anchors.add(r.label);
      else ctx.set(r.label, r.label);
    }
    if (collect) {
      found.weak = [...weak.values()];
      found.context = [...ctx.values()];
      return found;
    }
    if (enough()) return { tier: 'weak', terms: [...weak.values(), ...ctx.values()].slice(0, 3) };
    return null;
  }

  class Matcher {
    // opts.now: pretend it's this time (tests). launch-week stuff + the launch watchlist look at the date
    constructor(packs, opts) {
      this.packs = (packs || []).map((p) => compilePack(p, opts));
      this.cache = new Map();
      this.errors = this.packs.flatMap((p) => p.errors.map((e) => p.name + ': ' + e));
    }

    // item: { text, channels: [], community, categories: [], live }
    // returns null (clean) or { reason, terms, pack, packName, overlayText }
    match(item) {
      if (!this.packs.length || !item) return null;
      const key = [item.text || '', (item.channels || []).join('\u0001'), item.community || '',
        (item.categories || []).join('\u0001'), item.live ? 1 : 0, item.video ? 1 : 0].join('\u0002');
      if (this.cache.has(key)) return this.cache.get(key);
      const res = this.run(item);
      if (this.cache.size > 2000) this.cache.clear(); // lazy LRU: just nuke it. it's fine. it's FINE
      this.cache.set(key, res);
      return res;
    }

    run(item) {
      const text = normalize(item.text || '');
      const chans = (item.channels || []).map(squash).filter(Boolean);
      const community = item.community ? squash(String(item.community).replace(/^\/?r\//i, '')) : '';
      const cats = (item.categories || []).map(squash).filter(Boolean);
      for (const cp of this.packs) {
        if (chans.some((c) => cp.allowChannels.has(c))) continue;
        let hit = null;
        const chan = chans.find((c) => cp.blockedChannels.has(c));
        const cat = cats.find((c) => cp.blockedCategories.has(c));
        const watched = item.live ? chans.find((c) => cp.watchlist.has(c)) : null;
        if (chan) hit = { reason: 'channel', terms: [cp.blockedChannels.get(chan)] };
        else if (community && cp.blockedCommunities.has(community)) hit = { reason: 'community', terms: ['r/' + cp.blockedCommunities.get(community).replace(/^\/?r\//i, '')] };
        else if (cat) hit = { reason: 'category', terms: [cp.blockedCategories.get(cat)] };
        else if (watched) hit = { reason: 'watchlist', terms: [cp.watchlist.get(watched)] };
        else if (text) {
          const masked = maskOut(cp.allow, text);
          const j = judge(cp, masked, false);
          if (j) hit = { reason: j.tier, terms: j.terms };
          // launch week: bare "gta" on a live card / video title is enough. "gta rp", "gta 5" etc still pass
          else if (cp.launchWeek && (item.live || item.video) && BARE_GTA.test(flatText(masked))) hit = { reason: 'strong', terms: ['GTA (launch week)'] };
        }
        if (hit) return { ...hit, pack: cp.id, packName: cp.name, overlayText: cp.overlayText };
      }
      return null;
    }

    // generic-site mode: only strong terms count. random blogs don't get the weak-combo treatment, they didn't earn it
    matchStrong(text) {
      if (!this.packs.length || !text) return null;
      const key = 'S\u0002' + text;
      if (this.cache.has(key)) return this.cache.get(key);
      const norm = normalize(text);
      let res = null;
      for (const cp of this.packs) {
        const masked = maskOut(cp.allow, norm);
        let term = null;
        scan(cp.strong, masked, (e) => ((term = shown(e)), true));
        if (!term) {
          const extra = strongExtra(cp, masked);
          if (extra) term = shown(extra);
        }
        if (!term) for (const r of cp.regex) if (r.tier === 'strong' && testRegex(r, masked)) {
          term = r.label;
          break;
        }
        if (term) {
          res = { reason: 'strong', terms: [term], pack: cp.id, packName: cp.name, overlayText: cp.overlayText };
          break;
        }
      }
      if (this.cache.size > 2000) this.cache.clear();
      this.cache.set(key, res);
      return res;
    }

    // for the settings page "test some text" box: everything that matched and why
    explain(text) {
      const norm = normalize(text || '');
      return this.packs.map((cp) => {
        const allowed = [];
        scan(cp.allow, norm, (e) => {
          allowed.push(shown(e));
          return false;
        });
        const masked = maskOut(cp.allow, norm);
        const found = judge(cp, masked, true);
        const verdict = judge(cp, masked, false);
        return { pack: cp.id, name: cp.name, normalized: norm, allowed, ...found, blur: !!verdict, why: verdict };
      });
    }

    // is this whole page on someone's blocked url list? loc = location or URL
    urlHit(loc) {
      if (!loc || !loc.hostname) return null;
      const host = loc.hostname.toLowerCase().replace(/^www\./, '');
      let path = loc.pathname || '/';
      try {
        path = decodeURIComponent(path);
      } catch (e) {
        /* broken % escapes, use it raw */
      }
      for (const cp of this.packs) {
        for (const u of cp.blockedUrls) {
          if (u.host.test(host) && (!u.path || u.path.test(path))) return { reason: 'url', terms: [u.raw], pack: cp.id, packName: cp.name, overlayText: cp.overlayText };
        }
      }
      return null;
    }

    // does this name/category/subreddit hit any pack's lists? used for page-level checks
    listHit(kind, value) {
      const key = kind === 'community' ? squash(String(value).replace(/^\/?r\//i, '')) : squash(value);
      if (!key) return null;
      const field = { channel: 'blockedChannels', community: 'blockedCommunities', category: 'blockedCategories', watchlist: 'watchlist' }[kind];
      for (const cp of this.packs) {
        if (cp[field] && cp[field].has(key)) return { reason: kind, terms: [cp[field].get(key)], pack: cp.id, packName: cp.name, overlayText: cp.overlayText };
      }
      return null;
    }
  }

  SS.Matcher = Matcher;
  SS.matcherInternals = { compileTerm, termSource, compileList, flat, numeralValue, isHiddenGroup, MASK, LAUNCH_FROM, LAUNCH_TO };
  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
