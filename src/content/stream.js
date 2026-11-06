// hey, this is the player lock. while a stream/video page is being checked ("hold") or behind a warning ("lock"),
// every <video>/<audio> on the page stays paused and muted. players love to call play() 40 times a
// second when you pause them, so we don't just pause once: we sit on the 'play' event (capture phase,
// installed at document_start before the site's own scripts even exist) and slap it back down. every. time.
(function () {
  const SS = globalThis.NoSpoil;

  const state = {
    hold: false, // checking, no ui
    lock: false, // warning wall is up
    saved: new WeakMap(), // media -> { muted, wasPlaying }
  };

  const blockedCard = (media) => !!(media.closest && media.closest('[data-ss="blocked"]'));
  const shouldStop = (media) => state.hold || state.lock || blockedCard(media);

  function remember(media) {
    if (!state.saved.has(media)) state.saved.set(media, { muted: media.muted, wasPlaying: !media.paused });
  }

  function squash(media) {
    remember(media);
    try {
      if (!media.paused) media.pause();
      media.muted = true;
    } catch (e) {
      /* some players proxy these and throw. eh, the play listener gets it next time */
    }
  }

  function onPlay(e) {
    const media = e.target;
    if (!(media instanceof HTMLMediaElement)) return;
    if (shouldStop(media)) squash(media);
  }

  // capture phase on window: media events don't bubble, but capture still sees them
  window.addEventListener('play', onPlay, true);
  window.addEventListener('playing', onPlay, true);
  window.addEventListener('loadeddata', onPlay, true);

  function allMedia() {
    return Array.from(document.querySelectorAll('video, audio'));
  }

  function squashAll() {
    for (const m of allMedia()) squash(m);
  }

  // put things back the way we found them. resume=true only after a real user gesture (the reveal hold),
  // otherwise autoplay policies eat the play() call anyway, so why bother
  function restore(resume) {
    for (const m of allMedia()) {
      if (blockedCard(m)) continue;
      const s = state.saved.get(m);
      if (!s) continue;
      try {
        m.muted = s.muted;
        if (resume && s.wasPlaying) {
          const p = m.play();
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) {
        /* meh. not my problem */
      }
      state.saved.delete(m);
    }
  }

  SS.stream = {
    get held() {
      return state.hold;
    },
    get locked() {
      return state.lock;
    },
    hold() {
      state.hold = true;
      document.documentElement.setAttribute('data-ss-hold', '');
      squashAll();
    },
    unhold(resume) {
      if (!state.hold) return;
      state.hold = false;
      document.documentElement.removeAttribute('data-ss-hold');
      if (!state.lock) restore(resume !== false);
    },
    lock() {
      state.lock = true;
      squashAll();
    },
    unlock(resume) {
      state.lock = false;
      if (!state.hold) restore(resume);
    },
    pauseInside(el) {
      for (const m of el.querySelectorAll('video, audio')) squash(m);
    },
    squashAll,
  };
})();
