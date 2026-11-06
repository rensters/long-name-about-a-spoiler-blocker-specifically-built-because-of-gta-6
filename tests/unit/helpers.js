// loads the browser-style lib files into node in the same order the manifest does
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function loadLib() {
  for (const f of ['shim.js', 'normalize.js', 'matcher.js', 'packs.js', 'store.js']) {
    const p = path.join(ROOT, 'src', 'lib', f);
    if (fs.existsSync(p)) require(p);
  }
  return globalThis.NoSpoil;
}

function loadPack(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', name), 'utf8'));
}

module.exports = { ROOT, loadLib, loadPack };
