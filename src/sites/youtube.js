// YouTube, desktop + m.youtube.com + the live chat iframe. hey, if something slipped through, you're in the right place.
// checked against the real site on 2026-10-16. youtube renames its components roughly every time
// someone at google gets bored, so if something slips through, this is the file. look at the card in
// devtools, find its tag name, add it to `items`. that's usually the whole fix.
(function () {
  const SS = globalThis.SpoilerShield;

  // "LIVE" / "watching" in a few languages, for when youtube only gives us text
  const LIVE_WORDS = /\b(watching( now)?|started streaming|live now|premieres?( in)?|waiting|scheduled for|assistindo|viendo|zuschauer|regardent|spettatori|смотрят)\b/i;

  SS.sites.register({
    id: 'youtube',
    name: 'YouTube',
    home: 'https://www.youtube.com/',
    hosts: /^(www\.|m\.)?youtube\.com$/, // not music.youtube.com, that's a whole different beast and i'm not going there
    frames: true, // the live chat lives in an iframe at /live_chat
    onNavigateEvent: 'yt-navigate-finish', // youtube's own "i finished a SPA navigation" event

    items: [
      // ---- feeds ----
      ['ytd-rich-item-renderer', 'home / subscriptions / channel grid cards'],
      ['yt-lockup-view-model:not(ytd-rich-item-renderer yt-lockup-view-model)', 'the 2025+ card style: watch page sidebar, some search + home rows'],
      ['ytd-video-renderer', 'search results'],
      ['ytd-compact-video-renderer', 'old watch-page sidebar cards (still shows up in some A/B tests)'],
      ['ytd-grid-video-renderer', 'old channel page grids'],
      ['ytd-playlist-renderer', 'playlists in search'],
      ['ytd-radio-renderer', 'mixes in search'],
      ['ytd-channel-renderer', 'channels in search results'],
      ['ytd-universal-watch-card-renderer', 'the big search "watch card" for shows/games'],
      ['ytd-movie-renderer', 'movies in search'],
      ['ytd-promoted-sparkles-web-renderer', 'search ads, yes rockstar will buy these'],
      // ---- shorts ----
      ['ytd-reel-item-renderer', 'shorts shelf items (old)'],
      ['ytm-shorts-lockup-view-model:not(ytd-rich-item-renderer ytm-shorts-lockup-view-model)', 'shorts shelf items (new)'],
      ['ytm-shorts-lockup-view-model-v2:not(ytd-rich-item-renderer ytm-shorts-lockup-view-model-v2)', 'shorts shelf items (newer, they made a v2 lmao)'],
      ['ytd-reel-video-renderer', 'the shorts player, one per short'],
      // ---- watch page ----
      ['ytd-playlist-panel-video-renderer', 'playlist panel next to the video'],
      ['ytd-rich-metadata-renderer', 'the game chip under a video ("Grand Theft Auto VI · Browse game")'],
      ['.ytp-videowall-still', 'end screen video wall'],
      ['.ytp-ce-element', 'end screen cards on top of the video'],
      ['.ytp-autonav-endscreen-upnext-container', 'autoplay "up next" overlay'],
      ['.ytp-modern-videowall-still', 'end screen wall, the redesigned one'],
      // ---- comments, posts, notifications ----
      ['ytd-comment-view-model', 'one comment or reply (new)'],
      ['ytd-comment-renderer', 'one comment or reply (old)'],
      ['ytd-backstage-post-thread-renderer', 'community posts'],
      ['ytd-post-renderer:not(ytd-backstage-post-thread-renderer ytd-post-renderer):not(ytd-rich-item-renderer ytd-post-renderer)', 'community posts dropped into feeds'],
      ['ytd-notification-renderer', 'bell dropdown notifications'],
      ['yt-notification-view-model', 'bell dropdown notifications (new)'],
      // ---- live chat (inside the /live_chat iframe) ----
      ['yt-live-chat-text-message-renderer', 'chat message'],
      ['yt-live-chat-paid-message-renderer', 'superchat'],
      ['yt-live-chat-paid-sticker-renderer', 'super sticker'],
      ['yt-live-chat-membership-item-renderer', 'membership message'],
      ['yt-live-chat-banner-renderer', 'pinned message banner'],
      // ---- m.youtube.com ----
      ['ytm-rich-item-renderer', 'mobile home cards'],
      ['ytm-video-with-context-renderer:not(ytm-rich-item-renderer ytm-video-with-context-renderer)', 'mobile search / feed cards'],
      ['ytm-compact-video-renderer', 'mobile related videos'],
      ['ytm-media-item:not(ytm-rich-item-renderer ytm-media-item)', 'mobile feed cards (newer)'],
      ['ytm-reel-item-renderer', 'mobile shorts shelf'],
      ['ytm-comment-renderer', 'mobile comments'],
      ['ytm-backstage-post-thread-renderer', 'mobile community posts'],
      ['ytm-compact-playlist-renderer', 'mobile playlists'],
    ],

    // channel name inside a card
    channel: [
      'ytd-channel-name a', // classic cards
      '#channel-name a',
      'a[href^="/@"]', // anything linking to a channel handle
      '#author-name', // live chat + comments
      '#author-text', // old comments
      '.ytm-badge-and-byline-item-byline', // mobile byline
    ],
    handle(href) {
      const m = /^\/(@[^/?#]+)|^\/(?:c|user)\/([^/?#]+)|^\/channel\/([^/?#]+)/.exec(href);
      if (!m) return null;
      return decodeURIComponent(m[1] || m[2] || m[3]);
    },
    live: [
      'badge-shape[class*="ThumbnailLive"]', // 2025+ cards: the red LIVE thumbnail badge
      '.ytBadgeShapeThumbnailLive',
      '.badge-style-type-live-now-alternate', // classic cards
      '.badge-style-type-live-now',
      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"]',
      '[aria-label="LIVE"]',
      'badge-shape[class*="ThumbnailUpcoming"]', // premieres / scheduled streams
      '.badge-style-type-premiere',
    ],
    extract(el, f) {
      // new cards have no channel link, just an avatar labelled "Go to channel X"
      for (const n of el.querySelectorAll('[aria-label^="Go to channel"]')) {
        f.channels.push(n.getAttribute('aria-label').replace(/^Go to channel\s*/, ''));
      }
      const firstMeta = el.querySelector('yt-content-metadata-view-model [class*="MetadataText"], yt-content-metadata-view-model [class*="metadata-text"]');
      if (firstMeta) f.channels.push(firstMeta.textContent.trim());
      // "1.5K watching" = live, badge or no badge. premieres count as live too, same spoiler risk
      if (!f.live && /\b(watching|premieres?|waiting)\b/i.test(f.text)) f.live = true;
      return f;
    },

    page: {
      kind(loc) {
        if (!/^(www\.|m\.)?youtube\.com$/.test(loc.hostname)) return null;
        if (loc.pathname === '/watch' || loc.pathname.startsWith('/live/')) return 'video';
        return null; // shorts get the card treatment. a full-screen wall per swipe would be actually insane
      },
      title: [
        'ytd-watch-metadata h1 yt-formatted-string',
        'ytd-watch-metadata #title h1',
        '#above-the-fold #title h1',
        'h1.ytd-watch-metadata',
        '.slim-video-information-title', // m.youtube
        'ytm-slim-video-metadata-section-renderer h2',
      ],
      channel: [
        'ytd-watch-metadata #owner ytd-channel-name a',
        'ytd-video-owner-renderer #channel-name a',
        '#owner #channel-name a',
        'ytm-slim-owner-renderer a', // m.youtube
        '.slim-owner-channel-name',
      ],
      category: [
        'ytd-rich-metadata-renderer #title', // game chip
        'ytd-video-description-gaming-section-renderer #title',
        'ytm-video-description-gaming-section-renderer .ytm-rich-metadata-renderer-title',
      ],
      live() {
        const info = document.querySelector('ytd-watch-metadata #info, ytd-watch-info-text, .slim-video-metadata-header');
        if (info && LIVE_WORDS.test(info.textContent || '')) return true;
        if (document.querySelector('#movie_player.ytp-live')) return true;
        const wf = document.querySelector('ytd-watch-flexy');
        if (wf && (wf.hasAttribute('should-stamp-chat') || wf.hasAttribute('live-chat-present-and-expanded'))) {
          const src = (document.querySelector('#chatframe') || {}).src || '';
          if (!/live_chat_replay/.test(src)) return true;
        }
        return false;
      },
      extraText() {
        // the description often says the game even when the title doesn't. first 1500 chars is plenty
        const d = document.querySelector('ytd-watch-metadata #description-inline-expander, ytd-watch-metadata #description, ytm-expandable-video-description-body-renderer');
        return d ? (d.textContent || '').slice(0, 1500) : '';
      },
      gaming(info) {
        if (info.categories.length) return true;
        const genre = document.querySelector('meta[itemprop="genre"]');
        return !!(genre && /gaming/i.test(genre.getAttribute('content') || ''));
      },
      chat: ['ytd-live-chat-frame#chat', 'ytd-live-chat-frame'],
      // invisible while we're still deciding (title, description, player, chat)
      holdCss: ['ytd-watch-metadata', '#movie_player', 'ytd-live-chat-frame', '.slim-video-metadata-header', 'ytm-slim-video-metadata-section-renderer', '#player-container-id'],
    },

    blockPage(loc) {
      if (!/^(www\.|m\.)?youtube\.com$/.test(loc.hostname)) return null;
      let m = /^\/hashtag\/([^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'text', value: '#' + decodeURIComponent(m[1]), label: 'Blocked hashtag' };
      m = /^\/(@[^/?#]+)/.exec(loc.pathname);
      if (m) return { kind: 'channel', value: decodeURIComponent(m[1]), label: 'Blocked channel' };
      return null;
    },

    // the inline hover preview is ONE floating player for the whole page. the overlay already eats the
    // hover, but if youtube triggers it anyway (it will), nuke it while the mouse is on any blurred card
    css: 'html[data-ss-hover] ytd-video-preview, html[data-ss-hover] #video-preview{display:none!important}',
  });
})();
