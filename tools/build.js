// hey, this makes the zips. npm run package -> two store-ready zips in dist/:
//   <name>-chrome-<v>.zip   Chrome Web Store (also Brave/Edge/Opera/Vivaldi, Kiwi-style android)
//   <name>-firefox-<v>.zip  addons.mozilla.org (desktop + android)
// same code in both, only the manifest differs. the dev manifest has BOTH background styles so the
// folder loads unpacked anywhere, but the stores whine about the key meant for the other browser
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SHIP = ['manifest.json', 'UNLICENSE', 'src', 'packs', 'icons'];
const STORE_NAME = 'no spoil gta 6 pls'; // what both stores show. the full name lives in the UI + README
const SKIP = new Set(['icon-256.png', 'source']); // source art, not needed at runtime

function copy(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) if (!SKIP.has(name)) copy(path.join(from, name), path.join(to, name));
  } else fs.copyFileSync(from, to);
}

const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const targets = {
  chrome(m) {
    m.background = { service_worker: m.background.service_worker };
    m.name = STORE_NAME;
    m.action.default_title = STORE_NAME;
    delete m.browser_specific_settings;
    return m;
  },
  firefox(m) {
    m.background = { scripts: m.background.scripts };
    // firefox caps names at 45 chars (the full name is 55), so the stores get the short one
    m.name = STORE_NAME;
    m.action.default_title = STORE_NAME;
    return m;
  },
};

fs.mkdirSync(DIST, { recursive: true });
for (const [name, tweak] of Object.entries(targets)) {
  const dir = path.join(DIST, 'build-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of SHIP) copy(path.join(ROOT, f), path.join(dir, f));
  const m = tweak(JSON.parse(JSON.stringify(base)));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  const file = `${require('../package.json').name}-${name}-${base.version}.zip`;
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'web-ext', 'bin', 'web-ext.js'), 'build', '--source-dir', dir, '--artifacts-dir', DIST, '--filename', file, '--overwrite-dest'], { stdio: 'ignore' });
  console.log('built dist/' + file);
}
