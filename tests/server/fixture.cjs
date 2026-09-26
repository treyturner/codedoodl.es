const { createServer } = require('node:http');
const { once } = require('node:events');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { gzipSync } = require('node:zlib');
const { setTimeout: delay } = require('node:timers/promises');

exports.fixture = async function fixture(t, count = 5) {
  await mkdir('temp', { recursive: true });
  const directory = await mkdtemp(resolve('temp/cache-test-'));
  const master = { doodles: Array.from({ length: count }, (_, i) => ({ id: `id${i}`, index: i + 1, slug: `artist/sketch-${i}`, created: 'original' })) };
  const manifests = Object.fromEntries(master.doodles.map(entry => [entry.slug, {
    name: entry.slug, author: { github: `artist${entry.index % 2}`, name: 'Artist' }, tags: [], description: 'Sketch',
  }]));
  const state = { master, manifests, mode: 'ok', missing: new Set(), invalid: new Set(), requests: [], active: 0, maximum: 0, delay: 0 };
  await writeFile(join(directory, 'master_manifest_DEV.json'), JSON.stringify({ doodles: master.doodles.map(entry => ({ ...entry, created: 'local-fallback' })) }));
  for (const [slug, value] of Object.entries(manifests)) {
    await mkdir(join(directory, slug), { recursive: true });
    await writeFile(join(directory, slug, 'manifest.json'), JSON.stringify(value));
  }
  const server = createServer(async (request, response) => {
    state.requests.push(request.url);
    if (/^\/master_manifest/.test(request.url)) {
      if (state.mode === '404') { response.writeHead(404); return response.end('missing'); }
      if (state.mode === 'invalid') return response.end('{bad');
      if (state.mode === 'shape') return response.end('{"doodles":null}');
      if (state.mode === 'timeout') return;
      if (state.mode === 'body-timeout') { response.writeHead(200); response.write('{'); return; }
      response.setHeader('Content-Encoding', 'gzip');
      response.setHeader('Content-Type', 'application/json');
      return response.end(gzipSync(JSON.stringify(state.master)));
    }
    const slug = request.url.slice(1).replace(/\/manifest.json$/, '');
    state.maximum = Math.max(state.maximum, ++state.active);
    await delay(state.delay);
    state.active--;
    if (state.missing.has(slug) || !state.manifests[slug]) { response.writeHead(404); return response.end('missing'); }
    if (state.invalid.has(slug)) return response.end('{bad');
    response.setHeader('Content-Encoding', 'gzip');
    response.end(gzipSync(JSON.stringify(state.manifests[slug])));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
    await rm(directory, { recursive: true, force: true });
  });
  return { state, directory, baseUrl: `http://127.0.0.1:${server.address().port}` };
};
exports.silent = { info() {}, warn() {}, error() {} };
