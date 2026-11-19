// hey, this is the phone book. every site file calls SS.sites.register({...}) and ends up here.
//
// a site definition looks like this (only id/name/hosts are required):
// {
//   id: 'youtube', name: 'YouTube',
//   hosts: /(^|\.)youtube\.com$/,            hostnames this module owns
//   frames: false,                            true = also run inside iframes on these hosts (chat frames)
//   items: [[selector, 'what it is'], ...],   cards that get hidden at document_start until checked
//   channel: [selectors],                     inside an item: where the channel/author name lives
//   category: [selectors],                    inside an item: game/category label
//   live: [selectors],                        inside an item: anything here = it's a live stream
//   attrs: ['post-title', ...],               extra attributes on the item worth reading
//   skipText: 'selector',                     subtrees NOT to read (e.g. comments inside a post)
//   extract(el, fields) -> fields,            last-chance hook to fix up what we pulled out
//   handle(href) -> 'name' | null,            channel handle from a link href
//   page: { ... },                            player/stream pages, see youtube.js
//   blockPage(loc, ctx) -> {kind, value} | null   whole-page blocks (subreddits, category directories)
//   css: '...',                               extra css for this site (e.g. kill hover previews)
//   video: true,                              cards here are videos/streams (launch-week bare "gta" rule applies)
//   slugBlock: true,                          block any page whose url slug says gta-6 / gta-vi / grand-theft-auto-vi
// }
// items can have a 3rd thing: { talk: true } chat/comments (not video titles), { quick: true } don't wait for
// a title to load (sidebar avatars), { player: true } has an autoplay player in it
(function (root) {
  const SS = (root.NoSpoil = root.NoSpoil || {});
  const list = [];

  function register(def) {
    if (!def || !def.id) return;
    def.items = def.items || [];
    const flagged = (k) => def.items.filter((i) => i[2] && i[2][k]).map((i) => i[0]);
    def.talkSel = flagged('talk').join(',');
    def.quickSel = flagged('quick').join(',');
    list.push(def);
  }

  // "gta-6", "gta_vi", "gta6", "grand-theft-auto-vi" sitting in a url path as its own slug piece
  const SLUG_RE = /(?:^|[/_.-])(gta[-_]?(?:6|vi|six)|grand[-_]theft[-_]auto[-_]?(?:6|vi))(?=[/_.-]|$)/i;
  const SLUG_ALL = new RegExp(SLUG_RE.source, 'gi');
  const GUIDEISH = /guide|wiki|walkthrough|fandom|wikia|mission|troph|collectible|cheat|\bmaps?\b/i;
  const pathOf = (loc) => {
    try {
      return decodeURIComponent(loc.pathname || '');
    } catch (e) {
      return loc.pathname || '';
    }
  };
  // whole-page block by url alone: kick/twitch (slugBlock) for any gta-6 slug, everyone else only for guide/wiki pages
  function slugHit(loc, site) {
    if (!loc || !loc.pathname) return null;
    const path = pathOf(loc);
    const m = SLUG_RE.exec(path);
    if (!m) return null;
    if ((site && site.slugBlock) || GUIDEISH.test(loc.hostname + path)) return m[1].replace(/[-_]/g, ' ');
    return null;
  }
  // slugs inside some url (thumbnail src, link href) as plain words. "/gta-6-day-1.jpg" -> "gta 6"
  function slugWords(url) {
    if (!url || typeof url !== 'string') return [];
    let u = url;
    try {
      u = decodeURIComponent(url);
    } catch (e) {
      /* whatever */
    }
    u = u.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
    const out = [];
    let m;
    SLUG_ALL.lastIndex = 0;
    while ((m = SLUG_ALL.exec(u)) && out.length < 4) out.push(m[1].replace(/[-_]/g, ' '));
    return out;
  }

  function pick(loc) {
    const host = (loc || location).hostname;
    return list.find((s) => s.id !== 'generic' && s.hosts && s.hosts.test(host)) || null;
  }

  function byId(id) {
    return list.find((s) => s.id === id) || null;
  }

  // drop selectors this browser can't parse. one bad :has() nukes a whole selector list, ask me how i know
  function validSelectors(sels) {
    const frag = typeof document !== 'undefined' ? document.createDocumentFragment() : null;
    return (sels || []).filter((s) => {
      if (!frag) return true;
      try {
        frag.querySelector(s);
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  SS.sites = { register, pick, byId, list, validSelectors, slugHit, slugWords };
  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
