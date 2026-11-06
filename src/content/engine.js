// hey, not a good idea to touch this one. it's the scanner: watches the page, checks every card once (and
// again if the site recycles it with new content), blurs the bad ones, does stream pages, blocked pages + live chat.
//
// timing, because this is where EVERYTHING goes wrong:
//  - new cards are already invisible thanks to early.js, so checking them can wait for idle time
//  - but cards that were ALREADY checked and then got new content (youtube recycles DOM nodes like
//    it's saving the planet) are visible, so those get re-checked right there in the mutation
//    callback, which runs before the next paint. no flash.
//  - everything is time-boxed so a 400-card page doesn't freeze the tab
(function () {
  const SS = globalThis.SpoilerShield;
  const { WALL, hash } = SS.text;

  const BUDGET_MS = 8; // per mutation batch, before we punt the rest to idle time
  const HOLD_MAX_MS = 6000; // longest we'll hold a player while waiting for the page to say what it is
  const NAV_SETTLE_MS = 3000; // after a SPA navigation, wait up to this long for the old title to go away
  const idle = globalThis.requestIdleCallback
    ? (cb) => requestIdleCallback(cb, { timeout: 90 })
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: true }), 16);

  // generic mode: things that count as "a paragraph or card" on random websites
  const GENERIC_BLOCK = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, figure, td, th, dd, dt, summary, article, [role="article"], [role="listitem"], [role="heading"]';
  const GENERIC_SKIP = 'script, style, noscript, textarea, input, select, [contenteditable=""], [contenteditable="true"], ss-shield, ss-wall, head';

  // links that point at THE post itself, best first. used to remember reveals across re-renders
  const PERMALINKS = ['a[href*="/status/"]', 'a[href*="/watch?v="]', 'a[href*="/shorts/"]', 'a[href*="/comments/"]',
    'a[href*="/post/"]', 'a[href*="/p/"]', 'a[href*="/reel/"]', 'a[href*="/video/"]', 'a[href*="/clip/"]', 'a[href]'];

  const describe = (res) => {
    const t = (res.terms || []).map((x) => `"${x}"`).join(' + ');
    switch (res.reason) {
      case 'strong': return `matched ${t}`;
      case 'weak': return `matched ${t}`;
      case 'channel': return `blocked channel ${t}`;
      case 'community': return `blocked community ${t}`;
      case 'category': return `blocked category ${t}`;
      case 'watchlist': return `on your watchlist: ${t}`;
      case 'strict': return 'strict streams mode: gaming livestream';
      case 'chat': return 'live chat on a flagged stream';
      default: return t;
    }
  };

  class Engine {
    constructor(site) {
      this.site = site || null;
      this.generic = !site;
      this.itemSel = site ? SS.sites.validSelectors(site.items.map((i) => i[0])).join(',') : '';
      this.queue = new Set();
      this.scheduled = false;
      this.running = false;
      this.matcher = null;
      this.settings = SS.store.DEFAULT_SETTINGS;
      this.sigs = new WeakMap();
      this.revealed = new Set(); // posts you held-to-reveal on this page (by identity, see identity())
      this.acked = new Set(); // page/stream warnings you already clicked through
      this.wallKey = null;
      this.lastUrl = location.href;
      this.navAt = Date.now();
      this.prevPageSig = null;
      this.holdSince = 0;
      this.lastCount = -1;
      this.timers = [];
      this.onMut = this.onMut.bind(this);
    }

    configure(state) {
      this.settings = state.settings;
      this.matcher = new SS.Matcher(state.livePacks);
      document.documentElement.style.setProperty('--ss-blur', Math.max(4, Math.min(60, Number(state.settings.blurPx) || 24)) + 'px');
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.observer = new MutationObserver(this.onMut);
      this.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      this.scanAll();
      this.checkPage();
      this.timers.push(setInterval(() => this.watchdog(), 1500));
      this.timers.push(setInterval(() => this.urlTick(), 400));
      this.timers.push(setInterval(() => this.checkPage(), 2000)); // streams that change title/category mid-stream
      if (globalThis.navigation && navigation.addEventListener) {
        this.navListener = (e) => this.beforeNavigate(e);
        navigation.addEventListener('navigate', this.navListener);
      }
      this.pageShow = () => this.recheckAll();
      window.addEventListener('pageshow', this.pageShow);
      if (this.site && this.site.onNavigateEvent) {
        this.siteNav = () => this.urlTick(true);
        document.addEventListener(this.site.onNavigateEvent, this.siteNav);
      }
    }

    stop() {
      this.running = false;
      if (this.observer) this.observer.disconnect();
      for (const t of this.timers) clearInterval(t);
      this.timers = [];
      if (this.navListener) navigation.removeEventListener('navigate', this.navListener);
      if (this.pageShow) window.removeEventListener('pageshow', this.pageShow);
      if (this.siteNav) document.removeEventListener(this.site.onNavigateEvent, this.siteNav);
      this.queue.clear();
      for (const el of document.querySelectorAll('[data-ss]')) {
        SS.shield.detach(el);
        this.inert(el, false);
        el.removeAttribute('data-ss');
        el.removeAttribute('data-ss-pos');
      }
      SS.shield.hideWall();
      this.wallKey = null;
      SS.stream.unlock(false);
      SS.stream.unhold(false);
      document.documentElement.removeAttribute('data-ss-pagecheck');
      this.report(0);
    }

    // new settings/packs: look at everything again (revealed cards stay revealed)
    recheckAll() {
      this.sigs = new WeakMap();
      this.scanAll(true);
      this.wallKey = null;
      this.checkPage();
    }

    // ---------- cards ----------

    ours(node) {
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      return !!(el && el.closest && el.closest('ss-shield, ss-wall'));
    }

    itemOf(node) {
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (!el || !el.closest) return null;
      if (this.generic) return this.genericBlock(el);
      return el.closest(this.itemSel);
    }

    genericBlock(el) {
      if (!el || !el.closest || el.closest(GENERIC_SKIP)) return null;
      const b = el.closest(GENERIC_BLOCK) || el;
      if (b === document.body || b === document.documentElement || b.tagName === 'MAIN') return null;
      return b;
    }

    collectFrom(node, into) {
      if (this.generic) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let n;
        let i = 0;
        while ((n = walker.nextNode()) && i++ < 3000) {
          if (n.nodeValue.length < 3) continue;
          const b = this.genericBlock(n.parentElement);
          if (b) into.add(b);
        }
        if (node.querySelectorAll) for (const img of node.querySelectorAll('img[alt]')) {
          const b = this.genericBlock(img.closest('figure, a') || img);
          if (b) into.add(b);
        }
        return;
      }
      if (!this.itemSel) return;
      if (node.matches && node.matches(this.itemSel)) into.add(node);
      if (node.querySelectorAll) for (const el of node.querySelectorAll(this.itemSel)) into.add(el);
      const parent = node.parentElement && node.parentElement.closest(this.itemSel);
      if (parent) into.add(parent);
    }

    scanAll(force) {
      if (!this.matcher) return;
      const set = new Set();
      if (this.generic) {
        if (document.body) this.collectFrom(document.body, set);
      } else if (this.itemSel) {
        for (const el of document.querySelectorAll(this.itemSel)) set.add(el);
      }
      for (const el of set) this.queue.add(el);
      if (force) for (const el of set) this.sigs.delete(el);
      this.flush(performance.now());
    }

    onMut(muts) {
      if (!this.running) return;
      const t0 = performance.now();
      const touched = new Set();
      for (const m of muts) {
        if (this.ours(m.target)) continue;
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              if (n.tagName === 'SS-SHIELD' || n.tagName === 'SS-WALL') continue;
              this.collectFrom(n, touched);
            } else if (n.nodeType === 3) {
              const it = this.itemOf(n);
              if (it) touched.add(it);
            }
          }
          if (m.removedNodes.length && !this.generic) {
            const it = this.itemOf(m.target);
            if (it) touched.add(it);
          }
        } else if (m.type === 'characterData') {
          const it = this.itemOf(m.target);
          if (it) touched.add(it);
        }
      }
      for (const el of touched) {
        // already-visible cards get checked right now (before paint). new hidden ones can wait if we're busy
        const visible = this.generic || el.hasAttribute('data-ss');
        if (visible || performance.now() - t0 < BUDGET_MS) this.check(el);
        else this.queue.add(el);
      }
      if (this.queue.size) this.schedule();
      this.countSoon();
      this.pageSoon();
    }

    schedule() {
      if (this.scheduled) return;
      this.scheduled = true;
      idle((deadline) => {
        this.scheduled = false;
        const t0 = performance.now();
        const budget = Math.max(BUDGET_MS, deadline && deadline.timeRemaining ? deadline.timeRemaining() : 0);
        this.flush(t0, budget);
      });
    }

    flush(t0, budget) {
      const limit = budget || BUDGET_MS * 3;
      for (const el of this.queue) {
        this.queue.delete(el);
        this.check(el);
        if (performance.now() - t0 > limit) break;
      }
      if (this.queue.size) this.schedule();
      this.countSoon();
    }

    fieldsOf(el) {
      if (this.generic) return { text: SS.collect.textOf(el) + WALL + SS.collect.attrText(el), channels: [], categories: [], live: false };
      return SS.collect.fields(el, this.site);
    }

    check(el) {
      if (!el || !el.isConnected || !this.matcher || this.ours(el)) return;
      let f;
      try {
        f = this.fieldsOf(el);
      } catch (e) {
        if (!this.generic) el.setAttribute('data-ss', 'ok'); // never leave a card invisible because we tripped
        return;
      }
      const sig = hash([f.text, (f.channels || []).join('|'), f.community || '', (f.categories || []).join('|'), f.live ? 1 : 0].join('\u0001'));
      const state = el.getAttribute('data-ss');
      if (this.sigs.get(el) === sig && (state || this.generic)) {
        if (state === 'blocked' && !el.querySelector(':scope > ss-shield')) this.sigs.delete(el), this.check(el); // site nuked our overlay
        return;
      }
      this.sigs.set(el, sig);
      const res = this.generic ? this.matcher.matchStrong(f.text) : this.matcher.match(f);
      if (!res) return this.clear(el);
      // you already said yes to this post. remembered per post (its permalink), not per DOM node or
      // exact text, because X re-creates posts and bumps like counts constantly. that re-blurred stuff
      if (this.revealed.has(this.identity(el, f, res))) return this.reveal(el);
      this.block(el, res, f);
    }

    // "which post is this" in a way that survives re-renders: its permalink if it has one, else its text
    identity(el, f, res) {
      let id = null;
      for (const sel of PERMALINKS) {
        const a = el.querySelector(sel);
        if (a && !a.closest('ss-shield')) {
          id = a.getAttribute('href');
          break;
        }
      }
      if (!id) id = 't:' + hash(String(f.text || '').replace(/[0-9]+/g, '#').slice(0, 400)); // digits out, counters tick
      return id + '|' + (res.pack || '') + '|' + (res.terms || []).join(',');
    }

    block(el, res, f) {
      el.setAttribute('data-ss', 'blocked');
      if (!el.hasAttribute('data-ss-pos') && getComputedStyle(el).position === 'static') el.setAttribute('data-ss-pos', '');
      const why = this.settings.showMatched ? describe(res) : null;
      const lines = res.overlayText || SS.packs.DEFAULT_OVERLAY;
      SS.shield.attach(el, {
        // NOT keyed on the card's text: a like count ticking up mid-hold rebuilt the overlay and ate
        // your hold (the "hold it twice" bug). only a different verdict or look rebuilds it now
        key: [res.pack, res.reason, (res.terms || []).join(','), this.settings.revealMode, why || '', lines.join('|')].join('#'),
        lines,
        why,
        mode: this.settings.revealMode,
        onReveal: () => {
          if (f) this.revealed.add(this.identity(el, f, res));
          this.reveal(el);
        },
      });
      this.inert(el, true);
      SS.stream.pauseInside(el);
    }

    clear(el) {
      if (el.getAttribute('data-ss') === 'blocked') {
        SS.shield.detach(el);
        this.inert(el, false);
      }
      if (this.generic) el.removeAttribute('data-ss');
      else el.setAttribute('data-ss', 'ok');
    }

    reveal(el) {
      el.setAttribute('data-ss', 'revealed');
      SS.shield.detach(el);
      this.inert(el, false);
      this.countSoon();
    }

    // blurred cards shouldn't be tab-able/clickable underneath the overlay either
    inert(el, on) {
      for (const child of el.children) {
        if (child.tagName === 'SS-SHIELD') continue;
        if (on && !child.inert) {
          child.inert = true;
          child.setAttribute('data-ss-inert', '');
        } else if (!on && child.hasAttribute('data-ss-inert')) {
          child.inert = false;
          child.removeAttribute('data-ss-inert');
        }
      }
    }

    // ---------- the badge number ----------

    countSoon() {
      clearTimeout(this.countTimer);
      this.countTimer = setTimeout(() => this.report(), 250);
    }

    get count() {
      return document.querySelectorAll('[data-ss="blocked"]').length + (SS.shield.wallUp ? 1 : 0);
    }

    report(force) {
      const n = force === 0 ? 0 : this.count;
      if (n === this.lastCount) return;
      this.lastCount = n;
      SS.send({ type: 'ss:count', count: n });
    }

    // ---------- whole pages: blocked communities/categories + stream/video players ----------

    pageSoon() {
      if (this.pageTimer) return;
      this.pageTimer = setTimeout(() => {
        this.pageTimer = null;
        this.checkPage();
      }, 300);
    }

    beforeNavigate(e) {
      // navigation api fires BEFORE a SPA swaps the page. blank/hold right away if we're going somewhere risky
      try {
        if (!e.destination || !e.destination.url) return;
        const url = new URL(e.destination.url);
        if (url.origin !== location.origin || !this.site) return;
        if (this.site.blockPage && this.site.blockPage(url)) document.documentElement.setAttribute('data-ss-pagecheck', '');
        if (this.site.page && this.site.page.kind && this.site.page.kind(url)) SS.stream.hold();
      } catch (err) {
        /* weird urls. ignore */
      }
    }

    urlTick(force) {
      if (!force && location.href === this.lastUrl) return;
      const was = this.lastUrl;
      this.lastUrl = location.href;
      if (was === location.href && !force) return;
      this.navAt = Date.now();
      this.prevPageSig = this.pageSig;
      this.wallKey = null;
      SS.shield.hideWall();
      SS.stream.unlock(false);
      if (this.site && this.site.page && this.site.page.kind && this.site.page.kind(location)) SS.stream.hold();
      if (this.site && this.site.blockPage && this.site.blockPage(location)) document.documentElement.setAttribute('data-ss-pagecheck', '');
      this.checkPage();
      this.scanAll();
    }

    pageInfo() {
      const p = this.site.page;
      const one = (sels) => {
        if (!sels) return '';
        for (const s of sels) {
          let el;
          try {
            el = document.querySelector(s);
          } catch (e) {
            continue;
          }
          const t = el && (el.textContent || el.getAttribute('content') || el.getAttribute('aria-label') || '').trim();
          if (t) return t;
        }
        return '';
      };
      const all = (sels, handles) => {
        const out = [];
        for (const s of sels || []) {
          try {
            for (const el of document.querySelectorAll(s)) {
              const t = (el.textContent || el.getAttribute('content') || '').trim();
              if (t && t.length < 200) out.push(t);
              const href = handles && el.getAttribute('href');
              if (href && this.site.handle) {
                const h = this.site.handle(href);
                if (h) out.push(h);
              }
            }
          } catch (e) {
            /* bad selector, skip */
          }
        }
        return out;
      };
      const title = one(p.title);
      const channelText = all(p.channel, true);
      const channels = channelText.slice();
      if (p.channelHandle) {
        const h = p.channelHandle(location);
        if (h) channels.push(h);
      }
      const categories = all(p.category);
      const live = typeof p.live === 'function' ? !!p.live() : !!one(p.live);
      const meta = ['meta[property="og:title"]', 'meta[name="title"]', 'meta[property="og:description"]', 'meta[name="description"]']
        .map((s) => {
          const el = document.querySelector(s);
          return el ? el.getAttribute('content') || '' : '';
        });
      const extra = p.extraText ? p.extraText() : '';
      const text = [title, ...channelText, ...categories, document.title, ...meta, extra].filter(Boolean).join(WALL);
      return { text, channels, categories, live, ready: !!title, title };
    }

    checkPage() {
      if (!this.running || !this.matcher || !this.site) {
        document.documentElement.removeAttribute('data-ss-pagecheck');
        return;
      }
      const site = this.site;
      // 1) whole-page blocks
      const bp = site.blockPage ? site.blockPage(location) : null;
      if (bp) {
        const res =
          this.matcher.listHit(bp.kind, bp.value) ||
          this.matcher.match({
            text: bp.value,
            community: bp.kind === 'community' ? bp.value : null,
            categories: bp.kind === 'category' ? [bp.value] : [],
            channels: bp.kind === 'channel' ? [bp.value] : [],
          });
        if (res) {
          this.wall('page', res, { badge: bp.label || 'Blocked page', why: (bp.label || 'Blocked page') + ': ' + bp.value });
          document.documentElement.removeAttribute('data-ss-pagecheck');
          return;
        }
      }
      document.documentElement.removeAttribute('data-ss-pagecheck');

      // 2) player pages
      const kind = site.page && site.page.kind ? site.page.kind(location) : null;
      if (!kind) {
        if (this.wallKey && this.wallKey.startsWith('stream|')) this.dropWall();
        SS.stream.unhold(true);
        return;
      }
      const info = this.pageInfo();
      const sig = hash(info.text);
      this.pageSig = sig;
      const settling = Date.now() - this.navAt < NAV_SETTLE_MS && this.prevPageSig && sig === this.prevPageSig;
      if (!info.ready || settling) {
        if (!this.holdSince) this.holdSince = Date.now();
        if (Date.now() - this.holdSince < HOLD_MAX_MS) {
          SS.stream.hold();
          clearTimeout(this.holdTimer); // one retry timer, not a new one per call (they used to breed)
          this.holdTimer = setTimeout(() => this.checkPage(), 250);
          return;
        }
      }
      this.holdSince = 0;
      this.prevPageSig = null;
      let res = this.matcher.match(info);
      if (!res && info.live && this.settings.strictStreams && (site.page.gaming ? site.page.gaming(info) : true)) {
        res = { reason: 'strict', terms: [], overlayText: null, packName: 'strict streams' };
      }
      this.chat(!!res && (info.live || kind === 'stream'));
      if (res) {
        this.wall('stream', res, { badge: info.live ? 'Live stream' : 'Video', live: info.live });
      } else {
        if (this.wallKey && this.wallKey.startsWith('stream|')) this.dropWall();
        SS.stream.unhold(true);
      }
      this.countSoon();
    }

    wall(type, res, opts) {
      const key = [type, location.pathname, res.reason, (res.terms || []).join(',')].join('|');
      if (this.acked.has(key)) {
        SS.stream.unhold(true);
        return;
      }
      if (this.wallKey === key && SS.shield.wallUp && SS.shield.wallStillThere()) return;
      this.wallKey = key;
      SS.stream.lock();
      const packWhy = res.reason === 'strict' ? 'Strict streams mode: this is a gaming livestream.' : `This matched your ${res.packName || 'spoiler'} pack.`;
      const why = this.settings.showMatched ? packWhy + ' ' + describe(res) : packWhy;
      SS.shield.showWall({
        badge: opts.badge,
        title: 'Spoiler warning',
        lines: res.overlayText || SS.packs.DEFAULT_OVERLAY,
        why: type === 'page' && this.settings.showMatched ? opts.why : why,
        mode: this.settings.revealMode,
        holdLabel: type === 'page' ? 'Hold to show anyway' : 'Hold to watch anyway',
        confirmLabel: type === 'page' ? 'Show anyway…' : 'Watch anyway…',
        outLabel: 'Get me out of here',
        small: type === 'stream' ? 'The player is paused and muted until you decide.' : null,
        onOut: () => this.getOut(),
        onReveal: () => {
          this.acked.add(key);
          this.wallKey = null;
          SS.stream.unlock(true);
          SS.stream.unhold(true);
          this.countSoon();
        },
      });
      this.countSoon();
    }

    dropWall() {
      SS.shield.hideWall();
      this.wallKey = null;
      SS.stream.unlock(false);
    }

    getOut() {
      const home = (this.site && this.site.home) || '/';
      if (history.length > 1) {
        history.back();
        setTimeout(() => {
          if (SS.shield.wallUp) location.href = home; // back didn't go anywhere useful
        }, 900);
      } else {
        location.href = home;
      }
    }

    // collapse live chat on flagged streams
    chat(flagged) {
      const c = this.site.page && this.site.page.chat;
      if (!c) return;
      // first selector that finds anything wins. chat boxes nest (shell > chat > room) and two
      // overlays stacked on each other look so dumb. trust me i've seen it
      let boxes = [];
      for (const sel of c) {
        try {
          boxes = Array.from(document.querySelectorAll(sel));
        } catch (e) {
          boxes = [];
        }
        if (boxes.length) break;
      }
      for (const box of boxes) {
        const ours = box.getAttribute('data-ss-chat') === '1';
        if (flagged && this.settings.collapseChat) {
          if (ours && box.getAttribute('data-ss') === 'revealed') continue;
          box.setAttribute('data-ss-chat', '1');
          if (box.getAttribute('data-ss') !== 'blocked') {
            this.block(box, { reason: 'chat', terms: [], overlayText: ['Chat hidden.', "hey, not a good idea, like seriously, don't unblock this"] }, null);
          }
        } else if (ours) {
          box.removeAttribute('data-ss-chat');
          if (box.getAttribute('data-ss') === 'blocked') {
            SS.shield.detach(box);
            this.inert(box, false);
          }
          box.removeAttribute('data-ss');
        }
      }
    }

    watchdog() {
      if (!this.running) return;
      if (!this.generic && this.itemSel) {
        // cards we somehow never saw (shouldn't happen, but sites are "creative". looking at you youtube)
        for (const el of document.querySelectorAll(this.itemSel)) {
          if (!el.hasAttribute('data-ss')) this.queue.add(el);
          else if (el.getAttribute('data-ss') === 'blocked' && !el.querySelector(':scope > ss-shield')) {
            this.sigs.delete(el);
            this.queue.add(el);
          }
        }
        if (this.queue.size) this.schedule();
      }
      if (this.wallKey && !SS.shield.wallStillThere()) {
        this.wallKey = null; // site removed our wall. checkPage puts it back
        this.checkPage();
      }
      this.countSoon();
    }
  }

  SS.Engine = Engine;
})();
