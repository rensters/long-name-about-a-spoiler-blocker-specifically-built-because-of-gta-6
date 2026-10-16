// Bing (web, news, videos). checked 2026-10-16. bing hasn't really changed its markup since forever,
// li.b_algo is older than some of the people reading this
(function () {
  const SS = globalThis.SpoilerShield;

  SS.sites.register({
    id: 'bing',
    name: 'Bing',
    home: 'https://www.bing.com/',
    hosts: /(^|\.)bing\.com$/,

    items: [
      ['#b_results > li.b_algo', 'web results'],
      ['#b_results > li.b_ans', 'answer blocks: videos, news, image carousels'],
      ['#b_context > li', 'right sidebar panels'],
      ['.news-card:not(#b_results .news-card)', 'bing news cards'],
      ['.mc_vtvc:not(#b_results .mc_vtvc)', 'bing videos tiles'],
      ['.dg_u', 'bing images tiles'],
      ['.b_topStories li', 'top stories strip'],
    ],
  });
})();
