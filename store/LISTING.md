# Store listing kit

Everything to paste into the Chrome Web Store and Firefox Add-ons (AMO) forms.
Build the zips first: `npm run package`, which writes `dist/spoiler-shield-chrome-1.0.0.zip` and `dist/spoiler-shield-firefox-1.0.0.zip`.

---

## Staying anonymous

Your name isn't in any shipped file: no author field, a public-domain license (UNLICENSE), and git history doesn't go in the zips. What can still give you away is the **accounts**:

- [ ] **New email** just for this, e.g. a fresh Gmail or Proton address. Both stores email you about reviews, and the Chrome Web Store can show a contact email on the listing.
- [ ] **Chrome Web Store**: register with that email, pick a pseudonym as the publisher name, and declare yourself a **non-trader**. Traders have to publish a real address; non-traders don't. The $5 one-time fee goes through Google Payments, and that payment name isn't shown on the listing.
- [ ] **Firefox AMO**: sign up with the same email (Firefox account) and set a pseudonym as the display name. The email stays private, and AMO is free.
- [ ] **Support link**: don't use your real email. Options: the store's own support tab (Chrome has one built in), or the new email.
- [ ] **Never push this folder's git history** anywhere public as-is: the commits carry your name and email. If you want it on GitHub later, I'll make a clean history under the pseudonym first.

---

## Shared text

**Name:** Spoiler Shield

**Short description** (Chrome max 132 chars, AMO "summary" max 250):

> Blurs spoilers for the game, show or match you're not ready for across YouTube, Reddit, X, Twitch and more. Starts with GTA VI.

**Category:** Chrome: *Social & Communication* (or *Productivity*). AMO: *Social & Communication*, plus *Privacy & Security*.

**Description:**

> Not ready for spoilers? Spoiler Shield blurs them before you ever see them.
>
> It ships with a GTA VI pack for everyone waiting on the PC version, and you can make packs for any game, show, movie or sports result.
>
> WHAT IT DOES
> • Blurs posts, videos, thumbnails, comments and chat messages that mention your topic, before they appear on screen. No split-second flashes.
> • Blurred, not deleted: hold the button for a second (or click and confirm) to reveal one thing at a time.
> • Livestreams get a full-screen warning before they play, with the player paused and muted. That includes streams that switch to your topic mid-stream.
> • Blocks whole subreddits and game category pages if you want.
> • Write your own spoiler text, pick the blur strength, and set a date for a pack to switch itself off (like the day you finally get to play).
> • Lock mode: turning it off or changing settings needs a phrase you choose. For weak moments.
>
> WORKS ON
> YouTube, Reddit, X/Twitter, Twitch, Kick, TikTok, Instagram, Facebook, Threads, Bluesky, Discord (web), Google, Bing, plus a basic mode for every other site.
>
> PRIVATE BY DESIGN
> Everything happens on your device. No servers, no tracking, no analytics, no data collected. Ever.
>
> SMART MATCHING
> Catches the sneaky spellings too: different separators, hashtags, leetspeak, roman numerals, other languages and scripts. It won't blur a random post just because it mentions a common name or word.
>
> Note: phone apps (YouTube, Reddit, X, TikTok...) can't be filtered by any extension. Use the websites in a browser that supports extensions.
>
> Not affiliated with Rockstar Games, Take-Two Interactive, or any site it works on.

---

## Chrome Web Store: privacy tab

**Single purpose:**

> Hides spoilers for topics the user chooses by blurring matching content on web pages until the user reveals it.

**Permission justifications:**

| Permission | Justification |
|---|---|
| Host permission (all sites) | Spoilers appear on any site (social media, news, search, forums). The extension reads page text locally to decide what to blur and adds a blur overlay. Nothing is sent anywhere. |
| storage | Saves the user's settings and keyword packs. |
| alarms | Runs the "pause for 10 minutes" timer and the daily check for a pack's switch-off date. |
| notifications | Reminds the user a few days before a pack switches itself off on the date they set. |
| Remote code | **No**, I am not using remote code. All code ships in the package. |

**Data usage:** tick *nothing* in the "what user data do you collect" list. Then tick all three certifications (no selling, no unrelated use, no creditworthiness).

**Privacy policy URL:** with no data collected you may be able to leave it empty. If the form insists, the text is in `store/PRIVACY.md`; paste it into a free anonymous page (e.g. a GitHub Gist from the pseudonym account, or a Google Doc shared publicly from the new email) and use that link.

**Images:**
- Store icon: `icons/icon-128.png`
- Screenshots (1280×800): `store/screenshot-1-feed.png` … `screenshot-5-spoiler-text.png`
- Small promo tile (440×280): `store/promo-tile-440x280.png`

**Distribution:** Public, all regions. Mature content: no.

---

## Firefox AMO

1. addons.mozilla.org → *Developer Hub* → *Submit a New Add-on* → **On this site** (listed).
2. Upload `dist/spoiler-shield-firefox-1.0.0.zip`. Compatibility: Firefox **and** Firefox for Android.
3. "Do you need to submit source code?" **No**: the code isn't minified or bundled.
4. Paste the shared text above. License: **The Unlicense**. Privacy policy: paste `store/PRIVACY.md`.
5. Screenshots: the same 5 PNGs.
6. Notes for reviewers:

   > No build step: the zip is the source. Content scripts read page text locally to blur matches; no network requests. Background uses `background.scripts` (event page). Test: open youtube.com and search "GTA 6".

---

## Things a reviewer might flag (and what to do)

- **"shitbag" in the default overlay text.** Most likely fine (it's mild and it's UI, not the listing). If a review complains, change the default second line in `packs/gta6.json` and in `src/lib/packs.js` (`DEFAULT_OVERLAY`) and resubmit. You can always set your own text back in settings.
- **GTA VI in the description.** Describing what it works with is fine; the listing says it's not affiliated with Rockstar. Don't add Rockstar logos or game art to the images.
- **"Access to all sites" means a longer Chrome review**, often a few days, sometimes 2-3 weeks. Normal for this kind of extension.
- **Name clash:** there may already be an extension called "Spoiler Shield". That isn't against the rules, but if the store objects, something like "Spoiler Shield: Hide Game Spoilers" works.

## Updating later

Bump `"version"` in `manifest.json` (1.0.1, 1.1.0...), run `npm run package`, and upload the new zip as a new version in each store. Users get it automatically.
