// launch day tests (2026-11-19). the kick leak, spelling variants, the launch-week bare "gta" rule, url blocks,
// the secret spoiler groups. hidden terms are only ever checked by COUNT here, never by name. ren hasn't played it
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadPack } = require('./helpers');

const SS = loadLib();
// the sites registry is a content-side file but it's plain js, so node can load it too
require('../../src/sites/_registry.js');
const gta = loadPack('gta6.json');
const LAUNCH = new Date('2026-11-19T15:00:00').getTime();
const LATER = new Date('2027-02-01T15:00:00').getTime();
const m = new SS.Matcher([gta], { now: LAUNCH });
const after = new Matcher2();
function Matcher2() {
  return new SS.Matcher([gta], { now: LATER });
}

const hit = (text, extra, mm) => (mm || m).match({ text, ...extra });
const blurs = (t, extra) => assert.ok(hit(t, extra), `should blur: ${JSON.stringify(t)}`);
const clean = (t, extra, mm) => assert.equal(hit(t, extra, mm), null, `should NOT blur: ${JSON.stringify(t)} -> ${JSON.stringify(hit(t, extra, mm))}`);
const T = SS.text;

test('normalize: zero-width junk + keycaps go away, non-latin letters stay', () => {
  assert.equal(T.normalize('gta​6'), 'gta6');
  assert.equal(T.normalize('g‍t﻿a⁠ 6'), 'gta 6');
  assert.equal(T.normalize('gta 6️⃣'), 'gta 6');
  assert.equal(T.normalize('ＧＴＡ６'), 'gta6');
  assert.equal(T.normalize('GТА 6'), 'gta 6'); // cyrillic Т А
  assert.equal(T.flat('ГТА 6!!'), ' гta 6 '); // the lookalike Т А fold to latin, the real-cyrillic Г stays. the !! goes
  assert.equal(T.flat('侠盗猎车手6'), ' 侠盗猎车手6 ');
});

test('flat + squashed copies', () => {
  assert.equal(T.flat('🔴live: gta 6 full playthrough🔴'), ' live gta 6 full playthrough ');
  assert.equal(T.flat('  a   b  '), ' a b ');
  const [b] = T.squashed('g.t.a.6');
  assert.equal(b.text, 'gta6');
  assert.deepEqual([...b.cuts], [0, 1, 2, 3, 4]);
  assert.equal(T.squashed('ok ⁣ 6m views').length, 2, 'walls split blocks');
});

test('the exact leaked kick card blurs', () => {
  const card = { text: '🔴live: gta 6 full playthrough🔴⁣ohnepixel⁣✔⁣3K watching', channels: ['ohnepixel'], live: true, video: true };
  assert.ok(m.match(card));
  assert.ok(after.match(card), 'still blurs after launch week, "gta 6" is strong forever');
});

test('every launch-day spelling variant blurs', () => {
  ['gta6', 'gta-6', 'g t a 6', 'g.t.a 6', 'g.t.a.6', 'gta 6️⃣', 'ＧＴＡ６', 'gta Ⅵ', 'gtavl', 'gtav1', 'gta 6ix',
    'gta six', 'gta​6', 'GТА 6', '#GTA6Launch', '#GTA6Live', '#GTA6Gameplay', '#GrandTheftAutoVI', '#JasonAndLucia',
    'G T A 6 live', 'g_t_a_6'].forEach((t) => blurs(t));
});

test('characters + places from the launch list', () => {
  ['Cal Hampton', 'Boobie Ike', "Dre'Quan Priest", 'Raul Bautista', 'Brian Heder', 'Bae-Luxe', 'Real Dimez', 'Only Raw',
    'Leonida Everglades', 'Lake Leonida', 'Tisha-Wocka', 'VC Port'].forEach((t) => blurs(t));
  // weak places need a buddy
  clean('Little Haiti food tour');
  blurs('Little Haiti in GTA');
});

test('false positives stay visible, even during launch week on live cards', () => {
  for (const extra of [{}, { live: true, video: true }]) {
    clean('gta rp nopixel', extra);
    clean('GTA V speedrun', extra);
    clean('GTA 5 online heist', extra);
    clean('GTA San Andreas full playthrough', extra);
    clean('GTA Vice City Stories day 1', extra);
  }
  clean('omega 6 fish oil');
  clean('call 9746 now');
  clean('pigtail6 hairstyle');
});

test('jason + lucia stay strong on their own (ren picked this on 2026-10-16, re-confirmed on launch day)', () => {
  blurs("Jason's birthday");
  blurs("Lucia's bakery");
});

test('launch week: bare "gta" on live cards + video titles is strong, but only in the window', () => {
  blurs('gta full playthrough', { live: true });
  blurs('first time playing gta!!', { video: true });
  clean('gta tier list', {}); // not a live card or video title: needs the usual clues
  clean('gta tier list', { live: true }, after);
  blurs('gta tier list', { live: true });
  clean('gta rp nopixel', { live: true });
});

test('launch watchlist: live streams from these folks blur until 2027-01-15', () => {
  assert.ok(m.match({ text: 'just chatting', channels: ['ohnepixel'], live: true }));
  assert.equal(after.match({ text: 'just chatting', channels: ['ohnepixel'], live: true }), null);
  assert.ok(after.match({ text: 'just chatting', channels: ['xQc'], live: true }), 'the normal watchlist never expires');
  assert.equal(m.match({ text: 'just chatting', channels: ['ohnepixel'], live: false }), null, 'only live');
});

test('international + post-launch phrases: blur next to a GTA term, never alone', () => {
  ['GTA 6 jugando en vivo', 'GTA zerando ao vivo', 'GTA tamat bahasa indonesia', 'GTA lets play deutsch', 'GTA walkthrough', 'GTA money glitch',
    'GTA 6 bugs', 'GTA 6 patch notes', 'GTA Online 2 announced', 'GTA 6 vs RDR2', 'GTA spoilers', 'spoilers: gta', 'Vice City walkthrough',
    'gta criminal profile quiz'].forEach((t) => blurs(t));
  ['jugando en vivo minecraft', 'zerando elden ring ao vivo', 'elden ring walkthrough guide', 'money glitch in some other game',
    'criminal profile of a serial killer', 'GTA V spoilers', 'best cars guide 2026', 'peak viewers record for a football match'].forEach((t) => clean(t));
});

test('other scripts: title variants blur', () => {
  ['ГТА 6', 'ГТА VI', 'グラセフ6', 'グランド・セフト・オートVI',
    '그랜드 테프트 오토 6', '지티에이 6', '侠盗猎车手6', '俠盜獵車手6',
    'جي تي اي 6', 'जीटीए 6', 'จีทีเอ 6'].forEach((t) => blurs(t));
});

test('blocked urls + slug blocks', () => {
  const u = (s) => new URL(s);
  assert.ok(m.urlHit(u('https://www.powerpyx.com/gta-6-walkthrough/')));
  assert.ok(m.urlHit(u('https://gtabase.com/anything')));
  assert.ok(m.urlHit(u('https://gta.fandom.com/wiki/Grand_Theft_Auto_VI')));
  assert.equal(m.urlHit(u('https://gta.fandom.com/wiki/Vice_City_Stories')), null, 'path is case sensitive, Vice != VI');
  assert.equal(m.urlHit(u('https://www.powerpyx.com/elden-ring-walkthrough/')), null);
  const kick = SS.sites.byId('kick') || { slugBlock: true };
  assert.ok(SS.sites.slugHit(u('https://kick.com/video/gta-6-day-1'), { slugBlock: true }));
  assert.ok(SS.sites.slugHit(u('https://someblog.com/guides/gta6-missions'), null), 'guide-ish url anywhere');
  assert.equal(SS.sites.slugHit(u('https://someblog.com/news/gta-6-pc-date'), null), null, 'plain news is not a guide');
  assert.equal(SS.sites.slugHit(u('https://kick.com/gta6fan'), kick), null, 'gta6fan is not a gta6 slug piece');
  assert.deepEqual(SS.sites.slugWords('https://cdn.x/thumbs/gta-6-launch_stream.jpg'), ['gta 6']);
});

test('subreddits from the launch list', () => {
  for (const r of ['GTA6', 'GTAVI', 'GTA6Leaks', 'GTA6memes', 'RockstarGames', 'GTAVIOnline']) assert.ok(m.listHit('community', r), r);
});

test('hidden "(spoilers)" groups: matched, but never shown (checked by count only)', () => {
  const secret = ['zzqx alpha one', 'zzqx beta two', 'zzqx gamma three'];
  const pack = { ...gta, strong: { ...gta.strong, 'post-launch (spoilers)': secret }, weak: { ...gta.weak, 'post-launch (spoilers)': ['zzqx delta'] } };
  const mm = new SS.Matcher([pack], { now: LAUNCH });
  const hidden = mm.packs[0].strong.list.filter((e) => e.hidden);
  assert.equal(hidden.length, secret.length, `all ${secret.length} hidden strong terms load`);
  for (const t of secret) {
    const r = mm.match({ text: 'lol ' + t });
    assert.ok(r, 'hidden term blurs');
    assert.deepEqual(r.terms, [SS.matcherInternals.MASK], 'and shows up as dots, not the word');
  }
  const ex = mm.explain('lol ' + secret[0])[0];
  assert.ok(ex.strong.every((x) => x === SS.matcherInternals.MASK));
  assert.ok(SS.packs.isHiddenGroup('post-launch (spoilers)'));
  assert.ok(!SS.packs.isHiddenGroup('Characters'));
  // whatever hidden groups the real pack has (maybe none yet): every one of them compiles
  let n = 0;
  for (const tier of ['strong', 'weak']) for (const [g, terms] of Object.entries(gta[tier])) if (SS.packs.isHiddenGroup(g)) n += terms.length;
  const compiled = m.packs[0].strong.list.concat(m.packs[0].wc.list).filter((e) => e.hidden).length;
  assert.ok(compiled <= n && (n === 0 || compiled > 0), `hidden terms in pack: ${n}, compiled: ${compiled}`);
});

test('pack plumbing keeps the new fields', () => {
  const { pack } = SS.packs.validatePack(gta);
  assert.equal(pack.launchWatchlistUntil, '2027-01-15');
  assert.ok(pack.launchWatchlist.includes('ohnepixel'));
  assert.ok(pack.blockedUrls.length >= 15);
  const diff = SS.packs.makeDiff(gta, { ...gta, launchWatchlist: [...gta.launchWatchlist, 'someone new'] });
  assert.deepEqual(diff.launchWatchlist.add, ['someone new']);
  assert.ok(SS.packs.applyDiff(gta, diff).launchWatchlist.includes('someone new'));
});
