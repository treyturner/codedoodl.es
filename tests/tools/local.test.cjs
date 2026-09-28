const { test: nodeTest } = require('node:test');
const test = (name, fn) => nodeTest(name, { timeout: 10000 }, fn);
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, writeFile, mkdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { gzipSync } = require('node:zlib');
const { once } = require('node:events');

const root = resolve(__dirname, '../..');
const answers = ['Shapes <3', 'An Artist', 'test-artist', 'https://example.org', '', 'A local sketch', 'Shapes, bright colors', 'y', 'n', 'y', 'Move around', 'dark', 'n'];
async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'codedoodles-tools-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function run(script, cwd, input, args = [], env = {}) {
  const child = spawn(process.execPath, [join(root, 'utils', script), ...args], { cwd, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => output += data);
  child.stderr.on('data', data => output += data);
  const done = once(child, 'close').then(([code, signal]) => ({ code, signal, output }));
  if (input !== undefined) child.stdin.end(input);
  return { child, done, output: () => output };
}

test('creator writes a complete escaped sketch and refuses to overwrite it', async t => {
  const cwd = await workspace(t);
  const input = answers.join('\n') + '\n';
  const first = await run('createDoodle.js', cwd, input).done;
  assert.equal(first.code, 0, first.output);
  const directory = join(cwd, 'doodles/test-artist/shapes-3');
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json')));
  assert.equal(manifest.slug, 'test-artist/shapes-3');
  assert.deepEqual(manifest.tags, ['shapes', 'bright-colors']);
  assert.deepEqual(manifest.interaction, { mouse: true, keyboard: false, touch: true });
  assert.equal(manifest.mobile_friendly, false);
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  assert.match(html, /Shapes &lt;3 \| An Artist/);
  await writeFile(join(directory, 'index.html'), 'KEEP MY ART');
  const second = await run('createDoodle.js', cwd, input).done;
  assert.equal(second.code, 1);
  assert.match(second.output, /already exists/);
  assert.equal(await readFile(join(directory, 'index.html'), 'utf8'), 'KEEP MY ART');
});

test('creator retries invalid input and reports incomplete piped input without writing', async t => {
  const cwd = await workspace(t);
  const input = [...answers.slice(0, 3), 'javascript:alert(1)', ...answers.slice(3)].join('\n') + '\n';
  const result = await run('createDoodle.js', cwd, input).done;
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /absolute HTTP or HTTPS URL/);
  const empty = await workspace(t);
  const incomplete = await run('createDoodle.js', empty, 'Partial\n').done;
  assert.equal(incomplete.code, 1);
  assert.match(incomplete.output, /Input ended/);
  await assert.rejects(readFile(join(empty, 'doodles/manifest.json')), { code: 'ENOENT' });
});

async function preview(t, cwd, env = {}) {
  const process = run('previewPR.js', cwd, undefined, [cwd], { BIND_PORT: '0', PORT: 'invalid', BIND_ADDRESS: '127.0.0.1', ...env });
  t.after(() => { if (process.child.exitCode === null) process.child.kill('SIGTERM'); });
  const deadline = Date.now() + 5000;
  while (!process.output().match(/http:\/\/127.0.0.1:\d+\//)) {
    if (Date.now() > deadline || process.child.exitCode !== null) throw new Error(process.output());
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return { ...process, url: process.output().match(/http:\/\/127.0.0.1:\d+\//)[0] };
}

test('preview serves gzip archive entries, byte ranges and clean missing responses', async t => {
  const cwd = await workspace(t);
  const html = '<!doctype html><title>Archive</title>';
  const bytes = gzipSync(html);
  await writeFile(join(cwd, 'index.html'), bytes);
  await writeFile(join(cwd, 'thumb.webm'), '0123456789');
  await mkdir(join(cwd, 'nested'));
  await writeFile(join(cwd, 'nested/index.html'), bytes);
  const server = await preview(t, cwd);
  const index = await fetch(server.url);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.equal(index.headers.get('content-encoding'), 'gzip');
  assert.equal(await index.text(), html);
  assert.equal(await (await fetch(server.url + 'nested/?example=1')).text(), html);
  const identity = await fetch(server.url, { headers: { 'accept-encoding': 'identity' } });
  assert.equal(identity.headers.get('content-encoding'), null);
  assert.equal(await identity.text(), html);
  const range = await fetch(server.url + 'thumb.webm', { headers: { range: 'bytes=2-5' } });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), '2345');
  const missing = await fetch(server.url + 'missing.js');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('content-encoding'), null);
  server.child.stdin.write('exit\n');
  assert.equal((await server.done).code, 0);
  assert.deepEqual(await readFile(join(cwd, 'index.html')), bytes);
});

test('preview honors PORT, serves newly created plain HTML and handles SIGTERM', async t => {
  const cwd = await workspace(t);
  await writeFile(join(cwd, 'index.html'), '<title>New sketch</title>');
  const server = await preview(t, cwd, { BIND_PORT: '', PORT: '0' });
  assert.notEqual(new URL(server.url).port, '3001', 'PORT=0 must request an available port instead of the default');
  assert.equal(await (await fetch(server.url)).text(), '<title>New sketch</title>');
  server.child.kill('SIGTERM');
  assert.equal((await server.done).code, 0);
});

test('preview rejects missing inputs and invalid ports', async t => {
  const cwd = await workspace(t);
  const usage = await run('previewPR.js', cwd, '').done;
  assert.equal(usage.code, 1);
  assert.match(usage.output, /Usage:/);
  const missing = await run('previewPR.js', cwd, '', [cwd]).done;
  assert.equal(missing.code, 1);
  await writeFile(join(cwd, 'index.html'), 'hello');
  const invalid = await run('previewPR.js', cwd, '', [cwd], { BIND_PORT: 'bad' }).done;
  assert.equal(invalid.code, 1);
  assert.match(invalid.output, /BIND_PORT/);
});
