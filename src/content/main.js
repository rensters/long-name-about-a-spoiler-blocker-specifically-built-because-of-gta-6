// boot. everything above this file just defined stuff; this one actually turns it on.
// order of events on a page load:
//   1. early.js already hid all the cards (we're at document_start, before anything paints)
//   2. load settings + packs from storage (async, a few ms)
//   3. off/paused/site disabled? un-hide everything and go home. otherwise start the engine
(function () {
  const SS = globalThis.SpoilerShield;
  if (!SS || !SS.early || SS.booted) return;
  SS.booted = true;

  const early = SS.early;
  const site = early.site;
  const host = location.hostname;
  const topFrame = window.top === window;

  // stream/video pages: no picture, no sound from the very first frame until we know what it is
  if (site && site.page && site.page.kind && site.page.kind(location)) SS.stream.hold();

  // whatever happens (storage dead, exception, cosmic ray), never leave a page blank
  const failsafe = setTimeout(() => document.documentElement.removeAttribute('data-ss-pagecheck'), 2500);

  const engine = new SS.Engine(site);
  SS.engine = engine;
  let pauseTimer = null;

  const siteEnabled = (s) => (site ? s.sites[site.id] !== false : s.sites.generic !== false);

  function off() {
    engine.stop();
    early.unhide();
    SS.stream.unhold(true);
  }

  async function apply() {
    if (SS.dead()) return off(); // extension got reloaded, this copy of us is a ghost
    let state;
    try {
      state = await SS.store.loadState();
    } catch (e) {
      clearTimeout(failsafe);
      return off();
    }
    clearTimeout(pauseTimer);
    const s = state.settings;
    if (s.pausedUntil > Date.now()) pauseTimer = setTimeout(apply, s.pausedUntil - Date.now() + 150);
    const on = SS.store.isOn(s, host) && siteEnabled(s) && state.livePacks.length > 0;
    clearTimeout(failsafe);
    if (!on) return off();
    early.rehide();
    engine.configure(state);
    if (engine.running) engine.recheckAll();
    else engine.start();
  }

  apply();
  SS.store.onChange(apply);

  if (SS.api && SS.api.runtime && SS.api.runtime.onMessage) {
    SS.api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.type !== 'ss:status' || !topFrame) return;
      sendResponse({
        count: engine.running ? engine.count : 0,
        site: site ? site.name : 'this site (generic mode)',
        siteId: site ? site.id : 'generic',
        host,
        running: engine.running,
      });
    });
  }
})();
