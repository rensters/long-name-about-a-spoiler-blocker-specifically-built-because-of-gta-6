// Instagram web. needs you logged in for almost everything, so these come from how the site is
// built rather than a fresh look. the useful trick: grid tiles put the whole caption in the <img alt>,
// so even tiny thumbnails on explore/profile pages carry the text we need.
(function () {
  const SS = globalThis.NoSpoil;

  const NOT_USERS = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'direct', 'accounts', 'about', 'legal', 'tv', 'web']);

  SS.sites.register({
    id: 'instagram',
    name: 'Instagram',
    home: 'https://www.instagram.com/',
    hosts: /(^|\.)instagram\.com$/,

    items: [
      ['article', 'feed posts + the post view (caption and comments included)'],
      ['a[href*="/p/"]:not(article a)', 'grid tiles on profiles / explore / hashtags (caption lives in the img alt)'],
      ['a[href*="/reel/"]:not(article a)', 'reel tiles'],
      // comments aren't separate items: the caption is rendered as a fake first comment and splitting
      // them apart blurs half a post. the post (article) covers its comments instead
      ['a[href^="/explore/tags/"]:not(article a)', 'hashtag suggestions in search'],
    ],

    channel: ['header a[href^="/"]', 'a[role="link"][href^="/"]:not([href*="/p/"]):not([href*="/reel/"])'],
    handle(href) {
      const m = /^\/([A-Za-z0-9._]{1,30})\/?$/.exec(href);
      return m && !NOT_USERS.has(m[1].toLowerCase()) ? '@' + m[1] : null;
    },
    live: ['[aria-label="LIVE"]', '[aria-label="Live"]'],

    page: {
      kind(loc) {
        return /^\/[^/]+\/live\/?$/.test(loc.pathname) ? 'stream' : null;
      },
      title: ['h1', 'header h2'],
      channel: ['header a[href^="/"]'],
      live: () => true,
    },

    blockPage(loc) {
      let m = /^\/explore\/tags\/([^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'text', value: '#' + decodeURIComponent(m[1]), label: 'nope, blocked hashtag' };
      m = /^\/([A-Za-z0-9._]{1,30})\/?$/.exec(loc.pathname);
      if (m && !NOT_USERS.has(m[1].toLowerCase())) return { kind: 'channel', value: '@' + m[1], label: 'nope, blocked account' };
      return null;
    },
  });
})();
