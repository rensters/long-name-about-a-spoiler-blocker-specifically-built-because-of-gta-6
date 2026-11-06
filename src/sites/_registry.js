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
// }
(function (root) {
  const SS = (root.SpoilerShield = root.SpoilerShield || {});
  const list = [];

  function register(def) {
    if (!def || !def.id) return;
    def.items = def.items || [];
    list.push(def);
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

  SS.sites = { register, pick, byId, list, validSelectors };
  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
