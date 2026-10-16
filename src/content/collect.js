// pulls the readable stuff out of a card: text, alt text, aria-labels, channel names, categories,
// live badges. the annoying part is not gluing unrelated bits together: a title ending in "GTA" next
// to "6M views" must NOT read as "GTA 6M views". so text from different blocks of the card gets a
// wall char between it (see normalize.js), text inside the same block (<b>GTA</b> 6) stays glued.
(function () {
  const SS = globalThis.SpoilerShield;
  const { WALL } = SS.text;

  // tags that don't start a new "block" of text
  const INLINE = new Set(['A', 'ABBR', 'B', 'BDI', 'BDO', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'FONT', 'I', 'KBD', 'MARK',
    'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SS-SHIELD', 'SVG', 'svg', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME']);
  const MAX_TEXT = 6000;
  const MAX_ATTR_NODES = 40;

  function blockOf(node, stop) {
    let el = node.parentElement;
    while (el && el !== stop && INLINE.has(el.tagName)) el = el.parentElement;
    return el || stop;
  }

  // text of a subtree with walls between blocks. skipSel = subtrees to ignore (comments inside posts...)
  function textOf(root, skipSel) {
    if (!root) return '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          if (SKIP.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          if (skipSel && n !== root && n.matches(skipSel)) return NodeFilter.FILTER_REJECT;
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
        // it reads "@usergta 6" and the word boundary fails. (found by a test, which is what tests are for)
        else if (parent !== lastParent && !/\s$/.test(out) && !/^\s/.test(n.nodeValue)) out += ' ';
      }
      out += n.nodeValue;
      lastBlock = block;
      lastParent = parent;
      if (out.length > MAX_TEXT) break;
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

  // everything the matcher wants for one card
  function fields(el, site) {
    const f = {
      text: textOf(el, site.skipText) + WALL + attrText(el, site.attrs),
      channels: channelsOf(el, site),
      community: null,
      categories: texts(el, site.category),
      live: isLive(el, site),
    };
    return site.extract ? site.extract(el, f) || f : f;
  }

  SS.collect = { textOf, attrText, texts, channelsOf, isLive, fields, INLINE };
})();
