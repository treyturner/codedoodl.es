// Compatible with both the legacy Node 10 image and the modern compiled image.
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const [name, port, previewPort, source] = process.argv.slice(2);
const requests = [];
const master = kind => ({ doodles: [{ id: 'test', index: 1, slug: 'test/' + kind }] });
const fixture = http.createServer((req, res) => {
  requests.push(req.url);
  let body;
  if (req.url === '/master_manifest.json') body = master('production');
  else if (req.url === '/master_manifest_DEV.json') body = master('development');
  else if (/^\/test\/(production|development)\/manifest.json$/.test(req.url)) {
    body = { name: 'Container fixture', author: { name: 'Test', github: 'test' }, tags: [] };
  } else { res.writeHead(404); res.end('Unknown fixture'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
  res.end(zlib.gzipSync(JSON.stringify(body)));
});

function listen(server, ...args) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(...args, resolve);
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(1000, () => req.destroy(new Error('HTTP probe timed out')));
  });
}

async function run() {
  let server, cache;
  const deadline = setTimeout(() => { console.error('Container check timed out'); process.exit(1); }, 15000);
  try {
    await listen(fixture, 0, '127.0.0.1');
    // Supply only the deployment-specific origins, leaving production defaults
    // and the PORT/BIND_PORT selection entirely to the built image.
    process.env.DOODLES_URL = 'http://127.0.0.1:' + fixture.address().port;
    process.env.BASE_URL = 'http://127.0.0.1:' + port;
    const root = process.cwd();
    const compiled = fs.existsSync(path.join(root, 'dist/config/server.js'));
    if (!compiled) require(path.join(root, 'node_modules/coffee-script/register'));
    const codeRoot = compiled ? path.join(root, 'dist') : root;
    const config = require(path.join(codeRoot, 'config/server'));
    assert.strictEqual(config.PRODUCTION, true, 'Image must default to production mode');
    assert.strictEqual(config.DOODLE_DATA_SOURCE, source, 'Image archive selection');
    assert.strictEqual(Number(config.express_preview.port), Number(previewPort), 'Preview port precedence');

    // Exercise the shipped HTTP app as one worker. The legacy cluster launcher
    // otherwise forks once per host CPU, regardless of container CPU limits.
    const app = require(path.join(codeRoot, 'app/server'));
    cache = require(path.join(codeRoot, 'app/utils/getDoodleData'));
    if (cache.initialize) await cache.initialize();
    server = http.createServer(app);
    await listen(server, Number(config.express.port), config.express.ip);
    assert.strictEqual(server.address().port, Number(port), 'Application port precedence');
    const origin = 'http://127.0.0.1:' + port;
    const health = await get(origin + '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body, 'OK');
    let data;
    // The legacy app starts listening before its initial asynchronous load ends.
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await get(origin + '/api/doodles');
      assert.strictEqual(response.status, 200);
      data = JSON.parse(response.body);
      if (data.doodles && data.doodles.length) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.deepStrictEqual(data.doodles.map(doodle => doodle.slug), ['test/' + source]);
    const expectedMaster = source === 'production' ? '/master_manifest.json' : '/master_manifest_DEV.json';
    assert.ok(requests.includes(expectedMaster), 'Must fetch the selected remote master');
    assert.ok(!requests.includes(source === 'production' ? '/master_manifest_DEV.json' : '/master_manifest.json'), 'Must not fetch the other master');
    console.log('PASS: ' + name + ' (HTTP port ' + port + ', remote ' + source + ' archive)');
  } finally {
    if (cache && cache.close) cache.close();
    if (server && server.listening) await new Promise(resolve => server.close(resolve));
    if (fixture.listening) await new Promise(resolve => fixture.close(resolve));
    clearTimeout(deadline);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
