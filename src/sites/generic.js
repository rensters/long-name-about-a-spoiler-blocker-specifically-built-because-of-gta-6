// hey, this is every other site on the internet. no selectors: the engine looks at paragraphs, list items,
// headings, table cells, figures and image alt text, and blurs any that contain a STRONG term.
// weak combos are off here on purpose: random blogs mention "Jason" and "trailer" in the same
// paragraph all the time and that's not our business.
// heads up: there's no hide-before-check here (we don't know what a "card" is on a random site),
// so on slow pages a headline could show for a frame before it gets blurred. supported sites never do.
(function () {
  const SS = globalThis.SpoilerShield;
  SS.sites.register({ id: 'generic', name: 'Other sites (generic)', hosts: null, items: [] });
})();
