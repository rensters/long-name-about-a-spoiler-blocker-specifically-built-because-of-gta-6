// Kick. checked 2026-10-16: tailwind classes everywhere (useless), but data-testid on the stuff we
// care about. chat is a virtual list of [data-index] rows, absolutely positioned. hiding those with
// opacity is fine, the list still measures them.
// 2026-11-19 (launch day, rip): a home page live card (avatar + LIVE ring + "3K watching" + thumbnail) sailed
// right through because NONE of these selectors matched it. so: more testids, a :has() catch-all for
// "thumbnail link + viewer count", and the engine's LIVE-badge fallback catches whatever's left. hopefully
(function () {
  const SS = globalThis.NoSpoil;

  const NOT_CHANNELS = new Set(['category', 'categories', 'browse', 'following', 'search', 'video', 'clips', 'terms-of-service',
    'privacy-policy', 'dmca-policy', 'community-guidelines', 'help', 'dashboard', 'settings', 'subscriptions', 'events', 'drops',
    'login', 'signup', 'auth', 'kick-partner-program', 'about', 'careers']);
  const NOT_GAMING = /^(just chatting|irl|music|art|asmr|talk shows? (&|and) podcasts|sports|travel|food & drink|slots|casino|pools|politics)$/i;

  const channelOf = (loc) => {
    const seg = loc.pathname.split('/').filter(Boolean);
    if (!seg.length || NOT_CHANNELS.has(seg[0].toLowerCase())) return null;
    return seg[0];
  };

  SS.sites.register({
    id: 'kick',
    name: 'Kick',
    home: 'https://kick.com/',
    hosts: /(^|\.)kick\.com$/,

    video: true,
    slugBlock: true,
    items: [
      ['[data-testid="livestream-results-card"]', 'stream cards on browse + category pages'],
      ['[data-testid="livestream-card"]', 'live cards: home, following, recommended rows'],
      ['[data-testid^="livestream-card-"]', 'live cards with an id glued on'],
      ['[data-testid="channel-card"]', 'channel cards (search, following)'],
      ['[data-testid="following-card"]', 'following page cards'],
      ['[data-testid="category-card"]', 'category tiles'],
      ['[data-testid^="search-result"]', 'search results + the search dropdown'],
      ['[data-testid="media-card"]', 'video / clip cards'],
      ['[data-testid="carousel-item"]', 'front page featured carousel', { player: true }],
      ['[data-testid="featured-livestream"]', 'front page autoplay player', { player: true }],
      ['a[data-testid^="sidebar-recommended-channel-"]', 'recommended channels in the sidebar', { quick: true }],
      ['a[data-testid^="sidebar-following-channel-"]', 'followed channels in the sidebar', { quick: true }],
      ['div:has(> a[href^="/"]:not([href^="/category/"]) img):has([data-testid="viewer-count"])', 'catch-all: thumbnail link + viewer count'],
      ['[data-testid="chatroom-messages"] [data-index]', 'chat messages', { talk: true }],
      ['[data-testid="pinned-message-content"]', 'pinned chat message', { talk: true }],
    ],
    // no hover previews on cards. a 2 second muted preview is still a spoiler, ask me how i know
    css: '[data-testid="livestream-card"] video, [data-testid^="livestream-card-"] video, [data-testid="livestream-results-card"] video, [data-testid="media-card"] video, [data-testid="channel-card"] video, [data-ss-card] video{display:none!important}',

    channel: ['a[href^="/"]:not([href^="/category/"])'],
    handle(href) {
      const m = /^\/([A-Za-z0-9_-]{2,40})(?:$|[/?#])/.exec(href);
      return m && !NOT_CHANNELS.has(m[1].toLowerCase()) ? m[1] : null;
    },
    category: ['a[href^="/category/"]', '[data-testid="category-name"]'],
    live: ['[data-testid="viewer-count"]', '[data-testid="live-badge"]'],
    extract(el, f) {
      if (el.matches('[data-testid="livestream-results-card"], [data-testid^="livestream-card"]')) f.live = true; // every card on these grids is live
      for (const t of el.querySelectorAll('[data-testid="tag"], a[href*="/tags/"]')) f.text += '\u2063' + t.textContent; // stream tags
      const href = el.getAttribute('href'); // sidebar entries are bare links with just an avatar
      if (href) {
        const h = this.handle(href);
        if (h) f.channels.push(h);
        f.live = true;
      }
      return f;
    },

    page: {
      kind(loc) {
        const seg = loc.pathname.split('/').filter(Boolean);
        if (!channelOf(loc)) return null;
        if (seg.length === 1) return 'stream';
        if (seg[1] === 'videos' || seg[1] === 'clips') return seg[2] ? 'video' : null;
        return null;
      },
      title: ['[data-testid="livestream-title"]', '#channel-content h3', '[data-testid="video-title"]'],
      channel: ['#channel-username', 'h1'],
      channelHandle: channelOf,
      category: ['#channel-content a[href^="/category/"]', 'a[href^="/category/"]'],
      live: () => !!document.querySelector('[data-testid="viewer-count"]'),
      gaming(info) {
        if (!info.categories.length) return true;
        return !info.categories.every((c) => NOT_GAMING.test(c.trim()));
      },
      chat: ['#channel-chatroom', '[data-testid="chatroom"]'],
      holdCss: ['[data-testid="livestream-title"]', '#channel-content a[href^="/category/"]', 'video'],
    },

    blockPage(loc) {
      const m = /^\/category\/([^/?#]+)/.exec(loc.pathname);
      if (!m) return null;
      return { kind: 'category', value: decodeURIComponent(m[1]).replace(/-/g, ' '), label: 'nope, blocked category' };
    },
  });
})();
