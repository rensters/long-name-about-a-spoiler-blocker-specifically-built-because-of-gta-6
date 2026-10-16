// Facebook. obfuscated class names that change weekly, so we only lean on ARIA stuff, which they
// can't easily rename without breaking screen readers: role="article", aria-posinset, aria-labels.
// comments are role="article" too, with an aria-label starting "Comment by ...".
(function () {
  const SS = globalThis.SpoilerShield;

  SS.sites.register({
    id: 'facebook',
    name: 'Facebook',
    home: 'https://www.facebook.com/',
    hosts: /(^|\.)facebook\.com$/,

    items: [
      ['div[aria-posinset]', 'main news feed posts (each one carries its position in the feed)'],
      ['div[role="article"][aria-label*="omment"]', 'comments + replies ("Comment by X", "Reply by Y")'],
      ['div[role="article"]:not([aria-label*="omment"]):not([aria-posinset] div[role="article"])', 'posts in groups, pages, search, watch'],
      ['[data-pagelet="Stories"] [role="link"]', 'story tiles at the top of the feed'],
      ['div[role="row"]:has(a[href*="/watch/"])', 'watch / gaming video rows'],
    ],

    channel: ['h2 a[href]', 'h3 a[href]', 'strong a[href]'],
    live: ['[aria-label="Live"]', '[aria-label="LIVE"]', '[aria-label="Live video"]'],

    page: {
      kind(loc) {
        if (/^\/(watch\/live|gaming\/[^/]+\/live)/.test(loc.pathname)) return 'stream';
        if (/\/videos\/\d+/.test(loc.pathname) || /^\/watch/.test(loc.pathname)) return 'video';
        return null;
      },
      title: ['div[role="main"] h2 span[dir="auto"]', 'div[role="dialog"] h2 span[dir="auto"]', 'div[role="main"] span[dir="auto"]'],
      channel: ['div[role="main"] h2 a[href]', 'div[role="main"] strong a[href]'],
      live: () => !!document.querySelector('div[role="main"] [aria-label="Live"], div[role="main"] [aria-label="LIVE"]'),
      chat: ['div[role="complementary"] [aria-label*="omment"]'],
    },

    blockPage(loc) {
      let m = /^\/hashtag\/([^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'text', value: '#' + decodeURIComponent(m[1]), label: 'Blocked hashtag' };
      m = /^\/gaming\/([^/?#]+)/.exec(loc.pathname);
      if (m && m[1] !== 'feed') return { kind: 'channel', value: decodeURIComponent(m[1]), label: 'Blocked gaming page' };
      return null;
    },
  });
})();
