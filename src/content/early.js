// hey, you found the speedrun file. runs at document_start, the page is basically an empty <html> rn.
// job #1: get the "hide every card until we've looked at it" css in before the site paints ANYTHING. storage
// is async so we don't even know if the extension is on yet. hide first, ask questions later
// (main.js un-hides everything if it turns out we're off).
(function () {
  const SS = globalThis.SpoilerShield;
  if (!SS || SS.early) return; // double injection guard (popout chat windows etc)

  const site = SS.sites.pick(location) || null;
  const generic = SS.sites.byId('generic');

  const style = document.createElement('style');
  style.id = 'ss-early';
  const rules = [];
  if (site) {
    // one rule per selector: if a browser chokes on one selector it only loses that one
    for (const [sel] of site.items) rules.push(`${sel}:not([data-ss]){opacity:0!important;pointer-events:none!important}`);
    // while a video/stream page is being checked, its title + player area stay invisible too.
    // otherwise you'd read "GTA 6 whatever" in the title for 30ms before the warning lands
    for (const sel of (site.page && site.page.holdCss) || []) rules.push(`html[data-ss-hold] ${sel}{visibility:hidden!important}`);
    if (site.css) rules.push(site.css);
  }
  style.textContent = rules.join('\n');
  (document.head || document.documentElement).appendChild(style);

  // whole-page candidates (r/whatever, twitch category pages): blank the page until we know
  const pageCandidate = !!(site && site.blockPage && site.blockPage(location, null));
  if (pageCandidate) document.documentElement.setAttribute('data-ss-pagecheck', '');

  // video/stream pages: hold the player until we know what's playing
  const playerPage = !!(site && site.page && site.page.kind && site.page.kind(location));
  if (playerPage) document.documentElement.setAttribute('data-ss-hold', '');

  SS.early = {
    site,
    generic,
    style,
    unhide() {
      style.textContent = site && site.css ? site.css : ''; // hold rules go too, they only bite while data-ss-hold is set anyway
      document.documentElement.removeAttribute('data-ss-pagecheck');
      document.documentElement.removeAttribute('data-ss-hold');
    },
    rehide() {
      style.textContent = rules.join('\n');
    },
  };
})();
