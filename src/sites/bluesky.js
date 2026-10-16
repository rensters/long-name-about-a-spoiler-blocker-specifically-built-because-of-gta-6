// Bluesky (bsky.app). checked 2026-10-16. react-native-web, so class names are garbage but data-testid
// is everywhere, and bless them, the post testid literally contains the author's handle:
// data-testid="feedItem-by-bsky.app"
(function () {
  const SS = globalThis.SpoilerShield;

  SS.sites.register({
    id: 'bluesky',
    name: 'Bluesky',
    home: 'https://bsky.app/',
    hosts: /(^|\.)bsky\.app$/,

    items: [
      ['[data-testid^="feedItem-by-"]', 'posts in feeds, profiles, search, notifications'],
      ['[data-testid^="postThreadItem-by-"]', 'posts in a thread view'],
      ['[data-testid="trendingTopicItem"]', 'trending topics'],
      ['a[href^="/search?q="]', 'trending / suggested searches'],
    ],

    channel: ['a[href^="/profile/"]'],
    handle(href) {
      const m = /^\/profile\/([^/?#]+)/.exec(href);
      return m ? '@' + decodeURIComponent(m[1]) : null;
    },
    extract(el, f) {
      const m = /-by-(.+)$/.exec(el.getAttribute('data-testid') || '');
      if (m) f.channels.push('@' + m[1]);
      return f;
    },

    blockPage(loc) {
      let m = /^\/hashtag\/([^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'text', value: '#' + decodeURIComponent(m[1]), label: 'Blocked hashtag' };
      m = /^\/profile\/([^/?#]+)\/?$/.exec(loc.pathname);
      if (m) return { kind: 'channel', value: '@' + decodeURIComponent(m[1]), label: 'Blocked account' };
      return null;
    },
  });
})();
