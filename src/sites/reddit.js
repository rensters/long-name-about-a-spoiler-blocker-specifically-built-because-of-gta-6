// Reddit: new reddit ("shreddit" web components), old.reddit, and the mobile site (same components).
// new reddit is nice to us: posts carry their title/subreddit/author as attributes, so even if the
// light DOM changes we can still read who/where/what straight off the element.
(function () {
  const SS = globalThis.SpoilerShield;

  SS.sites.register({
    id: 'reddit',
    name: 'Reddit',
    home: 'https://www.reddit.com/',
    hosts: /(^|\.)reddit\.com$/,

    items: [
      // ---- new reddit / mobile web ----
      ['shreddit-post', 'a post in any feed, search, or the post page itself'],
      ['shreddit-ad-post', 'promoted posts'],
      ['shreddit-comment', 'one comment (replies are their own shreddit-comment, read separately)'],
      ['[data-testid="search-post-unit"]', 'search results: posts'],
      ['[data-testid="search-community"]', 'search results: communities'],
      ['[data-testid="search-sdui-post"]', 'search results, the server-rendered flavour'],
      ['community-highlight-card', 'pinned "community highlights" cards'],
      ['faceplate-tracker[noun="trending_topic"]', 'trending searches in the search dropdown'],
      ['li[data-testid="search-trending-item"]', 'trending searches (other layout)'],
      ['reddit-recent-pages li', 'recently visited subs in the left nav'],
      ['notification-item', 'notifications page / inbox'],
      ['[data-testid="notification-item"]', 'notifications (other layout)'],
      // ---- old.reddit ----
      ['.thing.link', 'old.reddit posts'],
      ['.thing.comment > .entry', 'old.reddit comment text only, not the whole reply chain under it'],
      ['.search-result', 'old.reddit search results'],
      ['.trending-subreddits li', 'old.reddit trending subs bar'],
    ],

    // attributes shreddit puts the good stuff in
    attrs: ['post-title', 'subreddit-prefixed-name', 'subreddit-name', 'author', 'content-href', 'domain', 'data-subreddit', 'data-author', 'data-url', 'data-domain'],
    // a comment's own text only, its replies get checked on their own
    skipText: 'shreddit-comment, shreddit-comment-tree',
    channel: ['a[href^="/user/"]', 'a.author'],
    handle(href) {
      const m = /\/u(?:ser)?\/([^/?#]+)/.exec(href);
      return m ? m[1] : null;
    },
    extract(el, f) {
      const sub = el.getAttribute('subreddit-prefixed-name') || el.getAttribute('subreddit-name') || el.getAttribute('data-subreddit');
      if (sub) f.community = sub;
      else {
        // comments + search units: the sub is on the nearest post or in a link
        const post = el.closest('shreddit-post, .thing.link');
        const link = el.querySelector('a[href^="/r/"]');
        const name = post ? post.getAttribute('subreddit-prefixed-name') || post.getAttribute('data-subreddit') : link ? link.getAttribute('href').split('/')[2] : null;
        if (name) f.community = name;
      }
      const author = el.getAttribute('author') || el.getAttribute('data-author');
      if (author) f.channels.push(author);
      return f;
    },

    // r/GTA6 & co get the full-page block screen
    blockPage(loc) {
      const m = /^\/r\/([^/?#]+)/.exec(loc.pathname);
      if (!m) return null;
      return { kind: 'community', value: decodeURIComponent(m[1]), label: 'Blocked subreddit' };
    },
  });
})();
