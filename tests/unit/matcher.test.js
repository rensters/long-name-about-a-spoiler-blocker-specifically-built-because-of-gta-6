// matcher tests. if one of these fails after you edit the pack, either the pack is wrong
// or i was wrong. it's usually me
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadPack } = require('./helpers');

const SS = loadLib();
const gta = loadPack('gta6.json');
const m = new SS.Matcher([gta]);
const hit = (text, extra) => m.match({ text, ...extra });
const blurs = (t) => assert.ok(hit(t), `should blur: ${JSON.stringify(t)}`);
const clean = (t) => assert.equal(hit(t), null, `should NOT blur: ${JSON.stringify(t)} -> ${JSON.stringify(hit(t))}`);

test('title spellings blur on sight', () => {
  [
    'GTA 6 trailer is insane', 'gta6', 'GTA VI', 'GTAVI', '#GTA6', '#GTAVI', 'GTA Six', 'gta six when',
    'Grand Theft Auto VI', 'Grand Theft Auto: VI', 'grand theft auto 6', 'Grand Theft Auto Six',
    'GrandTheftAutoVI', '#GrandTheftAuto6', 'GTA 6ix', 'GTA6ix',
  ].forEach(blurs);
});

test('separators, dots and emoji between the letters', () => {
  ['G.T.A. 6', 'G.T.A 6', 'G T A 6', 'GTA-VI', 'GTA_6', 'GTA🔥6', 'GTA 🔥🔥 VI', 'GTA • 6', 'gta...6', 'GTA:VI'].forEach(blurs);
});

test('leetspeak', () => {
  ['GT4 6', 'GTA V1', 'GTAVl', 'GTA Vl', 'G7A 6', 'gr4nd th3ft aut0 6', 'GT@ VI', 'L3onida'].forEach(blurs);
});

test('fancy unicode and lookalikes', () => {
  [
    '𝐆𝐓𝐀 𝟔', 'ＧＴＡ６', 'GTA Ⅵ', '𝔾𝕋𝔸 𝟞',
    'GТА 6', // cyrillic Т and А
    'Leónida', 'LEONIDA', 'Lucía Caminos',
  ].forEach(blurs);
});

test('hashtags and camelCase', () => {
  ['#GTA6Trailer', '#GTAVILeaks', '#gtavitrailer', '#newgta6', '#LeonidaGov', 'PortGellhorn', '#JasonDuval'].forEach(blurs);
});

test('other languages and scripts', () => {
  [
    '侠盗猎车手6', '俠盜獵車手VI', '侠盗猎车手 6 预告', 'グランド・セフト・オートVI', 'グランドセフトオート6', 'グラセフ6',
    '그랜드 테프트 오토 6', 'ГТА 6', 'ГТА VI вышла', 'гта 6', 'جي تي اي ٦', 'قراند 6', 'जीटीए 6', 'จีทีเอ 6',
    'GTA seis', 'el GTA seis', 'GTA sechs', 'GTA sei', 'GTA altı', 'GTA шесть', '给他爱6',
  ].forEach(blurs);
});

test('characters, places and stuff that is strong on its own', () => {
  [
    'Lucia Caminos', 'jason duval', 'Cal Hampton', 'Boobie Ike', "Dre'Quan Priest", 'DreQuan Priest', 'Real Dimez',
    'Bae-Luxe', 'Bae Luxe', 'Raul Bautista', 'Brian Heder', 'Port Gellhorn', 'Leonida', 'Leonida Keys', 'Grassrivers',
    'Mount Kalaga', 'Vice-Dale County', 'Vice Beach', 'Only Raw Records', 'PTT Youngin$', 'PTT Youngins',
    'Cocoteo FM', 'AfroBank FM', 'Vintage Vice City Pack', 'teapotuberhacker', 'CyberLeek', 'Cyber Leek',
    'Vice City, USA', 'check rockstargames.com/VI for the trailer',
  ].forEach(blurs);
});

test('weak terms need a second clue', () => {
  [
    'Jason and Lucia', "Lucia's new outfit in Vice City", 'Rockstar trailer', 'Rockstar Games just dropped the launch trailer',
    'GTA ending explained', 'GTA leak', 'GTA spoiler', 'Vice City gameplay', 'Love Is a Long Road GTA', 'Boobie and Jason',
    'R* trailer 3', 'Take-Two says the delay is over', 'Jason in Vice City', 'Vice City gameplay', 'GTA Online heists move to Leonida',
    'Lucia + Jason', 'jason & lucia 01',
  ].forEach(blurs);
});

test('one weak term alone stays visible', () => {
  ['Boobie', 'Raul from work says hi', 'Vice City', 'Rockstar', 'GTA', 'rockstar by post malone', 'Ambrosia'].forEach(clean);
});

test('character names do NOT pair with context words (contextIgnores)', () => {
  ["Raul's pizza review", 'Boobie killed it on stage', 'Raul story time'].forEach(clean);
  // ...but names still pair with other weak terms, and franchise words still pair with context
  ['Raul and Boobie', 'GTA review', 'Rockstar story trailer'].forEach(blurs);
});

test('Jason and Lucia block on their own (their call, 2026-10-16), famous Jasons still pass', () => {
  ['Jason', 'Lucia', 'my friend Jason loves pizza', "Lucia's new outfit", '#Jason'].forEach(blurs);
  ['Jason Momoa new trailer', 'Jason Statham movie', 'Saint Lucia travel guide', 'Jasonville'].forEach(clean);
});

test('context words alone, or with each other, stay visible', () => {
  [
    'the trailer for some other game leaked', 'Love Is a Long Road by Tom Petty', 'trailer leak spoiler ending',
    'Elden Ring ending explained', 'full map leak for Hollow Knight', 'PS5 gameplay trailer reveal',
  ].forEach(clean);
});

test('allow terms get cut out first', () => {
  [
    'Jason Momoa trailer', 'GTA V ending explained', 'GTA 5 story mode tips', 'Saint Lucia travel story', 'GTA San Andreas walkthrough',
    'GTA IV ending', 'St. Lucia gameplay of the cricket', 'Jason Statham new trailer', 'Grand Theft Auto V map', 'GTA Five secrets',
  ].forEach(clean);
  ['GTA V vs GTA VI', 'GTA 5 vs GTA 6 graphics', 'Jason Momoa and Jason Duval', 'GTA V1 leak'].forEach(blurs);
});

test('false positives that must not blur', () => {
  [
    '9 7 4 6', 'call 974-6555', '974 6', 'GTA 60fps benchmark', 'Greater Toronto Area (GTA) traffic report', 'I watched Leonidas in 300',
    'the six of us', 'GTA 5 6 7', 'vi editor tips', 'Big tank a 6 wheel drive', 'g t a', 'Port Gellhorny', 'calibrate', 'gta5',
    'sixty six', 'it was the 6th', 'Jason Bourne ending explained', 'the GTA IV map is small',
  ].forEach(clean);
});

test('numerals: 6, VI and six compile to the same thing', () => {
  const c = SS.matcherInternals.termSource;
  assert.equal(c('GTA 6'), c('GTA VI'));
  assert.equal(c('GTA 6'), c('gta six'));
  assert.notEqual(c('GTA 5'), c('GTA V'), 'single-letter romans are not expanded');
  assert.equal(c('trailer 2'), c('trailer II'));
});

test('channels, subreddits, categories, watchlist', () => {
  assert.equal(hit('cool video', { channels: ['TGG'] }).reason, 'channel');
  assert.equal(hit('cool video', { channels: ['@RockstarGames'] }).reason, 'channel');
  assert.equal(hit('cool video', { channels: ['rockstar_games'] }).reason, 'channel');
  assert.equal(hit('hello', { community: 'r/GTA6' }).reason, 'community');
  assert.equal(hit('hello', { community: 'gamingleaksandrumours' }).reason, 'community');
  assert.equal(hit('hello', { community: 'r/gaming' }), null);
  assert.equal(hit('chill stream', { categories: ['Grand Theft Auto VI'] }).reason, 'category');
  assert.equal(hit('chill stream', { categories: ['Minecraft'] }), null);
  assert.equal(hit('just chatting', { channels: ['xQc'], live: true }).reason, 'watchlist');
  assert.equal(hit('just chatting', { channels: ['xQc'], live: false }), null);
});

test('allowed channels never blur', () => {
  const mm = new SS.Matcher([{ ...gta, allowChannels: ['My Buddy'] }]);
  assert.equal(mm.match({ text: 'GTA 6 ending', channels: ['mybuddy'] }), null);
  assert.ok(mm.match({ text: 'GTA 6 ending', channels: ['someone else'] }));
});

test('regex entries with tiers', () => {
  const pack = {
    id: 'rx', name: 'rx',
    regex: [
      { pattern: '\\bhalf[- ]?life\\s*3\\b', tier: 'strong' },
      { pattern: 'gordon', tier: 'weak' },
      { pattern: 'crowbar', tier: 'context' },
      { pattern: '([', tier: 'strong' },
    ],
  };
  const mm = new SS.Matcher([pack]);
  assert.ok(mm.match({ text: 'Half-Life 3 confirmed' }));
  assert.ok(mm.match({ text: 'gordon with a crowbar' }));
  assert.equal(mm.match({ text: 'gordon ramsay' }), null);
  assert.equal(mm.match({ text: 'a crowbar' }), null);
  assert.equal(mm.errors.length, 1, 'broken regex gets reported, not thrown');
});

test('multiple packs: first hit wins and carries its own overlay text', () => {
  const f1 = loadPack('example-f1.json');
  const mm = new SS.Matcher([gta, f1]);
  const r = mm.match({ text: 'Verstappen wins in Monza' });
  assert.equal(r.pack, 'example-f1');
  assert.equal(r.overlayText[0], 'Race result hidden.');
  assert.equal(mm.match({ text: 'GTA 6' }).pack, 'gta6');
  assert.equal(mm.match({ text: 'Norris at the bakery' }), null);
});

test('explain() says what matched', () => {
  const [r] = m.explain('Jason Momoa and Lucia in the GTA trailer');
  assert.deepEqual(r.allowed, ['Jason Momoa']);
  assert.ok(r.strong.includes('Lucia'));
  assert.ok(r.blur);
});

test('the wall character stops matches jumping between blocks of a card', () => {
  const W = SS.text.WALL;
  clean(`GTA${W}6M views`);
  blurs(`GTA 6${W}6M views`);
});

test('fast enough for a big feed', () => {
  const words = 'the a stream video funny cat dog music live new best review 2026 update patch minecraft fortnite valorant clip highlight reaction tier list ranking podcast episode'.split(' ');
  const items = [];
  for (let i = 0; i < 1500; i++) {
    let s = '';
    for (let j = 0; j < 45; j++) s += words[(i * 7 + j * 13) % words.length] + ' ';
    items.push(s + i);
  }
  const fresh = new SS.Matcher([gta]);
  const t0 = performance.now();
  for (const text of items) fresh.match({ text, channels: ['Some Channel'] });
  const ms = performance.now() - t0;
  console.log(`  1500 items x ~300 chars: ${ms.toFixed(1)} ms (${((ms / 1500) * 1000).toFixed(0)} µs/item)`);
  assert.ok(ms < 1500, 'way too slow: ' + ms);
});

test('compiling the whole pack is quick', () => {
  const t0 = performance.now();
  const mm = new SS.Matcher([gta]);
  const ms = performance.now() - t0;
  console.log(`  compile gta6 pack: ${ms.toFixed(1)} ms, counts ${JSON.stringify(mm.packs[0].counts)}`);
  assert.equal(mm.errors.length, 0, mm.errors.join('\n'));
});

test('2026-10-27 additions', () => {
  ['Vice City Takeover tickets', 'Macca & Friends', 'Macca and Friends rerun', 'Mud Dog Mike + Vice City'].forEach(blurs);
  ['Rockstar review embargo lifts', 'GTA review copies are out', 'Delta Dawne on Flash FM'].forEach(blurs);
  ['review copies of the new phone', 'the vault nightclub downtown'].forEach(clean);
});
