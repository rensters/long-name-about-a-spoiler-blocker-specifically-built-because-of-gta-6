// Google Search + Google News (+ the Discover-ish stuff that shows up on google.com mobile web).
// checked 2026-10-16: every result block is a direct child of #rso. web results are .MjjYud, the
// carousels (Videos, Top stories, Short videos, People also ask, AI Overview) are .ULSxyf and friends.
// we blur at block level: if one video in the carousel is GTA VI, the carousel goes. tough love.
(function () {
  const SS = globalThis.SpoilerShield;

  SS.sites.register({
    id: 'google',
    name: 'Google Search / News',
    home: 'https://www.google.com/',
    hosts: /^(www\.|news\.)?google\.[a-z.]{2,6}$/,

    items: [
      ['#rso > div', 'every result block: web results, videos, top stories, short videos, AI overview, people also ask'],
      ['#rhs', 'the knowledge panel on the right'],
      ['#botstuff [data-hveid]', 'related searches / "people also search for" at the bottom'],
      ['#taw [data-text-ad]', 'top ads'],
      ['div[data-ri]', 'image search tiles'],
      ['g-inner-card:not(#rso g-inner-card)', 'cards outside the main column (mobile layouts)'],
      // news.google.com
      ['c-wiz article', 'Google News stories'],
      ['article:not(c-wiz article)', 'Google News stories (other layout)'],
    ],
  });
})();
