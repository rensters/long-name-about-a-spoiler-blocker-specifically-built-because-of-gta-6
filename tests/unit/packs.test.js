const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadPack } = require('./helpers');

const SS = loadLib();
const P = SS.packs;
const gta = loadPack('gta6.json');
const keys = (list) => P.entries(list).map((e) => P.keyOf(e.term)).sort();

test('textarea format round-trips groups', () => {
  const text = P.toLines(gta.strong);
  assert.ok(text.includes('// Characters\nJason Duval'));
  assert.deepEqual(keys(P.fromLines(text)), keys(gta.strong));
  assert.deepEqual(P.fromLines('a\n\n// G\nb\n  c  \n// H\n'), { '': ['a'], G: ['b', 'c'] });
  assert.deepEqual(P.fromLines('x\ny', true), ['x', 'y']);
});

test('regex lines round-trip, broken ones get reported', () => {
  const text = P.regexToLines(gta.regex);
  const back = P.regexFromLines(text);
  assert.equal(back.bad.length, 0);
  assert.deepEqual(back.list.map((r) => r.pattern), gta.regex.map((r) => r.pattern));
  assert.equal(back.list[0].why, gta.regex[0].why);
  const mixed = P.regexFromLines('weak /gordon/i\n/([/\nnot a regex\ncontext /crowbar/');
  assert.deepEqual(mixed.list.map((r) => r.tier), ['weak', 'context']);
  assert.equal(mixed.bad.length, 2);
});

test('diffs: your edits survive and stay small', () => {
  const edited = JSON.parse(JSON.stringify(gta));
  edited.strong = P.groups(edited.strong);
  edited.strong['Added by you'] = ['Some New Character'];
  edited.weak = P.groups(edited.weak);
  edited.weak['Characters'] = edited.weak['Characters'].filter((t) => t !== 'Boobie');
  edited.weak['Characters'].push('Lucia Caminos'); // moved from strong to weak
  edited.strong['Characters'] = edited.strong['Characters'].filter((t) => t !== 'Lucia Caminos');
  edited.overlayText = ['nope'];
  edited.expires = '2027-02-20';
  edited.allow = [...edited.allow, 'GTA Online'];

  const diff = P.makeDiff(gta, edited);
  assert.deepEqual(diff.strong.add, [['Some New Character', 'Added by you']]);
  assert.deepEqual(diff.strong.remove, ['Lucia Caminos']);
  assert.deepEqual(diff.weak.remove, ['Boobie']);
  assert.deepEqual(diff.allow.add, ['GTA Online']);
  assert.deepEqual(diff.set, { expires: '2027-02-20', overlayText: ['nope'] });
  assert.ok(JSON.stringify(diff).length < 400, 'diff should be tiny, not a copy of the pack');

  const back = P.applyDiff(gta, diff);
  for (const k of P.TIERS) assert.deepEqual(keys(back[k]), keys(edited[k]), k);
  assert.deepEqual(back.allow.map(P.keyOf).sort(), edited.allow.map(P.keyOf).sort());
  assert.equal(back.expires, '2027-02-20');
});

test('when the built-in pack gets updated, new names show up and your removals stick', () => {
  const diff = { weak: { add: [], remove: ['Boobie'] }, strong: { add: [['Mine', 'Added by you']], remove: [] } };
  const v2 = JSON.parse(JSON.stringify(gta));
  v2.strong['Characters'].push('Brand New Person');
  const eff = P.applyDiff(v2, diff);
  const strongKeys = keys(eff.strong);
  assert.ok(strongKeys.includes('brand new person'));
  assert.ok(strongKeys.includes('mine'));
  assert.ok(!keys(eff.weak).includes('boobie'));
});

test('validatePack cleans junk and refuses garbage', () => {
  assert.throws(() => P.validatePack(null));
  assert.throws(() => P.validatePack([1, 2]));
  assert.throws(() => P.validatePack({}));
  const { pack, warnings } = P.validatePack({
    name: 'My Show!!',
    strong: ['ok', '', 5, 'x'.repeat(400)],
    weak: { G: ['a', null] },
    regex: [{ pattern: '([' }, { pattern: 'fine', tier: 'weird' }],
    expires: 'next tuesday',
    watchlist: 'not an array',
  });
  assert.equal(pack.id, 'my-show');
  assert.deepEqual(pack.strong, { '': ['ok'] });
  assert.deepEqual(pack.weak, { G: ['a'] });
  assert.deepEqual(pack.regex, [{ pattern: 'fine', flags: 'u', tier: 'strong' }]);
  assert.equal(pack.expires, null);
  assert.deepEqual(pack.watchlist, []);
  assert.deepEqual(pack.overlayText, P.DEFAULT_OVERLAY);
  assert.ok(warnings.length >= 3);
  const huge = { name: 'huge', strong: Array.from({ length: 7000 }, (_, i) => 't' + i) };
  assert.throws(() => P.validatePack(huge), /too many/);
});

test('the shipped packs validate cleanly', () => {
  for (const f of ['gta6.json', 'example-f1.json']) {
    const { warnings } = P.validatePack(loadPack(f));
    assert.deepEqual(warnings, [], f);
  }
});

test('export -> import gives the same pack back', () => {
  const json = P.exportPack({ ...gta, builtin: true });
  const { pack } = P.validatePack(JSON.parse(json));
  for (const k of P.TIERS) assert.deepEqual(keys(pack[k]), keys(gta[k]));
  assert.deepEqual(pack.blockedCommunities, gta.blockedCommunities);
});

test('effective packs: built-ins + diffs + custom, in your order', () => {
  const custom = P.blankPack('Severance');
  custom.strong = { '': ['Lumon'] };
  const eff = P.effectivePacks({ gta6: gta }, {
    diffs: { gta6: { set: { active: false } } },
    custom: { [custom.id]: custom },
    order: [custom.id, 'gta6'],
  });
  assert.deepEqual(eff.map((p) => p.id), ['severance', 'gta6']);
  assert.equal(eff[1].active, false);
  assert.equal(eff[1].builtin, true);
  assert.equal(eff[0].builtin, false);
});

test('expiry is your date, local calendar, with a reminder window', () => {
  const now = new Date(2027, 1, 17, 23, 30).getTime(); // feb 17, 11:30pm local
  const p = { active: true, expires: '2027-02-20', remindDaysBefore: 3 };
  assert.equal(P.daysUntil('2027-02-20', now), 3);
  assert.equal(P.isLive(p, now), true);
  assert.equal(P.expiringSoon(p, now), 3);
  assert.equal(P.expiringSoon({ ...p, remindDaysBefore: 1 }, now), null);
  assert.equal(P.isLive(p, new Date(2027, 1, 20, 0, 1).getTime()), false, 'off on the date itself');
  assert.equal(P.isLive({ active: true, expires: null }, now), true, 'no date = never expires');
  assert.equal(P.isLive({ active: false }, now), false);
});
