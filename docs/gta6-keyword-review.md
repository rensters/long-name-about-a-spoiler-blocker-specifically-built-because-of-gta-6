# GTA VI keyword pack: review sheet

Researched 2026-10-16. That's the day after the launch trailer, about a month before the Nov 19 console launch, with PC rumored for Q1 2027.
The real data lives in [`packs/gta6.json`](../packs/gta6.json). This page is the same thing laid out for reading.

**No story stuff in here.** Everything comes from the trailers, the official site, the pre-order page, the radio reveal and press coverage of those.
I didn't put in leaked mission names, trophy lists or "who dies" details. Making you read spoilers so you can block spoilers would be a pretty dumb own goal.
Generic phrases like "who dies" or "ending" cover that stuff anyway.

## How the three tiers work

| Tier | Blurs when | Example |
|---|---|---|
| **strong** | alone, always | "GTA 6", "Lucia Caminos", "Port Gellhorn" |
| **weak** | next to a strong term, or next to a *different* weak term | "Jason" + "Lucia" blurs; "Jason" alone doesn't |
| **context** | never by itself, never with other context words. It only counts as the second clue for a weak term | "Rockstar" + "trailer" blurs; "trailer" + "leak" (some other game) doesn't |

Your own examples needed that third tier. "Rockstar Games + trailer", "GTA ending" and "GTA leak" only work if "trailer", "ending" and "leak" can be clues without blurring every trailer on the internet.

**One exception:** context words don't pair with *character names* (the pack's `contextIgnores` setting lists the "Characters" groups). "Jason's pizza review" and "Jason killed it on stage" stay visible, while "GTA review" and "Vice City trailer" blur. Names still pair with each other, so "Jason and Lucia" blurs. A test caught this one: the first version blurred a fake "Jason's pizza review" video.

**Allow terms** get cut out of the text before matching. "Jason Momoa" never counts as "Jason", and "GTA V" never counts as "GTA". "GTA V vs GTA VI" still blurs, because the VI part is still there.
**Allowed channels** never get blurred, whatever they post.

### Stuff the matcher handles so the list doesn't have to

You don't need to type every spelling. For every term:

- case, accents, full-width and "𝐟𝐚𝐧𝐜𝐲" unicode letters, Cyrillic/Greek lookalike letters
- leetspeak: `GT4 6`, `GTA V1`, `GTAVl` (lowercase L), `gr4nd th3ft`
- separators: spaces, dots, dashes, underscores, emoji between words (`G.T.A. 6`, `GTA-VI`, `GTA🔥6`), and none at all (`GTA6`, `#GrandTheftAutoVI`)
- camelCase hashtags get split: `#GTA6Trailer`, `#LeonidaGov`
- numbers: `6` = `VI` = `six` (2 to 20; single-letter roman numerals like V and X are left alone, since "GTA V" is a different game)
- `&` = `and`, apostrophes optional (`DreQuan` = `Dre'Quan`)
- Arabic-Indic, Devanagari, Thai and full-width digits count as normal digits (`جي تي اي ٦` works)

---

## STRONG (blur on sight)

**Title and spellings**: GTA 6 · GTA VI · GTA Six · GTA 6ix · Grand Theft Auto 6 / VI / Six
(+ automatic: GTA6, GTAVI, #GTA6, #GTAVI, G.T.A. 6, GTA-6, GT4 6, GTA V1, GTAVl, Grand Theft Auto: VI ...)

**Typos**: Grand Thief Auto 6 · Grand Theif Auto 6 · Grand Thef Auto 6 · Grand Theft Otto 6 · Gran Theft Auto 6 · Grand Theft Atuo 6 · Grand Theft Aut 6 · Grnad Theft Auto 6 · Grand Theft Autos 6

**Other languages and scripts**
- Chinese: 侠盗猎车手6 · 俠盜獵車手6 · 侠盗飞车6 · 俠盜飛車6 · 给他爱6 / 給他愛6 (the "gěi tā ài" GTA pun)
- Japanese: グランド・セフト・オート6 · グラセフ6 · ジーティーエー6
- Korean: 그랜드 테프트 오토 6 · 지티에이 6
- Russian / Ukrainian: ГТА 6 · ГТА шесть · ГТА шість · Гранд Тефт Авто 6 · GTA шесть · GTA шість
- Arabic / Persian: جي تي اي 6 · جي تي أي 6 · قراند 6 · جراند ثفت أوتو 6 · غراند ثفت أوتو 6 · جی تی ای 6
- Hindi: जीटीए 6 · ग्रैंड थेफ्ट ऑटो 6 — Thai: จีทีเอ 6
- "Six" spelled out: GTA seis (es/pt) · sei (it) · sechs (de) · zes (nl) · sześć (pl) · šest (cs/sk/hr) · șase (ro) · kuusi (fi) · altı (tr) · enam (id/ms) · sáu (vi)
- (Most countries just write "GTA 6", which is already covered.)

**Characters**: Jason Duval · Lucia Caminos · Cal Hampton · Boobie Ike · Dre'Quan Priest · Real Dimez · Bae-Luxe · Raul Bautista · Brian Heder · Lori Heder

**Places**: Leonida · Leonida Keys · Lake Leonida · Grassrivers · Port Gellhorn · Mount Kalaga (National Park) · Vice-Dale County · Vice Dale · Vice Beach · Ekanfinaka · Tisha-Wocka (Flea Market) · Lummox County · LeonidaGov

**Businesses, gangs, radio**: Only Raw Records · PTT Youngin$ · Cocoteo FM · AfroBank FM · Chamber 106.6

**Marketing**: "Vice City, USA" (the site's tagline) · Vintage Vice City Pack (pre-order bonus)

**Leaks**: teapotuberhacker (2022 GTAForums leaker) · CyberLeek (the Aug 2026 gameplay leaker)

**Regex (strong)**
- squished hashtags with no word breaks: `#gtavitrailer`, `#newgta6`
- links to rockstargames.com/VI in link previews

## WEAK (need a second clue)

**Title fragments**: GTA · Grand Theft Auto · Grand Thief Auto · Grand Theif Auto · 侠盗猎车手 · 俠盜獵車手 · 侠盗飞车 · 俠盜飛車 · 给他爱 · 給他愛 · グランド・セフト・オート · グラセフ · 그랜드 테프트 오토 · 지티에이 · ГТА · Гранд Тефт Авто · جي تي اي · جراند ثفت أوتو · जीटीए

**Characters**: Jason · Lucia · Boobie · Andrés de León (from the Extended Look) · Dolls of Destruction · Gutless Wonders · The Hummers & The Strummers (in-game bands)

**Places**: Vice City · Ambrosia (+ County) · Gellhorn · Kalaga · Gloriana · Gloriana Key · Little Cuba · La Perle · Washington Beach · Starfish Island · Vercetti Estate · Leaf Links · Catalan Key · Dalton Island · Tequesta Retreat · Leonard / Kelly / Mariana County · Waning Sands · Allied Crystal (the sugar refinery)
Vice City in other scripts: 罪恶都市 · 罪惡都市 · バイスシティ · 바이스 시티 · Вайс-Сити · فايس سيتي

**Businesses and apps**: Jack of Hearts · Only Raw · Malibu Club · Delights Cabaret · Rideout Customs · Chip's Body Shop · Watkin's Auto Parts · Diamond Dawgs · Frills and Fancy · Zeke's Gadgets · Starlet Motel · Ocean View Hotel · Dominion Hotel · Sahara Arena · The Sumerian · Hoodwinks · Sara's Unisex Salon · Stock 305 · Electric Fang · One-Eyed Willie's · Goodtime Gear · Mega Mundo · The Vice City Collection (merch)

**Radio stations** (revealed Oct 8; the first six are official, the rest are from fan trackers): Flash FM · V-Rock · Back Country Radio · Dirty South Classics · Stockyard FM · Symphony FM · CircoLoco Records Radio · Honey FM · Radio On-U · Kaleidoscope FM

**Weapons**: Girardi ES9 (Jason's sidearm) · Klose K17 (Lucia's)

**Leaks and insiders**: GTAForums · Tez2 / TezFunz2 · Yan2295

**Studio and people**: Rockstar · Rockstar Games · Rockstar North · R* · Take-Two (Interactive) · Strauss Zelnick · Zelnick · Sam Houser · Aaron Garbut

## CONTEXT (only count next to a weak term)

**Spoiler phrases**: ending(s) · ending explained · final mission · last mission · final boss · who dies · dies · death · killed · plot twist · twist · full map · entire map · map size · story explained · story · lore · every mission · all missions · 100% walkthrough · walkthrough · playthrough · longplay · full game · gameplay · cutscene(s) · credits · post-credits · secret / true / good / bad ending · all endings · epilogue · betrayal · betrays · boss fight · easter egg(s) · secrets · spoiler(s) · map · mission(s) · review(s) · Metacritic · OpenCritic · wanted level · 6 star wanted

**Marketing beats**: trailer(s) · trailer 1/2/3 · third trailer · launch trailer · extended look · gameplay reveal · gameplay trailer · first look · reveal · screenshot(s) · artwork · pre-order · preorder · pre-load · preload · Ultimate Edition · Standard Edition · release date · launch · launch day · November 19 · Nov 19 · delay(ed) · PS5 · Xbox Series · PC version · PC port · PC release

**Leak words**: leak(s) · leaked · leaker · leaked footage · leaked build · leaked gameplay · dev / development / playable / test / debug build · 2022 leak · datamine(d) · dataminer · insider · rumor(s) · rumour(s)

**Trailer songs**: Love Is a Long Road (T1) · Hot Together (T2) · Thunder Island · Everybody Have Fun Tonight · Talkin' to Myself Again · Pop Bottles · Pound Town · Skrilla · Cars and Girls · Mine O' Mine (Extended Look) · Flower in a Hurricane (Justice)

**Vehicles** (from the trailers, the screenshots and the Ultimate Edition list): Grotti Cheetah · Bravado Banshee · Pfister Comet · Vapid Ganado · Vapid Dominator / Dominator Buggy · Vapid Stanier · Dinka Enduro · Shitzu Squalo · Crest Kayak · Willard Faction · Nagasaki Caddy · Rexhall Rose Air · Declasse Granger · Maibatsu Penumbra · Progen Emerus · Buckingham Valkyrie · Buckingham Luxor · Principe Lectro · HVY Airtug · Canis Terminus · Übermacht Rebla · Mammoth Patriot · Pfister Neon · Grotti Itali RSX · Pegassi Infernus · Fathom FR36 · Dundreary Landstalker · Brute Tipper · Brute Stockade · Jacksheepe Excavator

**GTA-universe brands**: Ammu-Nation · Snapmatic · Weazel News · Burger Shot · Cluckin' Bell · Sprunk · eCola · Pißwasser · Up-n-Atom · Lifeinvader · Bleeter · Social Club · Hawk & Little · Bravado · Declasse · Dewbauchee · Dinka · Grotti · Lampadati · Pegassi · Pfister · Progen · Truffade · Übermacht · Maibatsu · Dundreary · Endurex · Jacksheepe · Shitzu

Vehicles and car brands are context and not weak on purpose. They're all over GTA Online, and two car names in a GTA Online video shouldn't blur it. Next to "Jason" or "Leonida" they still count.

## Blocks by place, not by words

**Subreddits** (full-page block screen): r/GTA6 · r/GTAVI · r/GTA · r/rockstar · r/GamingLeaksAndRumours · r/GTA6Leaks · r/GrandTheftAutoVI · r/Leonida · r/ViceCity · r/RockstarGames · r/gtaonline

**Categories** (Twitch / Kick / YouTube game chip, directory pages blocked): Grand Theft Auto VI · Grand Theft Auto 6 · GTA VI · GTA 6

**Channels/accounts that always blur** (GTA-news-heavy): Rockstar Games · TGG (The Gaming Gorilla, was at the Rockstar North preview) · MrBossFTW · GTA Series Videos · Rockstar INTEL · GTA BOOM · GTABase · GTA Intel · GTA6 Bible · Tez2 / TezFunz2 · Yan2295 · videotech_ · CyberLeek · GTA 6 Countdown · GTAVI Countdown · GTAForums · Dyllie · ViceReel · RENZI · DarkViperAU · Typical Gamer

**Streamer watchlist** (full-screen warning on *any* of their streams, chat collapsed). This is the biggest-reaction-stream crowd from the Extended Look: Kai Cenat · IShowSpeed · xQc · summit1g · Sodapoppin · LIRIK · shroud · TimTheTatman · Ninja · Jynxzi · CaseOh · Adin Ross · penguinz0 / moistcr1tikal · Ludwig · IlloJuan · Rubius · AuronPlay · TheGrefg · Ibai · fps_shaka · Fanum · Duke Dennis

**Allow (cut out before matching)**: GTA V / 5 / Five · Grand Theft Auto V / 5 · GTA IV · GTA III · GTA 2 · GTA London · GTA San Andreas · GTA Liberty City Stories · GTA Vice City Stories · GTA Chinatown Wars · GTA Advance · GTA Trilogy · the famous Jasons (Momoa, Statham, Derulo, Bourne, Voorhees, Mraz, Aldean, Sudeikis, Kelce, Todd, Bateman, Segel, Isbell, Kidd, Day, Mantzoukas, Schwartzman) · Saint / St. / Santa Lucia · Ambrosia salad · Rockstar Energy

---

## ⚠ Your call: the stuff I wasn't sure about

These are in the pack with my default. Each one's group in the settings page ends with "(check)".

| Term | Where it is now | Why I'm unsure |
|---|---|---|
| Project Americas | strong | reported codename from years ago, never confirmed |
| GTA seks | strong | "six" in Norwegian/Danish, but "sex" in Polish/Czech, so it'll also catch GTA V sex-mod posts |
| Dre'Quan (alone) | strong | rare real first name |
| Arion Kurtaj | strong | the 2022 hacker; also known for the Uber/Nvidia hacks |
| قراند | weak | Gulf Arabic slang for GTA ("Grand"), but it's also just the word "grand" |
| Raul · Duval · Caminos · Heder · Roxy · Lori | weak | common names/words (Duval is a Florida county, "caminos" means roads) |
| Mendez · Ernesto · Petra Navarro | weak | Extended Look names from one or two outlets; not on the official site |
| Wyman · Erin Henshaw · Kenny Brewster | weak | names from the 2022 leak footage, never confirmed |
| Phil Cassidy | weak | rumor only (Vice City character) |
| San 4 San · Guardia Brothers | weak | gang names from an unverified leak doc |
| Ocean Beach · Rockridge · Belville · Venetian Islands | weak | also real places |
| Effluvia · Paradise Garage | weak | real words / real famous club |
| RydeMe · BuckMe | weak | leaked domain names (Tez2), not confirmed in-game |
| Worldwide FM | weak | also a real London radio station |
| Lapsus$ · Videotech · Dyllie | weak | hacking group / leakers whose posts aren't all GTA |
| Dan Houser | weak | left Rockstar in 2020, but still gets dragged into every GTA 6 thread |
| Rob Nelson · Lazlow · Ivan Pavlovich · Jennifer Kolbe · TTWO | weak | studio people / ticker, generic-ish names |
| Stephen Root | weak | confirmed in the cast, but he's in a million other things |
| Manni L. Perez · Dylan Rourke | weak | fan guesses for Lucia and Jason's actors, not confirmed |
| Jason Schreier · Tom Henderson | weak | reporters who cover every game |
| Child Support · I Love Rock 'n' Roll · Love Bites · People Are People · Against All Odds · Inner Light | context | real trailer songs, but very common phrases |
| Vapid · Little Morgan | context | "vapid" is an English word |
| r/gtaonline · r/RockstarGames · r/Leonida · r/ViceCity · r/GTA6Leaks · r/GrandTheftAutoVI | blocked subs | r/gtaonline is GTA V's online sub (it'll be all GTA VI talk at launch); the others might be tiny or dead |
| whole streamer watchlist | watchlist | your feed, your streamers. The Spanish ones (IlloJuan, Rubius, Auron, Grefg, Ibai) only matter if you watch Spanish streams |
| Dyllie · ViceReel · RENZI · DarkViperAU · Typical Gamer | blocked channels | GTA-heavy, but not 100% GTA VI news |

**Two defaults you might want to flip:**
1. **GTA Online is not allowlisted.** At launch it'll be wall-to-wall VI talk, so "GTA Online" + "mission" blurs. If you want GTA Online content visible, add `GTA Online` to the allow list.
2. **GTA: Vice City (the 2002 game) gets blurred too.** People call VI "the new Vice City", so allowlisting the old game would leak. If that bugs you, add `GTA Vice City Definitive Edition` to allow.

## Left out on purpose

- **Radio tracklists.** "Runaway", "Smile", "Smoke on the Water" etc. would only add noise. Station names are in.
- **Real artists** (Bad Bunny, Lana Del Rey, Justice, Tom Petty...): way too much collateral.
- **Real Miami/Florida places** that Vice City copies: South Beach, Little Havana, Little Haiti, Hialeah. Too much real-world news.
- **Super generic names/words**: Brian, Cal, Raymond, Val, Hamlet, Crosstown, Stockyard, Goodtime, "La Ola", "The Wipe", "Emotion".
- **WhatUp / What-Up** (leaked app name): the matcher splits camelCase, so it'd turn into "what up" and catch half the internet.
- **Leaked story content** (mission names, trophies, deaths): see the top of this page.
- **Bare car brands that are normal words**: Obey, Coil, Fathom, Brute, Mammoth, Buckingham, Nagasaki, Albany, Willard, Ocelot, Benefactor. They're only in as part of a full car name.

## Adding names after launch

Open settings → GTA VI → paste one name per line under the right tier, or tell me "add X" and I'll put it in the json.
New names will flood in after Nov 19. If something gets through, the fastest fix is adding the character/place name as **weak**. It pairs up with "GTA", "Jason", "Lucia", "Vice City" and so on, which show up in basically every GTA VI post.

## Sources

- Pre-orders, editions, Ultimate Edition contents: [Dexerto](https://www.dexerto.com/gta/gta-6-price-ultimate-edition-pre-orders-live-3378744/), [TechRadar](https://www.techradar.com/gaming/we-finally-know-the-official-gta-6-price-its-expensive-but-not-too-bad)
- Characters: [GTA Intel character tracker](https://gtaintel.com/games/gta-6/characters), [ETV Bharat on the Extended Look](https://www.etvbharat.com/en/technology/gta-6-extended-look-gta-6-gameplay-trailer-rockstar-games-enn26082804380), [GameRant](https://gamerant.com/gta-6-update-news-october-15-2026)
- Places: [All Things How map guide](https://allthings.how/gta-6-map-locations-every-confirmed-region-in-leonida/), [Beebom](https://beebom.com/gta-6-map/amp/)
- Radio and songs: [PureXbox, first six stations](https://www.purexbox.com/news/2026/10/the-first-six-radio-stations-have-been-revealed-for-gta-6-complete-with-audio-previews), [GTABase radio list](https://gtabase.com/gta-6/radio-stations/), [PC Gamer song list](https://www.pcgamer.com/games/grand-theft-auto/gta-6-radio-songs/)
- Vehicles: [GTABase vehicles](https://www.gtabase.com/gta-6/vehicles/), [Ginx](https://www.ginx.tv/en/cars)
- Apps/leaks: [Gfinity in-game apps](https://www.gfinityesports.com/article/gta-6-in-game-apps-and-websites), [TechRadar on leaked domains](https://www.techradar.com/gaming/grand-theft-auto-6-leak-seemingly-reveals-parodies-of-real-life-websites-and-apps-with-names-like-rydeme-and-what-up), [The Shortcut on CyberLeek](https://www.theshortcut.com/p/gta-6-gameplay-leaks-escalate-as-new-gameplay-videos-emerge-online), [Tom's Guide on the 2022 leak](https://tomsguide.com/news/rockstar-suffers-major-gta-6-leak-heres-what-we-know)
- Cast: [Insider Gaming (Stephen Root)](https://insider-gaming.com/gta-6s-first-voice-actor-has-been-confirmed/), [esports.gg](https://esports.gg/news/gaming/gta-6-voice-actors-who-voices-jason-lucia-and-the-other-characters)
- Streams/creators: [Rockstar Intel on Extended Look reaction streams](https://rockstarintel.com/gta-6-gameplay-reveal-had-nearly-4-million-live-viewers-as-it-broke-netflix/), [GTA BOOM on the Rockstar North creator preview](https://www.gtaboom.com/creators-confirm-a-hands-off-gta-6-preview-at-rockstar-north-with-coverage-after-the-extended-look-d9cb)
- Subreddits: [The Hive Index](https://thehiveindex.com/topics/gta/platform/reddit/), [GTA Intel on r/GTA6](https://gtaintel.com/news/gta6-subreddit-nearly-one-million-members)
- Launch trailer and PC timing: [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/24206/gta-6-launch-trailer-rockstar-ps5), [aktualita.co](https://aktualita.co/en/technology/gta-6-release-date-rockstar-confirms-nov-19-2026-pc-version-rumored)
