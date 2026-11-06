// X / Twitter (x.com, twitter.com, mobile web is the same app). yes i still call it twitter.
// X's timeline is a virtual list: posts get deleted and re-created as you scroll. we hide the inner
// <article>, never the cell wrapper, because the list measures the wrappers to know where to put
// things and an invisible-but-same-size article doesn't upset it.
(function () {
  const SS = globalThis.SpoilerShield;

  SS.sites.register({
    id: 'x',
    name: 'X / Twitter',
    home: 'https://x.com/home',
    hosts: /(^|\.)(x|twitter)\.com$/,

    items: [
      ['article[data-testid="tweet"]', 'a post anywhere: timeline, replies, quotes, search, profiles, lists'],
      ['[data-testid="trend"]', 'trending topics (sidebar "What\'s happening" + Explore tabs)'],
      ['[data-testid="UserCell"]', 'who-to-follow + people in search results'],
      ['[data-testid="TypeaheadUser"]', 'people in the search dropdown'],
      ['[data-testid="typeaheadResult"]', 'search dropdown suggestions'],
      ['[data-testid="typeaheadRecentSearchesItem"]', 'recent searches in the dropdown'],
      ['[data-testid="notification"]', 'notifications'],
      ['[data-testid="eventHero"]', 'the big Explore event card'],
      ['[data-testid="trendingEvent"]', 'trending event cards'],
      ['[data-testid="placementTracking"] article', 'promoted posts'],
      ['[data-testid="conversation"]', 'DM list previews'],
    ],

    channel: ['[data-testid="User-Name"] a[href^="/"]', '[data-testid="UserCell"] a[href^="/"]'],
    handle(href) {
      const m = /^\/([A-Za-z0-9_]{1,15})(?:$|[/?#])/.exec(href);
      if (!m || ['home', 'explore', 'search', 'i', 'notifications', 'messages', 'settings', 'hashtag'].includes(m[1].toLowerCase())) return null;
      return '@' + m[1];
    },
    live: ['[data-testid="liveBadge"]', '[aria-label="LIVE"]', '[data-testid="broadcastLiveBadge"]'],

    page: {
      kind(loc) {
        return /^\/i\/broadcasts\//.test(loc.pathname) ? 'stream' : null;
      },
      title: ['[data-testid="broadcastTitle"]', '[data-testid="videoPlayer"] [dir="auto"]', 'h1[role="heading"]'],
      channel: ['[data-testid="User-Name"] a[href^="/"]'],
      live: () => !!document.querySelector('[data-testid="liveBadge"], [aria-label="LIVE"]'),
      chat: ['[data-testid="broadcastChat"]', '[aria-label="Chat"]'],
    },

    blockPage(loc) {
      const m = /^\/hashtag\/([^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'text', value: '#' + decodeURIComponent(m[1]), label: 'Blocked hashtag' };
      return null;
    },
  });
})();
