// this test exists because a single invisible U+FFFF character in store.js made chrome refuse to
// load the ENTIRE extension, with zero error message. took way too long to find. never again
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|css|html|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

// chrome's UTF-8 check rejects noncharacters; raw control chars and invisible separators are just
// asking for trouble. they belong in source as escape sequences, never as the actual character.
// (built from code points on purpose so this file can't contain the junk it hunts for)
const RANGES = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x200b, 0x200f], [0x2028, 0x2029], [0x2063, 0x2063], [0xfdd0, 0xfdef], [0xfffe, 0xffff]];
const isBad = (cp) => RANGES.some(([a, b]) => cp >= a && cp <= b);

test('no invisible / non-character junk in shipped files', () => {
  const files = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'manifest.json'), ...walk(path.join(ROOT, 'packs'))];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert.notEqual(text.charCodeAt(0), 0xfeff, `${path.relative(ROOT, f)} starts with a BOM`);
    for (let i = 0; i < text.length; i++) {
      const cp = text.charCodeAt(i);
      if (isBad(cp)) assert.fail(`${path.relative(ROOT, f)} has U+${cp.toString(16).toUpperCase().padStart(4, '0')} at index ${i}`);
    }
  }
});

test('every file the manifest mentions exists', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const files = new Set([m.background.service_worker, ...m.background.scripts, m.action.default_popup, m.options_ui.page]);
  for (const cs of m.content_scripts) for (const f of [...(cs.js || []), ...(cs.css || [])]) files.add(f);
  for (const f of Object.values(m.icons)) files.add(f);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), 'missing ' + f);
});

test('every site module in src/sites is loaded by the manifest', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const loaded = new Set(m.content_scripts[0].js);
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'sites'))) {
    assert.ok(loaded.has('src/sites/' + f), `src/sites/${f} isn't in manifest content_scripts`);
  }
});
