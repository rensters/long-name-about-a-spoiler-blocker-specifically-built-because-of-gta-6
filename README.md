# i can't afford a PS5 but i also wish to not get spoiled

Blurs every bit of **GTA VI** on the internet until *you* are ready (i.e. the PC release, rumored Q1 2027),
then gets out of the way on the date you pick. Swap the topic to any game, show, movie or sports result
without touching code: topics are just JSON packs.

Every blurred thing gets this on top of it:

> Hey, it's the thing you prevented from showing up.
> Not today, spoiling shitbag.
> The Endgame Incident will never happen again!

- **Hide-before-it's-seen:** on supported sites, cards are invisible from the very first frame until they've been checked. No thumbnail flashes.
- **Blurred, not deleted:** 24px blur + dark tint, the overlay scales with the card, and revealing takes a 1-second hold (or click + confirm). Scrolling past on a phone never reveals anything.
- **Livestreams:** a full-screen warning *before* the player starts, with the player paused and muted underneath. That covers GTA VI category streams, matched titles, a streamer watchlist, and streams that switch to GTA VI mid-stream. Live chat gets collapsed or filtered too.
- **Whole-page blocks:** r/GTA6 & co, the Twitch/Kick GTA VI category pages, hashtag pages.
- **Sites:** YouTube (+ m.youtube, Shorts, live chat), Reddit (new, old, mobile web), X/Twitter, Twitch, Kick, TikTok, Instagram, Facebook, Threads, Bluesky, Discord web, Google Search/News, Bing, plus a generic mode for every other site.
- **100% local:** no servers, no analytics, no remote code. Settings live in your browser's sync storage (falls back to local storage when sync isn't there).
- **Lock:** set a phrase and nothing can be switched off, paused or edited without typing it. For weak moments.

The full GTA VI keyword list, with everything I wasn't sure about flagged for you, is in
[docs/gta6-keyword-review.md](docs/gta6-keyword-review.md).

---

## Install

There's no build step. The folder you're looking at *is* the extension.

### Brave, Chrome, Edge, Opera, Vivaldi (desktop)

1. Open the extensions page: `brave://extensions`, `chrome://extensions`, `edge://extensions`, `opera://extensions` or `vivaldi:extensions`.
2. Turn on **Developer mode** (top right; bottom left in Edge).
3. Click **Load unpacked** and pick this folder (the one with `manifest.json` in it).
4. Pin the shield icon to your toolbar. The settings page opens on first install: set your **switch-off date** and, if you know yourself, the **lock**.

Updating: pull/copy the new files over this folder, then hit the reload ↻ button on the extension's card.

Brave note: Brave's own Shields don't interfere. If you use Brave's "Block scripts" on a site, our scripts still run (extensions aren't page scripts).

### Firefox (desktop)

**Quick test (until the next restart):** go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json`.

**Permanent install:** Firefox only keeps signed add-ons. Signing is free and doesn't publish anything:

1. Make a free account at [addons.mozilla.org](https://addons.mozilla.org) and create API keys at *Developer Hub → Manage API Keys*.
2. In this folder: `npm install`, then

   ```bash
   npx web-ext sign --channel unlisted --api-key YOUR_JWT_ISSUER --api-secret YOUR_JWT_SECRET --ignore-files "node_modules/**" "tests/**" "tools/**" "docs/**" "dist/**"
   ```

3. You get a signed `.xpi` in `web-ext-artifacts/`. Drag it into Firefox, or open it with *about:addons → ⚙ → Install Add-on From File*.

Then in `about:addons` → this extension → **Permissions**, make sure *"Access your data for all websites"* is on. Firefox sometimes leaves that off for extensions you install yourself, and without it nothing gets blurred.

(Firefox Developer Edition / Nightly can also run it unsigned: set `xpinstall.signatures.required` to `false` in `about:config`.)

### Firefox for Android (the most reliable phone option)

1. Get a signed `.xpi` (see above) onto the phone.
2. In Firefox: *Settings → About Firefox*, tap the Firefox logo **5 times** to unlock the debug menu.
3. Back in *Settings*, tap **Install extension from file** and pick the `.xpi`.

Heads-up: Mozilla has moved this option around. It's always in Nightly and Beta; on some Release builds it's there and on some it isn't. If yours doesn't show it, install **Firefox Nightly** for this. Firefox needs version 142+ on Android.

### Chromium-based Android browsers (Kiwi-style)

Some Android browsers can load Chrome extensions from a file in developer mode. The list changes a lot: Kiwi stopped development in January 2025 (old installs still work), and Lemur, Quetta and Mises have offered "install from .zip/.crx" at various points. Check that yours still does.

1. On your PC: `npm install && npm run package`. You get `dist/i-cant-afford-a-ps5-but-i-also-wish-to-not-get-spoiled-chrome-1.0.0.zip`.
2. Copy the zip to the phone.
3. In the browser: open its extensions page (often `chrome://extensions`), enable **Developer mode**, use **+ (from .zip/.crx/.user.js)** and pick the zip.

Microsoft Edge for Android (including Canary) only installs extensions from its store lists, so it can't side-load this one.

### iPhone / iPad (Safari)

Safari can run this as a **Safari Web Extension**, but it has to be wrapped in an app with Xcode on a Mac. The code is already Safari-compatible: no Chrome-only APIs, `requestIdleCallback` and `notifications` are optional, and the service worker background works in Safari.

1. On a Mac with Xcode installed:

   ```bash
   xcrun safari-web-extension-converter /path/to/this-folder --app-name "no spoilers" --bundle-identifier com.yourname.nospoilers --swift --copy-resources
   ```

   It generates an Xcode project and opens it. Ignore warnings about `browser_specific_settings`; Safari just skips that key.
2. In Xcode, pick the **iOS** target, set *Signing & Capabilities → Team* to your Apple ID, plug in your iPhone and hit **Run**.
   With a free Apple ID the app expires after 7 days (just re-run). A paid developer account gets you a year, or TestFlight.
3. On the iPhone: *Settings → Apps → Safari → Extensions → no spoilers*, switch it on and set **All Websites → Allow**.
4. Same project, macOS target, if you want it in desktop Safari too.

### The limitation nobody can fix

**The official YouTube, Reddit, X, TikTok, Twitch, Instagram, Facebook, Kick and Discord *apps* can't be filtered by any extension.** Extensions only live inside browsers. On your phone, use those sites in a browser that runs this extension (Firefox for Android, or Safari with the iOS wrapper), and maybe log out of / offload the apps until the PC release. Same goes for notifications pushed by those apps, smart TVs, consoles, and your friend who "just has to tell you one thing".

---

## How it decides what to blur

Each pack has these lists (all editable in Settings → Packs → Edit):

| List | What it does |
|---|---|
| **Strong** | blurs on sight (`GTA 6`, `Lucia Caminos`, `Port Gellhorn`) |
| **Weak** | needs a second clue in the same post: a strong term or a *different* weak term (`Jason` + `Lucia` blurs, `Jason` alone doesn't) |
| **Context** | words like `trailer`, `ending`, `leak`. They never blur alone and never pair with each other; they only count as the second clue for a weak term (`Rockstar` + `trailer` blurs, `trailer` + `leak` for another game doesn't) |
| **Context ignores** | weak groups context words *don't* pair with. In the GTA VI pack that's the character names, so "Jason's pizza review" stays visible but "GTA review" doesn't |
| **Allow** | cut out of the text before matching: `Jason Momoa` never counts as `Jason`, `GTA V` never counts as `GTA` (but "GTA V vs GTA VI" still blurs) |
| **Allowed channels** | never blurred, whatever they post |
| **Regex** | for power users, `/pattern/flags`, put `weak ` or `context ` in front to change the tier. Runs on normalized text (lowercased, accents stripped) |
| **Blocked subreddits / categories / channels** | blur by *where* something is or *who* posted it, not by words |
| **Streamer watchlist** | full-screen warning on any of their live streams, chat collapsed |

You don't have to list every spelling. For every term the matcher handles:
case, accents, 𝐟𝐚𝐧𝐜𝐲 unicode, Cyrillic/Greek lookalike letters, leetspeak (`GT4 6`, `GTA V1`, `GTAVl`),
separators and emoji (`G.T.A. 6`, `GTA-VI`, `GTA🔥6`, `GTA6`), hashtags and camelCase (`#GTA6Trailer`),
numbers (`6` = `VI` = `six`; single-letter romans like V are left alone), `&` = `and`, optional apostrophes,
and non-latin digits (`جي تي اي ٦`). To stop leetspeak from turning phone numbers into "GTA 6", a match
has to contain at least half the letters of the term.

**Generic mode** (sites without their own module) only uses *strong* terms and has no hide-before-check,
because there's no way to know what a "card" is on a random site. A headline might show for a frame before
it blurs there. Supported sites never do that.

## Packs

- `packs/gta6.json`: the default GTA VI pack (researched 2026-10-16, ~450 terms, see the [review sheet](docs/gta6-keyword-review.md)).
- `packs/example-f1.json`: an F1 race-results pack to show the format works for anything. Off by default.
- **New pack:** Settings → Packs → *New pack*. Or copy a json file into `packs/`, add it to `packs/index.json`, and reload the extension.
- **Import / export:** per pack in the Packs list, or *Backup* for everything at once (handy for moving between Brave and Firefox, which don't share sync).
- **Switch-off date:** each pack can turn itself off on a date **you** set (it never does this on its own), with a reminder N days before. When Rockstar announces the PC date, set it there.
- Your edits to a built-in pack are stored as a small diff on top of it. So when `gta6.json` gets new names after launch, you keep your edits *and* get the new names.

## When something slips through

1. Settings → **Test a sentence**: paste the title that got through. It tells you exactly which words it found and why it did or didn't blur.
2. If the words are fine but the *card* wasn't touched, the site changed its layout. Every site has its own file in `src/sites/` (`youtube.js`, `reddit.js`, …), each selector with a comment saying what it targets. Right-click the card → Inspect, find its tag/attribute, add it to `items`, reload the extension. Usually a one-line fix. Or open an issue / message with "this got through on YouTube" and paste what Inspect shows.

## Privacy

Nothing leaves your browser. The extension makes no network requests at all: no analytics, no remote lists, no update pings. Settings sync through your browser's own sync (Brave Sync / Chrome Sync / Firefox Sync) if you have it on. Permissions: `storage` (settings), `alarms` (pause timer, switch-off reminders), `notifications` (those reminders), and access to all sites (to blur stuff on them).

---

## Development

```
manifest.json            MV3, one manifest for Chromium + Firefox (+ Safari via the converter)
packs/                   topic packs (json) + index.json listing the built-in ones
src/lib/                 shim (browser/chrome), normalize, matcher, packs, store, edit
src/content/             early.js (hide css at document_start), collect, shield (overlay), stream (player lock),
                         engine (the scanner), main (boot), page.css
src/sites/               one file per site, selectors with comments. _registry.js explains the format
src/background.js        badge, built-in pack loading, pause timer, switch-off reminders
src/popup/, src/options/ the toolbar popup and the settings page
tests/unit/              node --test, no dependencies
tests/e2e/ + fixtures/   Playwright: real Chromium + the unpacked extension, fake sites served on the real domains
icons/                   source/pfp.png + rendered pngs (npm run icons)
```

```bash
npm install                # dev tools only (playwright, web-ext). the extension itself has no dependencies
npm test                   # unit tests: matcher, packs, storage, source-file sanity
npx playwright install chromium
npm run test:e2e           # end-to-end in Chromium with the real extension loaded
npm run lint:firefox       # mozilla's linter (0 errors; 1 expected warning about service_worker)
npm run package            # dist/i-cant-afford-a-ps5-but-i-also-wish-to-not-get-spoiled-{chrome,firefox}-<version>.zip, store-ready (see store/LISTING.md)
npm run icons              # re-render icons/*.png from icons/source/pfp.png
```

Firefox can't be driven by Playwright with an extension loaded, so Firefox coverage is `npm run lint:firefox` plus the manual checklist below.

## Manual test checklist (real sites)

Do this after installing, and again whenever a site redesigns. It takes about 10 minutes. Use the Settings → *Test a sentence* box to make up titles.

**Setup:** extension on, GTA VI pack on, *Show which keyword matched* temporarily ON so you can see why things blur.

- [ ] **YouTube home + search** (search "gta 6"): every GTA VI card is blurred from the first frame (no flash while it loads), other cards are normal. Hovering a blurred card plays no preview. Clicking it opens nothing.
- [ ] **YouTube watch page sidebar + end screen + Shorts shelf**: GTA VI recommendations blurred.
- [ ] **YouTube video page of a GTA VI video**: full-screen warning, no sound, video paused. "Get me out of here" goes back. Holding "watch anyway" for 1s plays it.
- [ ] **YouTube live stream** (any big GTA live): warning before playback, live chat collapsed. On any other live stream, chat messages mentioning GTA VI are blurred.
- [ ] **Reveal**: a quick tap/click does nothing; a 1s hold reveals only that card. Switch to *click + confirm* in settings and try again.
- [ ] **Infinite scroll**: scroll the YouTube home / Reddit / X feed for a while. New cards keep getting checked and the page never freezes.
- [ ] **Reddit (new + old.reddit.com)**: GTA posts and comments blurred. A post from r/GTA6 is blurred even with a harmless title. Visiting reddit.com/r/GTA6 shows the block screen.
- [ ] **X**: timeline posts, quote posts, image alt text, the Explore/trending GTA trends.
- [ ] **Twitch**: browse page cards in the "Grand Theft Auto VI" category blurred even with a clean title. Sidebar entries playing GTA VI blurred. `twitch.tv/directory/category/grand-theft-auto-vi` blocked. A watchlist streamer's live page shows the warning first. Chat messages filtered.
- [ ] **Mid-stream switch**: on a clean stream, the warning appears within ~2s of the streamer changing title/category to GTA VI (hard to stage. Settings → Test confirms the matching side).
- [ ] **Kick, TikTok, Instagram, Facebook, Threads, Bluesky, Discord, Google, Bing**: search "gta 6" / scroll a feed. Matching stuff is blurred.
- [ ] **Light + dark mode** of a couple of sites: overlay text readable on both.
- [ ] **Popup**: counter matches what you see, the badge number matches, "this site: off" works, pause 10 min works and comes back by itself, quick-add a word and it blurs immediately.
- [ ] **Lock**: set a phrase. Switching off / pausing / site-off / settings now need the phrase. Wrong phrase does nothing.
- [ ] **Switch-off date**: set it to tomorrow with "remind 1 day before". The popup/settings show the reminder. (Then set it back!)
- [ ] **Phone** (Firefox for Android or Safari): repeat YouTube + Reddit + X on the mobile sites.
- [ ] Turn *Show which keyword matched* back OFF.
