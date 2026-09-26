const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, silent } = require('./fixture.cjs');
const createCache = require('../../app/utils/doodleCache');

function cacheFor(t, data, overrides = {}) {
  const cache = createCache({ ...data, production: true, dataSource: 'production', logger: silent, timeout: 2000, ...overrides });
  t.after(() => cache.close());
  return cache;
}

test('cold initialization coalesces, limits concurrency, decodes gzip and preserves ordering/contributors', async t => {
  const data = await fixture(t, 12);
  data.state.delay = 15;
  const cache = cacheFor(t, data, { concurrency: 3 });
  assert.throws(() => cache.getDoodles(), /not initialized/);
  const first = cache.initialize();
  assert.equal(cache.initialize(), first);
  const { doodles, contributors } = await first;
  assert.equal(data.state.requests.filter(path => path === '/master_manifest.json').length, 1);
  assert.equal(data.state.maximum, 3);
  assert.deepEqual(doodles.map(d => d.index), Array.from({ length: 12 }, (_, i) => 12 - i));
  assert.deepEqual(contributors.map(a => a.github), ['artist0', 'artist1']);
  assert.equal(cache.getDoodles(), doodles);
});

for (const mode of ['404', 'invalid', 'shape', 'timeout', 'body-timeout']) {
  test(`cold ${mode} master falls back locally; failed refresh retains successful data`, async t => {
    const data = await fixture(t);
    data.state.mode = mode;
    const cache = cacheFor(t, data, { timeout: 150 });
    await cache.initialize();
    const original = cache.getDoodles();
    assert.equal(original.length, 5);
    assert.ok(original.every(doodle => doodle.created === 'local-fallback'));
    await assert.rejects(cache.refresh());
    assert.equal(cache.getDoodles(), original);
    data.state.mode = 'ok';
    await cache.refresh();
    assert.ok(cache.getDoodles().every(doodle => doodle.created === 'original'));
  });
}

test('stale reads retain the snapshot, share one refresh and update both APIs atomically', async t => {
  const data = await fixture(t);
  let clock = 0;
  const cache = cacheFor(t, data, { ttl: 50, now: () => clock });
  await cache.initialize();
  const original = cache.getDoodles();
  const contributors = cache.getContributors();
  const before = data.state.requests.length;
  data.state.delay = 20;
  data.state.manifests['artist/sketch-4'].author = { name: 'Updated', github: 'updated' };
  clock = 51;
  for (let i = 0; i < 10; i++) {
    assert.equal(cache.getDoodles(), original);
    assert.equal(cache.getContributors(), contributors);
  }
  await cache.refresh();
  assert.equal(data.state.requests.length - before, 6);
  assert.equal(cache.getDoodles()[0].author.github, 'updated');
  assert.equal(cache.getContributors()[0].github, 'updated');
});

test('missing or malformed individual manifests are skipped on cold start, never erase known-good data', async t => {
  const data = await fixture(t);
  data.state.missing.add('artist/sketch-0');
  data.state.invalid.add('artist/sketch-1');
  const cache = cacheFor(t, data);
  await cache.initialize();
  assert.deepEqual(cache.getDoodles().map(d => d.index), [5, 4, 3]);
  const original = cache.getDoodles();
  data.state.missing.add('artist/sketch-2');
  await assert.rejects(cache.refresh(), /previously available/);
  assert.equal(cache.getDoodles(), original);
});

test('valid empty masters initialize and refresh without hanging or fetching individuals', async t => {
  const data = await fixture(t, 0);
  const cache = cacheFor(t, data);
  await cache.initialize();
  assert.deepEqual(cache.getDoodles(), []);
  assert.deepEqual(cache.getContributors(), []);
  await cache.refresh();
  assert.deepEqual(data.state.requests, ['/master_manifest.json', '/master_manifest.json']);
});

test('complete individual-manifest outage rejects initialization and can recover', async t => {
  const data = await fixture(t);
  data.state.missing = new Set(Object.keys(data.state.manifests));
  const cache = cacheFor(t, data);
  await assert.rejects(cache.initialize(), /No individual/);
  assert.throws(() => cache.getDoodles(), /not initialized/);
  data.state.missing.clear();
  await cache.initialize();
  assert.equal(cache.getDoodles().length, 5);
  data.state.master = { doodles: [] };
  await cache.refresh();
  assert.deepEqual(cache.getDoodles(), [], 'An intentionally empty master replaces old data');
});

test('development uses local manifests; production preview selects the remote DEV master', async t => {
  const data = await fixture(t);
  const local = cacheFor(t, data, { production: false });
  await local.initialize();
  assert.equal(local.getDoodles().length, 5);
  assert.equal(data.state.requests.length, 0);
  const preview = cacheFor(t, data, { dataSource: 'development' });
  await preview.initialize();
  assert.equal(data.state.requests[0], '/master_manifest_DEV.json');
});

test('shutdown aborts a pending fetch promptly and prevents further refreshes', async t => {
  const data = await fixture(t);
  data.state.mode = 'timeout';
  const cache = cacheFor(t, data, { timeout: 10000 });
  const pending = cache.initialize();
  cache.close();
  await assert.rejects(pending);
  await assert.rejects(cache.refresh(), /closed/);
});
