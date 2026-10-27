// npm run package -> two store-ready zips in dist/:
//   spoiler-shield-chrome-<v>.zip   Chrome Web Store (also Brave/Edge/Opera/Vivaldi, Kiwi-style android)
//   spoiler-shield-firefox-<v>.zip  addons.mozilla.org (desktop + android)
// same code in both, only the manifest differs. the dev manifest has BOTH background styles so the
// folder loads unpacked anywhere, but the stores whine about the key meant for the other browser
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SHIP = ['manifest.json', 'UNLICENSE', 'src', 'packs', 'icons'];
const SKIP = new Set(['icon-256.png', 'icon.svg']); // source art, not needed at runtime

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
    delete m.browser_specific_settings;
    return m;
  },
  firefox(m) {
    m.background = { scripts: m.background.scripts };
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
  const file = `spoiler-shield-${name}-${base.version}.zip`;
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'web-ext', 'bin', 'web-ext.js'), 'build', '--source-dir', dir, '--artifacts-dir', DIST, '--filename', file, '--overwrite-dest'], { stdio: 'ignore' });
  console.log('built dist/' + file);
}
