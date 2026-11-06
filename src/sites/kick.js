// Kick. checked 2026-10-16: tailwind classes everywhere (useless), but data-testid on the stuff we
// care about. chat is a virtual list of [data-index] rows, absolutely positioned. hiding those with
// opacity is fine, the list still measures them.
(function () {
  const SS = globalThis.SpoilerShield;

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

    items: [
      ['[data-testid="livestream-results-card"]', 'stream cards on browse + category pages'],
      ['[data-testid="media-card"]', 'video / clip cards'],
      ['[data-testid="carousel-item"]', 'front page featured carousel'],
      ['a[data-testid^="sidebar-recommended-channel-"]', 'recommended channels in the sidebar'],
      ['a[data-testid^="sidebar-following-channel-"]', 'followed channels in the sidebar'],
      ['[data-testid="chatroom-messages"] [data-index]', 'chat messages'],
      ['[data-testid="pinned-message-content"]', 'pinned chat message'],
    ],

    channel: ['a[href^="/"]:not([href^="/category/"])'],
    handle(href) {
      const m = /^\/([A-Za-z0-9_-]{2,40})(?:$|[/?#])/.exec(href);
      return m && !NOT_CHANNELS.has(m[1].toLowerCase()) ? m[1] : null;
    },
    category: ['a[href^="/category/"]'],
    live: ['[data-testid="viewer-count"]'],
    extract(el, f) {
      if (el.matches('[data-testid="livestream-results-card"]')) f.live = true; // every card on these grids is live
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
