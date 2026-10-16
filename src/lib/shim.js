// browser vs chrome. firefox + safari give us `browser` (promises), chromium gives us `chrome`
// (also promises in MV3, mostly, when it feels like it). we grab whichever exists and move on with our lives.
// every file hangs its stuff off one global: SpoilerShield. no bundler, no modules, no tears.
(function (root) {
  const SS = (root.SpoilerShield = root.SpoilerShield || {});

  const pick = () => {
    if (root.browser && root.browser.runtime && root.browser.runtime.id) return root.browser;
    if (root.chrome && root.chrome.runtime && root.chrome.runtime.id) return root.chrome;
    return null; // node tests, or the extension got reloaded under us and the old script is a ghost now
  };

  SS.api = pick();

  // sendMessage that never throws. chrome rejects with "Receiving end does not exist" when nobody's
  // listening and i refuse to wrap that in try/catch in 40 places
  SS.send = async (msg) => {
    const api = SS.api || pick();
    if (!api) return undefined;
    try {
      return await api.runtime.sendMessage(msg);
    } catch (e) {
      return undefined;
    }
  };

  // true once the extension got reloaded/updated and this content script is orphaned.
  // orphaned scripts can't touch storage anymore, so they should just shut up and die
  SS.dead = () => {
    try {
      const api = SS.api;
      return !api || !api.runtime || !api.runtime.id;
    } catch (e) {
      return true;
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
