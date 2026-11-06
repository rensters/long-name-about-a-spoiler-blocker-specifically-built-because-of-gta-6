// hey, why are you looking at this? it's just browser vs chrome. firefox + safari give us `browser` (promises),
// chromium gives us `chrome` (also promises in MV3, mostly, when it feels like it). grab whichever exists, move on with life.
// every file hangs its stuff off one global: NoSpoil. no bundler, no modules, no tears.
(function (root) {
  const SS = (root.NoSpoil = root.NoSpoil || {});

  const pick = () => {
    if (root.browser && root.browser.runtime && root.browser.runtime.id) return root.browser;
    if (root.chrome && root.chrome.runtime && root.chrome.runtime.id) return root.chrome;
    return null; // node tests, or the extension got reloaded under us and this old script is a ghost now. spooky
  };

  SS.api = pick();

  // sendMessage that never throws. chrome rejects with "Receiving end does not exist" when nobody's
  // listening and i REFUSE to wrap that in try/catch in 40 places. no
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
  // orphaned scripts can't touch storage anymore, so they should just shut up and die. harsh but fair
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
