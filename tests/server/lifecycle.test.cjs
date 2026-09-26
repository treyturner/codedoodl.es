const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { fixture } = require('./fixture.cjs');

function launch(t, env, code) {
  const child = spawn(process.execPath, code ? ['-e', code] : ['app/start.cjs'], {
    env: { ...process.env, NODE_ENV: 'production', BIND_ADDRESS: '127.0.0.1', BIND_PORT: '0',
      DEV_PASSWORD: '', DOODLE_DATA_SOURCE: 'production', DOODLE_FETCH_TIMEOUT_MS: '2000', ...env },
  });
  let log = '';
  child.stdout.on('data', bytes => { log += bytes; });
  child.stderr.on('data', bytes => { log += bytes; });
  const exited = once(child, 'exit');
  const deadline = setTimeout(() => child.kill('SIGKILL'), 15000);
  child.once('exit', () => clearTimeout(deadline));
  t.after(async () => { if (child.exitCode === null && !child.signalCode) child.kill('SIGTERM'); await exited; });
  return { child, exited, log: () => log };
}

async function until(predicate, child) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert.equal(child.child.exitCode, null, child.log());
    assert.ok(Date.now() < deadline, child.log());
    await delay(10);
  }
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`production waits for initialized data and exits cleanly on ${signal}`, async t => {
    const data = await fixture(t, 3);
    data.state.delay = 30;
    const process = launch(t, { DOODLES_URL: data.baseUrl });
    await until(() => process.log().includes('express is listening on'), process);
    const port = process.log().match(/listening on 127\.0\.0\.1:(\d+)/)[1];
    assert.ok(process.log().indexOf('Doodle cache ready') < process.log().indexOf('express is listening on'));
    const response = await fetch(`http://127.0.0.1:${port}/api/doodles`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).doodles.length, 3);
    process.child.kill(signal);
    assert.deepEqual(await process.exited, [0, null], process.log());
    assert.match(process.log(), /HTTP server stopped/);
  });
}

test('a complete cold-start outage exits nonzero instead of advertising a healthy empty site', async t => {
  const data = await fixture(t, 2);
  data.state.missing = new Set(Object.keys(data.state.manifests));
  const process = launch(t, { DOODLES_URL: data.baseUrl });
  assert.deepEqual(await process.exited, [1, null], process.log());
  assert.match(process.log(), /Server startup failed/);
  assert.ok(!process.log().includes('express is listening on'));
});

test('SIGTERM during startup cancels a stalled upstream request without waiting for its timeout', async t => {
  const data = await fixture(t);
  data.state.mode = 'timeout';
  const process = launch(t, { DOODLES_URL: data.baseUrl, DOODLE_FETCH_TIMEOUT_MS: '10000' });
  await until(() => data.state.requests.length > 0, process);
  const start = Date.now();
  process.child.kill('SIGTERM');
  assert.deepEqual(await process.exited, [0, null], process.log());
  assert.ok(Date.now() - start < 2000, process.log());
});

test('shutdown lets an active HTTP response finish', async t => {
  const modulePath = JSON.stringify(resolve('app/utils/serverLifecycle.js'));
  const process = launch(t, {}, `
    const start = require(${modulePath});
    const logger = { info: message => console.log(message), error: message => console.log(message), end() {} };
    start((request, response) => {
      console.log('request-started');
      setTimeout(() => response.end('complete'), 250);
    }, { initialize: async () => {}, close() {} }, { port: 0, ip: '127.0.0.1' }, logger);
  `);
  await until(() => process.log().includes('express is listening on'), process);
  const port = process.log().match(/listening on 127\.0\.0\.1:(\d+)/)[1];
  const response = fetch(`http://127.0.0.1:${port}/`).then(result => result.text());
  await until(() => process.log().includes('request-started'), process);
  process.child.kill('SIGTERM');
  assert.equal(await response, 'complete');
  assert.deepEqual(await process.exited, [0, null], process.log());
});
