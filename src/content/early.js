// hey, you found the speedrun file. runs at document_start, the page is basically an empty <html> rn.
// job #1: get the "hide every card until we've looked at it" css in before the site paints ANYTHING. storage
// is async so we don't even know if the extension is on yet. hide first, ask questions later
// (main.js un-hides everything if it turns out we're off).
(function () {
  const SS = globalThis.NoSpoil;
  if (!SS || SS.early) return; // don't run twice. popout chat windows LOVE injecting us twice

  const site = SS.sites.pick(location) || null;
  const generic = SS.sites.byId('generic');

  const style = document.createElement('style');
  style.id = 'ss-early';
  const rules = [];
  if (site) {
    // one rule per selector: if a browser chokes on one it only loses that one, not the whole lot
    for (const [sel] of site.items) rules.push(`${sel}:not([data-ss]){opacity:0!important;pointer-events:none!important}`);
    // cards the engine found by their LIVE badge (no selector knew them). same deal
    rules.push('[data-ss-card]:not([data-ss]){opacity:0!important;pointer-events:none!important}');
    // while a video/stream page is being checked, its title + player area stay invisible too.
    // otherwise you'd read "GTA 6 whatever" in the title for 30ms before the warning lands. and then you're spoiled. great
    for (const sel of (site.page && site.page.holdCss) || []) rules.push(`html[data-ss-hold] ${sel}{visibility:hidden!important}`);
    if (site.css) rules.push(site.css);
  }
  style.textContent = rules.join('\n');
  (document.head || document.documentElement).appendChild(style);

  // whole-page candidates (r/whatever, twitch category pages): blank the page until we know. sorry not sorry
  const pageCandidate = !!((site && site.blockPage && site.blockPage(location, null)) || SS.sites.slugHit(location, site));
  if (pageCandidate) document.documentElement.setAttribute('data-ss-pagecheck', '');

  // video/stream pages: hold the player until we know what's playing
  const playerPage = !!(site && site.page && site.page.kind && site.page.kind(location));
  if (playerPage) document.documentElement.setAttribute('data-ss-hold', '');

  // page.css can't reach inside shadow roots, so every open shadow root we find gets this copy of the important bits
  const SHADOW_CSS = [
    "[data-ss='blocked']{isolation:isolate!important;overflow:hidden!important}",
    "[data-ss='blocked'][data-ss-pos]{position:relative!important}",
    "[data-ss='blocked'] > :not(ss-shield){filter:blur(var(--ss-blur,24px)) saturate(.5) brightness(.55)!important;pointer-events:none!important;user-select:none!important}",
    'ss-shield{all:initial!important;position:absolute!important;inset:0!important;z-index:2147483000!important;display:block!important;container-type:size!important;contain:strict!important;pointer-events:auto!important}',
  ].join('\n');

  // the badge fallback, but at document_start: marks LIVE-badge cards while the html is still streaming in, so
  // they're hidden before their first paint. the engine takes over once storage has loaded. (main.js / engine.start)
  let watch = null;
  if (site && typeof MutationObserver === 'function') {
    const known = () => (SS.sites.validSelectors(site.items.map((i) => i[0])).concat('[data-ss-card]')).join(',');
    let sel = null;
    watch = new MutationObserver((muts) => {
      if (!SS.collect) return;
      sel = sel || known();
      for (const m of muts) {
        if (m.type === 'characterData') SS.collect.findCards(m.target, sel, null);
        else for (const n of m.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) SS.collect.findCards(n, sel, null);
      }
    });
    watch.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  SS.early = {
    site,
    generic,
    style,
    stopWatch() {
      if (watch) watch.disconnect();
      watch = null;
    },
    shadowCss() {
      return style.textContent + '\n' + SHADOW_CSS;
    },
    unhide() {
      if (watch) watch.disconnect();
      watch = null;
      style.textContent = site && site.css ? site.css : ''; // hold rules go too, they only bite while data-ss-hold is set anyway
      document.documentElement.removeAttribute('data-ss-pagecheck');
      document.documentElement.removeAttribute('data-ss-hold');
    },
    rehide() {
      style.textContent = rules.join('\n');
    },
  };
})();
