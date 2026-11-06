// Threads (threads.com, the old threads.net still redirects). checked 2026-10-16: every post is a
// div[data-pressable-container]. that's it, that's the whole site
(function () {
  const SS = globalThis.NoSpoil;

  SS.sites.register({
    id: 'threads',
    name: 'Threads',
    home: 'https://www.threads.com/',
    hosts: /(^|\.)threads\.(com|net)$/,

    items: [
      ['div[data-pressable-container]', 'a post: feed, profile, replies, search'],
      ['a[href^="/search?q="]', 'trending / suggested searches'],
    ],

    channel: ['a[href^="/@"]'],
    handle(href) {
      const m = /^\/(@[^/?#]+)/.exec(href);
      return m ? decodeURIComponent(m[1]) : null;
    },

    blockPage(loc) {
      const m = /^\/(@[^/?#]+)\/?$/.exec(loc.pathname);
      if (m) return { kind: 'channel', value: decodeURIComponent(m[1]), label: 'nope, blocked account' };
      return null;
    },
  });
})();
