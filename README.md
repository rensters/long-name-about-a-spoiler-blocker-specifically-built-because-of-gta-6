# i can't afford a PS5 but i also wish to not get spoiled

hi. so. GTA VI is coming out on consoles and i do not have a console. i'm waiting for the PC release
(rumored Q1 2027, rockstar please) and i refuse to spend months dodging trailers, leaks, ending clips and
that one guy on twitter who posts the final mission "as a joke". so i built this.

it blurs every bit of **GTA VI** on the internet until *you* are ready, then gets out of the way on the
date you pick. and it's not even GTA-only: swap the topic to any game, show, movie or sports result
without touching code, because topics are just JSON packs. go wild.

every blurred thing gets this slapped on top of it:

> hey, it's the thing you wanted blurred

endgame was spoiled to me, it will never fucking happen again

what it actually does:

- **hides stuff before you even see it:** on supported sites, cards are invisible from the very first frame until they've been checked. no thumbnail flashes. not even for a frame. i checked. a lot.
- **blurred, not deleted:** 24px blur + dark tint, the overlay scales with the card, and revealing takes a 1-second hold (or click + confirm). scrolling past on a phone never reveals anything, because your thumb is not to be trusted.
- **livestreams:** a full-screen warning *before* the player starts, with the player paused and muted underneath. covers GTA VI category streams, matched titles, a streamer watchlist, and streams that switch to GTA VI mid-stream (sneaky). live chat gets collapsed or filtered too, and the collapsed chat says "hey, not a good idea, like seriously, don't unblock this". listen to it.
- **whole-page blocks:** r/GTA6 & co, the Twitch/Kick GTA VI category pages, hashtag pages. nope. not going in there.
- **sites:** YouTube (+ m.youtube, Shorts, live chat), Reddit (new, old, mobile web), X/Twitter (yes i still call it twitter), Twitch, Kick, TikTok, Instagram, Facebook, Threads, Bluesky, Discord web, Google Search/News, Bing, plus a generic mode for every other site on the internet.
- **100% local:** no servers, no analytics, no remote code. i don't want your data, i just want to not get spoiled. settings live in your browser's sync storage (falls back to local storage when sync isn't there).
- **lock:** set a phrase and nothing can be switched off, paused or edited without typing it. for weak moments. you know the ones.

the full GTA VI keyword list, with everything i wasn't sure about flagged for you, is in
[docs/gta6-keyword-review.md](docs/gta6-keyword-review.md). yes i read way too much GTA VI news to make it. without getting spoiled. somehow.

---

## install

there's no build step. the folder you're looking at *is* the extension. that's it. that's the trick.

### Brave, Chrome, Edge, Opera, Vivaldi (desktop)

1. open the extensions page: `brave://extensions`, `chrome://extensions`, `edge://extensions`, `opera://extensions` or `vivaldi:extensions`.
2. turn on **Developer mode** (top right; bottom left in Edge, because Edge has to be different).
3. click **Load unpacked** and pick this folder (the one with `manifest.json` in it).
4. pin the icon to your toolbar (it's the anime face staring at you in horror. that's the vibe). the settings page opens on first install: set your **switch-off date** and, if you know yourself, the **lock**.

updating: pull/copy the new files over this folder, then hit the reload ↻ button on the extension's card. done.

brave note: Brave's own Shields don't get in the way. if you use Brave's "Block scripts" on a site, our scripts still run (extensions aren't page scripts, so relax).

### Firefox (desktop)

**quick test (gone after the next restart):** go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json`.

**permanent install:** Firefox only keeps signed add-ons. signing is free and doesn't publish anything anywhere, promise:

1. make a free account at [addons.mozilla.org](https://addons.mozilla.org) and create API keys at *Developer Hub → Manage API Keys*. you get a "JWT issuer" and a "JWT secret". those are YOUR keys, keep them to yourself.
2. in this folder: `npm install`, then run this with your own issuer and secret pasted in place of `YOUR_JWT_ISSUER` and `YOUR_JWT_SECRET` (and no, don't commit them anywhere, hey, i'm looking at you):

   ```bash
   npx web-ext sign --channel unlisted --api-key YOUR_JWT_ISSUER --api-secret YOUR_JWT_SECRET --ignore-files "node_modules/**" "tests/**" "tools/**" "docs/**" "dist/**"
   ```

3. you get a signed `.xpi` in `web-ext-artifacts/`. drag it into Firefox, or open it with *about:addons → ⚙ → Install Add-on From File*.

then in `about:addons` → this extension → **Permissions**, make sure *"Access your data for all websites"* is on. Firefox sometimes leaves that off for extensions you install yourself, and without it nothing gets blurred and you'll think i broke it. i didn't. (probably.)

(Firefox Developer Edition / Nightly can also run it unsigned: set `xpinstall.signatures.required` to `false` in `about:config`.)

### Firefox for Android (the most reliable phone option, honestly)

1. get a signed `.xpi` (see above) onto the phone.
2. in Firefox: *Settings → About Firefox*, tap the Firefox logo **5 times** to unlock the debug menu. yes really. it's a secret menu. very cool.
3. back in *Settings*, tap **Install extension from file** and pick the `.xpi`.

heads-up: Mozilla keeps moving this option around. it's always in Nightly and Beta; on some Release builds it's there and on some it isn't. if yours doesn't show it, install **Firefox Nightly** for this. needs Firefox 142+ on Android.

### Chromium-based Android browsers (Kiwi-style)

some Android browsers can load Chrome extensions from a file in developer mode. the list changes a LOT: Kiwi stopped development in January 2025 (old installs still work), and Lemur, Quetta and Mises have offered "install from .zip/.crx" at various points. check that yours still does before you blame me.

1. on your PC: `npm install && npm run package`. you get `dist/i-cant-afford-a-ps5-but-i-also-wish-to-not-get-spoiled-chrome-1.0.0.zip`. (yes the filename is long. so is the repo name. it's a theme.)
2. copy the zip to the phone.
3. in the browser: open its extensions page (often `chrome://extensions`), enable **Developer mode**, use **+ (from .zip/.crx/.user.js)** and pick the zip.

Microsoft Edge for Android (including Canary) only installs extensions from its store lists, so it can't side-load this one. sorry edge people. both of you.

### iPhone / iPad (Safari)

Safari can run this as a **Safari Web Extension**, but it has to be wrapped in an app with Xcode on a Mac. (apple gonna apple.) the code is already Safari-compatible: no Chrome-only APIs, `requestIdleCallback` and `notifications` are optional, and the service worker background works in Safari.

1. on a Mac with Xcode installed:

   ```bash
   xcrun safari-web-extension-converter /path/to/this-folder --app-name "no spoilers" --bundle-identifier com.yourname.nospoilers --swift --copy-resources
   ```

   it generates an Xcode project and opens it. ignore warnings about `browser_specific_settings`; Safari just skips that key.
2. in Xcode, pick the **iOS** target, set *Signing & Capabilities → Team* to your Apple ID, plug in your iPhone and hit **Run**.
   with a free Apple ID the app expires after 7 days (just re-run it, it's fine). a paid developer account gets you a year, or TestFlight.
3. on the iPhone: *Settings → Apps → Safari → Extensions → no spoilers*, switch it on and set **All Websites → Allow**.
4. same project, macOS target, if you want it in desktop Safari too.

### the limitation nobody can fix (not even me)

**the official YouTube, Reddit, X, TikTok, Twitch, Instagram, Facebook, Kick and Discord *apps* can't be filtered by any extension.** extensions only live inside browsers. that's just how it is. on your phone, use those sites in a browser that runs this extension (Firefox for Android, or Safari with the iOS wrapper), and maybe log out of / offload the apps until the PC release. same goes for notifications pushed by those apps, smart TVs, consoles, and your friend who "just has to tell you one thing". mute that friend. i'm serious.

---

## how it decides what to blur

each pack has these lists (all editable in Settings → Packs → Edit):

| List | What it does |
|---|---|
| **Strong** | blurs on sight (`GTA 6`, `Lucia Caminos`, `Port Gellhorn`). no questions asked |
| **Weak** | needs a second clue in the same post: a strong term or a *different* weak term (`Jason` + `Lucia` blurs, `Jason` alone doesn't, because there are a lot of Jasons) |
| **Context** | words like `trailer`, `ending`, `leak`. they never blur alone and never pair with each other; they only count as the second clue for a weak term (`Rockstar` + `trailer` blurs, `trailer` + `leak` for some other game doesn't) |
| **Context ignores** | weak groups that context words *don't* pair with. in the GTA VI pack that's the character names, so "Jason's pizza review" stays visible (hi jason) but "GTA review" doesn't |
| **Allow** | cut out of the text before matching: `Jason Momoa` never counts as `Jason`, `GTA V` never counts as `GTA` (but "GTA V vs GTA VI" still blurs, nice try) |
| **Allowed channels** | never blurred, whatever they post. trust them at your own risk |
| **Regex** | for power users, `/pattern/flags`, put `weak ` or `context ` in front to change the tier. runs on normalized text (lowercased, accents stripped) |
| **Blocked subreddits / categories / channels** | blur by *where* something is or *who* posted it, not by words |
| **Streamer watchlist** | full-screen warning on any of their live streams, chat collapsed |

you don't have to list every spelling, i already suffered for you. for every term the matcher handles:
case, accents, 𝐟𝐚𝐧𝐜𝐲 unicode, Cyrillic/Greek lookalike letters, leetspeak (`GT4 6`, `GTA V1`, `GTAVl`),
separators and emoji (`G.T.A. 6`, `GTA-VI`, `GTA🔥6`, `GTA6`), hashtags and camelCase (`#GTA6Trailer`),
numbers (`6` = `VI` = `six`; single-letter romans like V are left alone), `&` = `and`, optional apostrophes,
and non-latin digits (`جي تي اي ٦`). to stop leetspeak from turning phone numbers into "GTA 6" (yes that
happened), a match has to contain at least half the letters of the term.

**generic mode** (sites without their own module) only uses *strong* terms and has no hide-before-check,
because there's no way to know what a "card" is on some random site. so a headline might show for a frame
before it blurs there. supported sites never do that.

## packs

- `packs/gta6.json`: the default GTA VI pack (researched 2026-10-16, ~450 terms, see the [review sheet](docs/gta6-keyword-review.md)). the main event.
- `packs/example-f1.json`: an F1 race-results pack, just to show the format works for anything. off by default.
- **new pack:** Settings → Packs → *New pack*. or copy a json file into `packs/`, add it to `packs/index.json`, and reload the extension.
- **import / export:** per pack in the Packs list, or *Backup* for everything at once (handy for moving between Brave and Firefox, which don't share sync. annoyingly).
- **switch-off date:** each pack can turn itself off on a date **you** set (it never does this on its own, i'm not deciding for you), with a reminder N days before. when Rockstar finally announces the PC date, set it there. please rockstar.
- your edits to a built-in pack are stored as a small diff on top of it. so when `gta6.json` gets new names after launch, you keep your edits *and* get the new names. best of both worlds.

## when something slips through (it happens, sorry)

1. Settings → **Test a sentence**: paste the title that got through. it tells you exactly which words it found and why it did or didn't blur.
2. if the words are fine but the *card* wasn't touched, the site changed its layout again (they love doing that). every site has its own file in `src/sites/` (`youtube.js`, `reddit.js`, …), each selector with a comment saying what it targets. right-click the card → Inspect, find its tag/attribute, add it to `items`, reload the extension. usually a one-line fix. or open an issue / message me with "this got through on YouTube" and paste what Inspect shows.

## privacy

nothing leaves your browser. the extension makes no network requests at all: no analytics, no remote lists, no update pings. nothing. settings sync through your browser's own sync (Brave Sync / Chrome Sync / Firefox Sync) if you have it on. permissions: `storage` (settings), `alarms` (pause timer, switch-off reminders), `notifications` (those reminders), and access to all sites (to blur stuff on them, obviously).

---

## development

hey, why are you down here? oh, you want to poke at the code. ok fine. here's the map:

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

Firefox can't be driven by Playwright with an extension loaded (believe me, i tried), so Firefox coverage is `npm run lint:firefox` plus the manual checklist below.

## manual test checklist (real sites)

do this after installing, and again whenever a site redesigns (so, constantly). takes about 10 minutes. use the Settings → *Test a sentence* box to make up titles.

**setup:** extension on, GTA VI pack on, *Show which keyword matched* temporarily ON so you can see why things blur. (careful, the matched word itself can be a spoiler.)

- [ ] **YouTube home + search** (search "gta 6", bravely): every GTA VI card is blurred from the first frame (no flash while it loads), other cards are normal. hovering a blurred card plays no preview. clicking it opens nothing.
- [ ] **YouTube watch page sidebar + end screen + Shorts shelf**: GTA VI recommendations blurred.
- [ ] **YouTube video page of a GTA VI video**: full-screen warning, no sound, video paused. "Get me out of here" goes back. holding "watch anyway" for 1s plays it.
- [ ] **YouTube live stream** (any big GTA live): warning before playback, live chat collapsed. on any other live stream, chat messages mentioning GTA VI are blurred.
- [ ] **reveal**: a quick tap/click does nothing; a 1s hold reveals only that card. switch to *click + confirm* in settings and try again.
- [ ] **infinite scroll**: scroll the YouTube home / Reddit / X feed for a while. new cards keep getting checked and the page never freezes.
- [ ] **Reddit (new + old.reddit.com)**: GTA posts and comments blurred. a post from r/GTA6 is blurred even with a harmless title. visiting reddit.com/r/GTA6 shows the block screen.
- [ ] **X**: timeline posts, quote posts, image alt text, the Explore/trending GTA trends.
- [ ] **Twitch**: browse page cards in the "Grand Theft Auto VI" category blurred even with a clean title. sidebar entries playing GTA VI blurred. `twitch.tv/directory/category/grand-theft-auto-vi` blocked. a watchlist streamer's live page shows the warning first. chat messages filtered.
- [ ] **mid-stream switch**: on a clean stream, the warning appears within ~2s of the streamer changing title/category to GTA VI (hard to stage. Settings → Test confirms the matching side).
- [ ] **Kick, TikTok, Instagram, Facebook, Threads, Bluesky, Discord, Google, Bing**: search "gta 6" / scroll a feed. matching stuff is blurred.
- [ ] **light + dark mode** of a couple of sites: overlay text readable on both.
- [ ] **popup**: counter matches what you see, the badge number matches, "this site: off" works, pause 10 min works and comes back by itself, quick-add a word and it blurs immediately.
- [ ] **lock**: set a phrase. switching off / pausing / site-off / settings now need the phrase. wrong phrase does nothing. (good.)
- [ ] **switch-off date**: set it to tomorrow with "remind 1 day before". the popup/settings show the reminder. (then set it back! don't forget! i forgot once!)
- [ ] **phone** (Firefox for Android or Safari): repeat YouTube + Reddit + X on the mobile sites.
- [ ] turn *Show which keyword matched* back OFF. seriously.

that's it. go touch grass until the PC release. 🫡
