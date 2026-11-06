// Twitch. checked against the real site 2026-10-16: data-a-target attributes are still the stable
// handles, class names are styled-components soup (Layout-sc-1xcs6mc-0), never trust those.
// streams IN the GTA VI category stay blurred even if the title is "chill vibes :)" because the
// category is on the card. category directory pages get the full block screen.
(function () {
  const SS = globalThis.NoSpoil;

  // twitch top-level paths that aren't channels
  const NOT_CHANNELS = new Set(['directory', 'videos', 'settings', 'p', 'search', 'downloads', 'jobs', 'turbo', 'prime',
    'subscriptions', 'wallet', 'drops', 'inventory', 'friends', 'messages', 'following', 'moderator', 'u', 'payments',
    'store', 'bits', 'login', 'signup', 'broadcast', 'privacy', 'legal', 'team', 'collections', 'clip', 'embed', 'activate']);

  // categories that aren't games, for strict-streams mode
  const NOT_GAMING = /^(just chatting|irl|music|art|asmr|talk shows & podcasts|sports|travel & outdoors|food & drink|science & technology|software and game development|makers & crafting|pools, hot tubs, and beaches|special events|politics|fitness & health|beauty & body art|animals, aquariums, and zoos|watch parties|co-working & studying|dj)$/i;

  const channelOf = (loc) => {
    const seg = loc.pathname.split('/').filter(Boolean);
    if (!seg.length || NOT_CHANNELS.has(seg[0].toLowerCase())) return null;
    return seg[0];
  };

  SS.sites.register({
    id: 'twitch',
    name: 'Twitch',
    home: 'https://www.twitch.tv/',
    hosts: /(^|\.)twitch\.tv$/,

    items: [
      ['article:has([data-a-target="preview-card-image-link"])', 'stream / VOD / clip cards: browse, directories, search, following, front page'],
      ['.side-nav-card', 'left sidebar channels (shows the game under the name)'],
      ['.game-card', 'category cards on the browse page'],
      ['[data-a-target="search-result-live-channel"]', 'search results: live channels'],
      ['[data-a-target="search-result-category"]', 'search results: categories'],
      ['.search-tray [role="option"]', 'search dropdown suggestions'],
      ['.chat-line__message', 'chat message'],
      ['.vod-message', 'chat replay on VODs'],
      ['[data-a-target="chat-line-message"]:not(.chat-line__message)', 'chat message (fallback)'],
    ],

    channel: ['[data-a-target="preview-card-channel-link"]', 'p[title]', '[data-a-target="side-nav-title"]', '[data-a-target="side-nav-card-metadata"] p[title]'],
    handle(href) {
      const m = /^\/([A-Za-z0-9_]{2,25})(?:$|[/?#])/.exec(href);
      return m && !NOT_CHANNELS.has(m[1].toLowerCase()) ? m[1] : null;
    },
    category: ['[data-a-target="preview-card-game-link"]', '[data-a-target="side-nav-game-title"]', 'a[href^="/directory/category/"]', 'a[href^="/directory/game/"]'],
    live: ['.tw-channel-status-text', '.tw-channel-status-text-indicator', '[data-a-target="side-nav-live-status"]', '.tw-channel-status-indicator'],

    page: {
      kind(loc) {
        const seg = loc.pathname.split('/').filter(Boolean);
        if (seg[0] === 'videos' && seg[1]) return 'video';
        if (!channelOf(loc)) return null;
        if (seg[1] === 'clip' || seg[1] === 'v') return 'video';
        if (seg.length === 1) return 'stream';
        return null; // /<channel>/videos, /about etc: just pages with cards
      },
      title: ['[data-a-target="stream-title"]', 'h2[data-a-target="stream-title"]', '[data-a-target="video-info-title"]', '[data-a-target="clips-title"]'],
      channel: ['.channel-info-content h1', 'h1.tw-title', 'h1'],
      channelHandle: channelOf,
      category: ['[data-a-target="stream-game-link"]', '[data-a-target="video-info-game-boxart-link"]', '[data-a-target="video-info-game-link"]'],
      live: () => !!document.querySelector('[data-a-target="animated-channel-viewers-count"]'),
      extraText() {
        // stream tags: "GTA6RP" etc
        return Array.from(document.querySelectorAll('.channel-info-content a[href*="/tags/"], [data-a-target="stream-info-card-component"] a[href*="/tags/"]'))
          .map((a) => a.textContent)
          .join(' ');
      },
      gaming(info) {
        if (!info.categories.length) return true; // no category visible? assume the worst. always assume the worst
        return !info.categories.every((c) => NOT_GAMING.test(c.trim()));
      },
      chat: ['.stream-chat', '.chat-shell', 'section[data-test-selector="chat-room-component-layout"]', '.chat-room'],
      holdCss: ['.channel-info-content', '[data-a-target="stream-title"]', '[data-a-target="stream-game-link"]', 'video', '.video-player'],
    },

    blockPage(loc) {
      const m = /^\/directory\/(?:category|game)\/([^/?#]+)/.exec(loc.pathname);
      if (!m) return null;
      return { kind: 'category', value: decodeURIComponent(m[1]).replace(/-/g, ' '), label: 'nope, blocked category' };
    },
  });
})();
