// the overlay that sits on a blurred card + the full-screen wall for streams and blocked pages.
// both live in shadow roots so a site's css can't make our text invisible or 3px tall or comic sans.
// revealing needs a deliberate move: hold the button for a second, or click + confirm. scrolling past
// with your thumb on a phone should never reveal anything. that was the whole brief
(function () {
  const SS = globalThis.SpoilerShield;
  const HOLD_MS = 1000;

  const SHIELD_CSS = `
    :host { all: initial; }
    .wrap {
      position: absolute; inset: 0; box-sizing: border-box; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .55em;
      padding: 8px 12px; text-align: center; cursor: default; user-select: none; -webkit-user-select: none;
      background: rgba(9, 9, 15, .74);
      -webkit-backdrop-filter: blur(8px) saturate(.6); backdrop-filter: blur(8px) saturate(.6);
      color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.9);
      font: 650 clamp(11px, 4.4cqw, 19px)/1.25 system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif;
      border-radius: inherit;
    }
    .lines { display: flex; flex-direction: column; gap: .2em; max-width: 34em; }
    p { margin: 0; }
    .l0 { font-weight: 800; }
    .l1 { opacity: .92; }
    .l2 { opacity: .8; font-style: italic; font-weight: 600; }
    .l3, .l4 { opacity: .75; font-weight: 500; }
    .why { font: 500 11px/1.2 ui-monospace, Menlo, Consolas, monospace; opacity: .72; max-width: 95%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    button { all: unset; box-sizing: border-box; position: relative; overflow: hidden; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      padding: .5em 1em; border-radius: 999px; touch-action: none; white-space: nowrap; flex: none;
      font: 700 12px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff;
      background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.38); }
    button:hover { background: rgba(255,255,255,.2); }
    button:focus-visible { outline: 2px solid #ff4f7b; outline-offset: 2px; }
    .fill { position: absolute; inset: 0; background: #ff3d6e; transform-origin: left center; transform: scaleX(0); }
    .holding .fill { transform: scaleX(1); transition: transform ${HOLD_MS}ms linear; }
    .label { position: relative; }
    .confirm { display: flex; gap: .5em; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 12px; }
    .confirm .yes { background: #ff3d6e; border-color: #ff3d6e; }
    [hidden] { display: none !important; }

    /* shrink with the card: small cards drop lines, tiny ones go single-row */
    @container (max-height: 170px) { .l2, .l3, .l4 { display: none; } }
    @container (max-height: 110px) { .l1, .why { display: none; } .wrap { gap: .4em; } }
    @container (max-width: 230px) { .l1, .l2, .l3, .l4 { display: none; } }
    @container (max-height: 64px) {
      .wrap { flex-direction: row; gap: .6em; padding: 2px 8px; }
      .lines { min-width: 0; }
      .l0 { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 62cqw; }
      button { padding: 4px 9px; font-size: 10px; }
      .confirm { font-size: 10px; flex-wrap: nowrap; }
      .confirm span { display: none; }
    }
    /* chat-message sized: one truncated line + a tiny button, still says what it is */
    @container (max-height: 30px) { .l0 { font-size: 10px; } button { padding: 1px 7px; font-size: 9px; } .wrap { gap: .4em; } }
    @container (max-height: 16px) { .l0 { display: none; } }
  `;

  // events that must die at the overlay: no hover previews, no link clicks, no "open video" underneath
  const SWALLOW = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart',
    'touchend', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'pointerover', 'pointerout', 'pointerenter',
    'pointerleave', 'mousemove', 'pointermove', 'contextmenu', 'keydown', 'keyup', 'focusin', 'wheel'];
  const PREVENT = new Set(['click', 'auxclick', 'dblclick', 'mousedown', 'contextmenu']);

  function swallow(host) {
    // sites with one shared hover-preview player (youtube) read this to hide it
    host.addEventListener('pointerenter', () => document.documentElement.setAttribute('data-ss-hover', ''));
    host.addEventListener('pointerleave', () => document.documentElement.removeAttribute('data-ss-hover'));
    for (const type of SWALLOW) {
      host.addEventListener(type, (e) => {
        e.stopPropagation();
        if (PREVENT.has(type) && e.cancelable) e.preventDefault();
      }, type === 'wheel' || type.startsWith('touch') ? { passive: type === 'wheel' } : false);
    }
  }

  // hold-to-reveal or click+confirm on a button. returns nothing, calls done() when it's for real
  function wireReveal(btn, confirmBox, mode, done) {
    const label = btn.querySelector('.label');
    if (mode === 'confirm') {
      label.textContent = btn.dataset.confirmLabel || 'Reveal…';
      btn.addEventListener('click', () => {
        btn.hidden = true;
        confirmBox.hidden = false;
        confirmBox.querySelector('.no').focus();
      });
      confirmBox.querySelector('.yes').addEventListener('click', () => done());
      confirmBox.querySelector('.no').addEventListener('click', () => {
        confirmBox.hidden = true;
        btn.hidden = false;
        btn.focus();
      });
      return;
    }
    label.textContent = btn.dataset.holdLabel || 'Hold to reveal';
    let timer = null;
    const start = (e) => {
      if (timer) return;
      if (e && e.pointerId != null && btn.setPointerCapture) {
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (err) {
          /* not every browser lets you capture from a shadow root. whatever */
        }
      }
      btn.classList.add('holding');
      // pointer capture can fail inside shadow roots, so also catch the release anywhere on the page
      window.addEventListener('pointerup', stop, { once: true, capture: true });
      timer = setTimeout(() => {
        timer = null;
        btn.classList.remove('holding');
        done();
      }, HOLD_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      btn.classList.remove('holding');
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start(e);
    });
    // no 'blur' / 'pointerleave' here anymore: sites move focus around on mousedown, and a small wobble
    // off the button shouldn't cancel. letting go (anywhere) is what cancels
    for (const t of ['pointerup', 'pointercancel']) btn.addEventListener(t, stop);
    btn.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        start();
        // keyup can land somewhere else if the site moves focus, so listen on window
        window.addEventListener('keyup', function up(ev) {
          if (ev.key !== ' ' && ev.key !== 'Enter') return;
          window.removeEventListener('keyup', up, true);
          stop();
        }, true);
      }
    });
    btn.addEventListener('click', (e) => e.preventDefault()); // a plain click does nothing. that's the point
  }

  function buildLines(lines) {
    const box = document.createElement('div');
    box.className = 'lines';
    lines.slice(0, 5).forEach((line, i) => {
      const p = document.createElement('p');
      p.className = 'l' + i;
      p.textContent = line;
      box.appendChild(p);
    });
    return box;
  }

  function revealControls(opts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reveal';
    btn.innerHTML = '<span class="fill"></span><span class="label"></span>';
    if (opts.holdLabel) btn.dataset.holdLabel = opts.holdLabel;
    if (opts.confirmLabel) btn.dataset.confirmLabel = opts.confirmLabel;
    const confirmBox = document.createElement('div');
    confirmBox.className = 'confirm';
    confirmBox.hidden = true;
    confirmBox.innerHTML = '<span>Sure?</span><button type="button" class="yes"><span class="label">Yes, reveal</span></button><button type="button" class="no"><span class="label">Nope</span></button>';
    wireReveal(btn, confirmBox, opts.mode, opts.onReveal);
    return [btn, confirmBox];
  }

  // ---- card overlay ----
  function attach(el, opts) {
    let host = el.querySelector(':scope > ss-shield');
    if (host && host.dataset.key === opts.key) return host;
    if (host) host.remove();
    host = document.createElement('ss-shield');
    host.dataset.key = opts.key || '';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHIELD_CSS;
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.setAttribute('role', 'note');
    wrap.setAttribute('aria-label', 'Hidden by Spoiler Shield');
    wrap.appendChild(buildLines(opts.lines));
    if (opts.why) {
      const why = document.createElement('div');
      why.className = 'why';
      why.textContent = opts.why;
      wrap.appendChild(why);
    }
    for (const node of revealControls(opts)) wrap.appendChild(node);
    shadow.append(style, wrap);
    swallow(host);
    el.appendChild(host);
    return host;
  }

  function detach(el) {
    const host = el.querySelector(':scope > ss-shield');
    if (host) host.remove();
    document.documentElement.removeAttribute('data-ss-hover'); // pointerleave never fires on a removed node
  }

  // ---- full-screen wall (stream warnings, blocked subreddits/categories) ----
  const WALL_CSS = `
    :host { all: initial; }
    .wall {
      position: fixed; inset: 0; box-sizing: border-box; overflow: auto;
      display: flex; align-items: center; justify-content: center; padding: 24px 16px;
      background: radial-gradient(1200px 600px at 50% 0%, rgba(255,61,110,.18), transparent 60%), rgba(8, 8, 13, .97);
      -webkit-backdrop-filter: blur(30px); backdrop-filter: blur(30px);
      color: #fff; font: 500 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif;
    }
    .card { max-width: 560px; width: 100%; text-align: center; display: flex; flex-direction: column; gap: 18px; align-items: center; }
    .badge { display: inline-flex; gap: 8px; align-items: center; padding: 6px 12px; border-radius: 999px;
      background: rgba(255,61,110,.16); border: 1px solid rgba(255,61,110,.5); color: #ff9db5;
      font: 800 12px/1 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff3d6e; box-shadow: 0 0 10px #ff3d6e; }
    .lines { display: flex; flex-direction: column; gap: 6px; }
    p { margin: 0; }
    .l0 { font-size: clamp(22px, 5vw, 32px); font-weight: 850; line-height: 1.15; }
    .l1 { font-size: clamp(17px, 3.6vw, 22px); font-weight: 700; opacity: .92; }
    .l2 { font-size: clamp(15px, 3vw, 18px); font-style: italic; opacity: .8; }
    .l3, .l4 { opacity: .75; }
    .why { font: 500 13px/1.4 ui-monospace, Menlo, Consolas, monospace; opacity: .7; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    button { all: unset; box-sizing: border-box; position: relative; overflow: hidden; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
      padding: 12px 20px; border-radius: 999px; touch-action: none;
      font: 750 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff;
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.3); }
    button:hover { background: rgba(255,255,255,.16); }
    button:focus-visible { outline: 2px solid #ff4f7b; outline-offset: 3px; }
    .out { background: #fff; color: #111; border-color: #fff; }
    .out:hover { background: #e9e9ee; }
    .fill { position: absolute; inset: 0; background: #ff3d6e; transform-origin: left center; transform: scaleX(0); }
    .holding .fill { transform: scaleX(1); transition: transform ${HOLD_MS}ms linear; }
    .label { position: relative; }
    .confirm { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
    .confirm .yes { background: #ff3d6e; border-color: #ff3d6e; }
    .small { font-size: 12px; opacity: .55; }
    [hidden] { display: none !important; }
  `;

  let wallHost = null;

  function showWall(opts) {
    hideWall();
    const host = document.createElement('ss-wall');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = WALL_CSS;
    const wall = document.createElement('div');
    wall.className = 'wall';
    wall.setAttribute('role', 'alertdialog');
    wall.setAttribute('aria-modal', 'true');
    wall.setAttribute('aria-label', opts.title || 'Spoiler warning');
    const card = document.createElement('div');
    card.className = 'card';
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.innerHTML = '<span class="dot"></span><span class="t"></span>';
    badge.querySelector('.t').textContent = opts.badge || 'Spoiler Shield';
    card.append(badge, buildLines(opts.lines));
    if (opts.why) {
      const why = document.createElement('div');
      why.className = 'why';
      why.textContent = opts.why;
      card.appendChild(why);
    }
    const row = document.createElement('div');
    row.className = 'row';
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'out';
    out.innerHTML = '<span class="label"></span>';
    out.querySelector('.label').textContent = opts.outLabel || 'Get me out of here';
    out.addEventListener('click', () => opts.onOut && opts.onOut());
    const [btn, confirmBox] = revealControls({
      mode: opts.mode,
      holdLabel: opts.holdLabel || 'Hold to watch anyway',
      confirmLabel: opts.confirmLabel || 'Watch anyway…',
      onReveal: () => {
        hideWall();
        opts.onReveal && opts.onReveal();
      },
    });
    row.append(out, btn);
    card.append(row, confirmBox);
    if (opts.small) {
      const s = document.createElement('div');
      s.className = 'small';
      s.textContent = opts.small;
      card.appendChild(s);
    }
    wall.appendChild(card);
    shadow.append(style, wall);
    swallow(host);
    document.documentElement.appendChild(host);
    wallHost = host;
    setTimeout(() => out.focus(), 0);
    return host;
  }

  function hideWall() {
    if (wallHost) wallHost.remove();
    wallHost = null;
  }

  // react apps sometimes nuke stuff appended to <html>. main.js calls this on a timer to put it back
  function wallStillThere() {
    return !wallHost || wallHost.isConnected;
  }

  SS.shield = { attach, detach, showWall, hideWall, wallStillThere, get wallUp() { return !!wallHost; }, HOLD_MS };
})();
