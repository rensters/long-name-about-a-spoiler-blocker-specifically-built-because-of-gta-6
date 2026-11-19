// oh hey. this one yanks the readable stuff out of a card: text, alt text, aria-labels, channel names,
// categories, live badges. the annoying bit is NOT gluing unrelated stuff together: a title ending in "GTA"
// next to "6M views" must NOT turn into "GTA 6M views" (ask me how i know). so text from different blocks
// gets a wall char between it (see normalize.js), text inside one block (<b>GTA</b> 6) stays glued.
(function () {
  const SS = globalThis.NoSpoil;
  const { WALL } = SS.text;

  // tags that DON'T start a new "block" of text. yes i typed all of these by hand
  const INLINE = new Set(['A', 'ABBR', 'B', 'BDI', 'BDO', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'FONT', 'I', 'KBD', 'MARK',
    'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SS-SHIELD', 'SVG', 'svg', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME']);
  const MAX_TEXT = 6000;
  const MAX_ATTR_NODES = 40;

  // "LIVE" pills and "3K watching" counters. if a card has one of these, it's a live stream, whatever the site calls it
  const LIVE_RE = /^(?:live|live now|en vivo|en directo|ao vivo|en direct|langsung|in diretta)$/i;
  const COUNT_RE = /^[\d.,]+\s*[kmb]?\s+(?:watching(?: now)?|viewers?|zuschauer(?:innen)?|espectadores|spectateurs|penonton|assistindo|spettatori)$/i;
  const badgeKind = (s) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 40) return null;
    if (COUNT_RE.test(t)) return 'count';
    if (LIVE_RE.test(t)) return 'live';
    return null;
  };

  // el.closest() that climbs out of shadow roots too. hi web components, nobody likes you
  function closestDeep(el, sel) {
    while (el) {
      const c = el.closest ? el.closest(sel) : null;
      if (c) return c;
      const root = el.getRootNode ? el.getRootNode() : null;
      el = root && root.host ? root.host : null;
    }
    return null;
  }

  function blockOf(node, stop) {
    let el = node.parentElement;
    while (el && el !== stop && INLINE.has(el.tagName)) el = el.parentElement;
    return el || stop;
  }

  // text of a subtree with walls between blocks. skipSel = subtrees we pretend don't exist (comments inside posts...)
  function textOf(root, skipSel, depth) {
    if (!root) return '';
    const shadows = []; // open shadow roots inside the card. their text counts too
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          if (SKIP.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          if (skipSel && n !== root && n.matches(skipSel)) return NodeFilter.FILTER_REJECT;
          if (n.shadowRoot && shadows.length < 20) shadows.push(n.shadowRoot);
          return NodeFilter.FILTER_SKIP;
        }
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    let out = '';
    let lastBlock = null;
    let lastParent = null;
    let n;
    while ((n = walker.nextNode())) {
      const block = blockOf(n, root);
      const parent = n.parentElement;
      if (out) {
        if (block !== lastBlock) out += WALL;
        // <span>@user</span><span>gta 6</span> renders with a gap but the text has none. without this
        // it reads "@usergta 6" and the word boundary fails. (a test caught this. see, tests are good. sometimes)
        else if (parent !== lastParent && !/\s$/.test(out) && !/^\s/.test(n.nodeValue)) out += ' ';
      }
      out += n.nodeValue;
      lastBlock = block;
      lastParent = parent;
      if (out.length > MAX_TEXT) break;
    }
    if ((depth || 0) < 3) for (const sr of shadows) {
      const t = textOf(sr, skipSel, (depth || 0) + 1);
      if (t) out += WALL + t;
    }
    return out;
  }

  function attrText(el, extraAttrs) {
    const parts = [];
    const read = (node) => {
      for (const a of ['aria-label', 'alt', 'title']) {
        const v = node.getAttribute(a);
        if (v && v.length < 600) parts.push(v);
      }
    };
    read(el);
    for (const a of extraAttrs || []) {
      const v = el.getAttribute(a);
      if (v) parts.push(v);
    }
    let i = 0;
    for (const node of el.querySelectorAll('[aria-label],[alt],[title]')) {
      if (++i > MAX_ATTR_NODES) break;
      if (node.closest('ss-shield')) continue;
      read(node);
    }
    return parts.join(WALL);
  }

  function texts(el, sels) {
    const out = [];
    if (!sels || !sels.length) return out;
    for (const node of el.querySelectorAll(sels.join(','))) {
      const t = (node.textContent || node.getAttribute('aria-label') || '').trim();
      if (t && t.length < 200) out.push(t);
    }
    return out;
  }

  function channelsOf(el, site) {
    const out = [];
    if (!site.channel || !site.channel.length) return out;
    let nodes;
    try {
      nodes = el.querySelectorAll(site.channel.join(','));
    } catch (e) {
      return out;
    }
    for (const node of nodes) {
      const t = (node.textContent || '').trim();
      if (t && t.length < 120) out.push(t);
      const href = node.getAttribute && node.getAttribute('href');
      if (href && site.handle) {
        const h = site.handle(href);
        if (h) out.push(h);
      }
    }
    return out;
  }

  function isLive(el, site) {
    if (!site.live || !site.live.length) return false;
    try {
      return !!el.querySelector(site.live.join(','));
    } catch (e) {
      return false;
    }
  }

  // thumbnail urls + links with "gta-6" in the slug. only the slug bit goes in, not the whole url (urls are word soup)
  function slugText(el) {
    const out = [];
    let i = 0;
    const nodes = el.matches('a[href], img[src]') ? [el] : [];
    for (const n of nodes.concat(Array.from(el.querySelectorAll('a[href], img[src], img[srcset], source[srcset]')))) {
      if (++i > 30) break;
      for (const a of ['href', 'src', 'srcset']) out.push(...SS.sites.slugWords(n.getAttribute(a)));
    }
    return out.join(WALL);
  }

  // hey matcher, here's everything you want for one card. happy?
  function fields(el, site) {
    const text = textOf(el, site.skipText);
    const talk = !!(site.talkSel && el.matches(site.talkSel));
    const f = {
      text: text + WALL + attrText(el, site.attrs) + WALL + slugText(el),
      channels: channelsOf(el, site),
      community: null,
      categories: texts(el, site.category),
      live: isLive(el, site) || (!talk && text.split(WALL).some((b) => badgeKind(b))),
      video: !!site.video && !talk, // launch week: bare "gta" on video titles counts
    };
    return site.extract ? site.extract(el, f) || f : f;
  }

  // ---------- the fallback: LIVE badges nobody told us about ----------
  // the kick leak (2026-11-19) was a card none of our selectors knew. so now: any "LIVE" pill or "3K watching"
  // counter that isn't inside a known card -> climb up to something card-sized -> mark it [data-ss-card] (early.js
  // css hides those) -> the engine checks it like any other card. early.js runs this while the page is still
  // loading too, so these cards never paint before we've looked. that was the whole bug, basically
  const ours = (el) => !!(el && el.closest && el.closest('ss-shield, ss-wall'));

  // how many separate cards' worth of badges are in here. counters win over LIVE pills (a card can have 2 pills)
  function badgeCount(el) {
    let lives = 0;
    let counts = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    let i = 0;
    while ((n = walker.nextNode()) && i++ < 600) {
      const k = badgeKind(n.nodeValue);
      if (k === 'count') counts++;
      else if (k === 'live') lives++;
      if (counts > 1) break;
    }
    // "3K" + "watching" in two spans: count it once, on the element that holds both
    if (counts < 2) for (const e of el.querySelectorAll('div, p, span, li')) {
      if (e.children.length && e.children.length <= 3 && badgeKind(e.textContent) === 'count') counts++;
      if (counts > 1) break;
    }
    return counts ? counts : lives;
  }

  function climbCard(el) {
    let best = null;
    let cur = el;
    for (let d = 0; d < 10 && cur && cur !== document.body && cur !== document.documentElement; d++) {
      const r = cur.getBoundingClientRect();
      if (r.width > 960 || r.height > 760) break; // that's a whole section, not a card
      if (d > 0 && badgeCount(cur) > 1) break; // two cards' worth of badges = we climbed into the grid
      if (cur.matches('a[href]') || cur.querySelector('a[href], img')) best = cur;
      const root = cur.getRootNode ? cur.getRootNode() : null;
      cur = cur.parentElement || (root && root.host) || null;
    }
    return best;
  }

  // cardSel = selectors of cards we already know about (those don't need the fallback)
  function findCards(root, cardSel, into) {
    const start = root && root.nodeType === 3 ? root.parentElement : root;
    if (!start || (start.nodeType === 1 && ours(start))) return;
    const seen = new Set();
    const consider = (host) => {
      if (!host || seen.has(host) || ours(host)) return;
      seen.add(host);
      if (cardSel && closestDeep(host, cardSel)) return; // a known card, the normal path has it
      const card = climbCard(host);
      if (!card) return;
      card.setAttribute('data-ss-card', '');
      if (into) into.add(card);
    };
    if (start.nodeType === 1 && badgeKind(start.textContent)) consider(start);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT);
    let n;
    let i = 0;
    while ((n = walker.nextNode()) && i++ < 3000) {
      const v = n.nodeValue;
      if (!v || v.length > 40) continue;
      const p = n.parentElement;
      if (badgeKind(v)) consider(p);
      else if (p && badgeKind(p.textContent)) consider(p);
      else if (p && p.parentElement && p.parentElement.children.length <= 3 && badgeKind(p.parentElement.textContent)) consider(p.parentElement);
    }
  }

  SS.collect = { textOf, attrText, texts, channelsOf, isLive, fields, slugText, badgeKind, closestDeep, findCards, badgeCount, INLINE };
})();
