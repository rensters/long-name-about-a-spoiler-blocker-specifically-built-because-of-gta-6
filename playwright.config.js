// e2e: real chromium, real unpacked extension, fake sites. see tests/e2e/harness.js
module.exports = {
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1, // one persistent profile per test, extensions don't love sharing
  retries: 0,
  reporter: [['list']],
};
