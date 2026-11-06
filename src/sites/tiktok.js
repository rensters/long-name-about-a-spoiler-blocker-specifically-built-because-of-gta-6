// TikTok web. data-e2e attributes are tiktok's own test hooks and they've stayed put for years,
// unlike the class names (DivItemContainer-sc-1a2b3c, lol). the For You feed autoplays, so a blurred
// video also gets paused + muted by stream.js.
(function () {
  const SS = globalThis.NoSpoil;

  SS.sites.register({
    id: 'tiktok',
    name: 'TikTok',
    home: 'https://www.tiktok.com/',
    hosts: /(^|\.)tiktok\.com$/,

    items: [
      ['[data-e2e="recommend-list-item-container"]', 'For You / Following feed videos'],
      ['[data-e2e="user-post-item"]', 'video grid on a profile'],
      ['[data-e2e="user-repost-item"]', 'reposts tab on a profile'],
      ['[data-e2e="user-liked-item"]', 'liked tab'],
      ['[data-e2e="favorites-item"]', 'favorites tab'],
      ['[data-e2e="search_top-item"]', 'search: Top results'],
      ['[data-e2e="search_video-item"]', 'search: Videos tab'],
      ['[data-e2e="search-card-container"]', 'search result cards (other layout)'],
      ['[data-e2e="search-user-container"]', 'search: Users'],
      ['[data-e2e="search-live-container"]', 'search: LIVE results'],
      ['[data-e2e="explore-item"]', 'Explore grid'],
      ['[data-e2e="live-card"]', 'LIVE cards'],
      ['[data-e2e="comment-level-1"]', 'a comment'],
      ['[data-e2e="comment-level-2"]', 'a reply'],
      ['[data-e2e="chat-message"]', 'LIVE chat message'],
      ['[data-e2e="search-suggest-item"]', 'search suggestions dropdown'],
    ],

    channel: ['[data-e2e="video-author-uniqueid"]', '[data-e2e="video-author-nickname"]', '[data-e2e="search-card-user-unique-id"]', 'a[href^="/@"]'],
    handle(href) {
      const m = /^\/(@[^/?#]+)/.exec(href);
      return m ? decodeURIComponent(m[1]) : null;
    },
    live: ['[data-e2e="live-tag"]', '[data-e2e="live-badge"]', '[data-e2e="search-live-container"]'],

    page: {
      kind(loc) {
        if (/^\/@[^/]+\/live/.test(loc.pathname)) return 'stream';
        if (/^\/@[^/]+\/(video|photo)\//.test(loc.pathname)) return 'video';
        return null;
      },
      title: ['[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', '[data-e2e="live-room-name"]', '[data-e2e="live-title"]'],
      channel: ['[data-e2e="browse-username"]', '[data-e2e="video-author-uniqueid"]', '[data-e2e="live-host-name"]'],
      channelHandle(loc) {
        const m = /^\/(@[^/?#]+)/.exec(loc.pathname);
        return m ? decodeURIComponent(m[1]) : null;
      },
      live: () => /\/live(\/|$)/.test(location.pathname),
      chat: ['[data-e2e="live-chat-room"]', '[data-e2e="chat-room"]'],
      holdCss: ['[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', '[data-e2e="live-room-name"]', 'video'],
    },

    blockPage(loc) {
      let m = /^\/tag\/([^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'text', value: '#' + decodeURIComponent(m[1]), label: 'nope, blocked hashtag' };
      m = /^\/discover\/([^/?#]+)/.exec(loc.pathname); // tiktok's SEO pages: /discover/gta-6-trailer
      if (m) return { kind: 'text', value: decodeURIComponent(m[1]).replace(/-/g, ' '), label: 'nope, blocked topic' };
      m = /^\/(@[^/?#]+)\/?$/.exec(loc.pathname);
      if (m) return { kind: 'channel', value: decodeURIComponent(m[1]), label: 'nope, blocked account' };
      return null;
    },
  });
})();
