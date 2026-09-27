import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { checkDevelopment } from './check-development.mjs';

// Exercise the real CLI in a disposable source tree, never edit user sources.
const root = process.cwd();
await mkdir('temp', { recursive: true });
const work = await mkdtemp(resolve('temp/build-check-'));
const gulp = resolve('node_modules/gulp/bin/gulp.js');
let watcher;
let watchLog = '';

async function runBuild(success = true) {
  const child = spawn(process.execPath, [gulp, 'build'], { cwd: work });
  let log = '';
  child.stdout.on('data', bytes => { log += bytes; });
  child.stderr.on('data', bytes => { log += bytes; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  if (success) assert.equal(code, 0, log);
  else assert.notEqual(code, 0, 'Invalid source must fail the build');
  return log;
}

async function digestTree(directory) {
  const output = {};
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const filename = join(path, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else output[filename.slice(directory.length + 1)] = createHash('sha256').update(await readFile(filename)).digest('hex');
    }
  }
  await walk(directory);
  return output;
}

async function manifest() { return JSON.parse(await readFile(join(work, 'rev-manifest.json'))); }
async function decoded(asset) {
  const names = await manifest();
  return gunzipSync(await readFile(join(work, 'app/public', names[asset]))).toString();
}

async function until(predicate, description) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (watcher && watcher.exitCode !== null) throw new Error(`Watcher exited: ${watchLog}`);
    try { if (await predicate()) return; } catch { /* A rebuild temporarily removes outputs. */ }
    await delay(100);
  }
  throw new Error(`Timed out: ${description}\n${watchLog}`);
}

try {
  for (const path of ['package.json', 'gulpfile.mjs', 'build', 'project', 'app', 'config', 'doodles']) {
    await cp(join(root, path), join(work, path), { recursive: true });
  }
  await symlink(resolve('node_modules'), join(work, 'node_modules'), 'dir');
  await runBuild();
  const first = await digestTree(join(work, 'app/public'));
  const compiled = await digestTree(join(work, 'dist'));
  assert.ok(!Object.keys(compiled).some(path => path.endsWith('.coffee')), 'Runtime contains only compiled code');
  assert.ok(compiled['app/main.js'] && compiled['config/server.js']);
  const license = await readFile(join(work, 'app/public/static/licenses/browser.txt'), 'utf8');
  for (const name of ['jQuery', 'Underscore', 'Backbone', 'GSAP 3.15.0', 'Charles Davison']) {
    assert.ok(license.includes(name), `Retain browser license notice: ${name}`);
  }
  assert.ok((await decoded('js/vendor/v.js')).includes('@license Copyright 2008-2026, GreenSock'));
  const names = await manifest();
  assert.ok(Object.keys(names).length >= 7);
  for (const [logical, revised] of Object.entries(names)) {
    const bytes = await readFile(join(work, 'app/public', revised));
    assert.equal(bytes.subarray(0, 2).toString('hex'), '1f8b', logical);
    assert.notEqual(gunzipSync(bytes).subarray(0, 2).toString('hex'), '1f8b', logical);
    if (logical.startsWith('data/') && logical.endsWith('.json')) {
      assert.deepEqual(JSON.parse(gunzipSync(bytes)),
        JSON.parse(await readFile(join(work, 'project', logical))), 'Preserve JSON string contents');
    }
  }
  for (const page of ['index', 'holding', 'login']) {
    const source = await readFile(join(work, `project/html/${page}.html`), 'utf8');
    const rendered = await readFile(join(work, `app/site/${page}.html`), 'utf8');
    for (const match of source.matchAll(/\{\{ ([^{}]+) \}\}/g)) {
      assert.ok(names[match[1]], match[1]);
      assert.ok(rendered.includes(names[match[1]]), match[1]);
    }
    assert.ok(rendered.includes('<%'), 'EJS syntax must survive the build');
    assert.ok(!rendered.includes('{{ '), 'No unresolved build placeholders');
  }
  for (const filename of await readdir(join(work, 'project/fonts'))) {
    const original = await readFile(join(work, 'project/fonts', filename));
    for (const target of ['static/fonts', 'holding/static/fonts']) {
      assert.deepEqual(await readFile(join(work, 'app/public', target, filename)), original, filename);
    }
  }
  assert.deepEqual(await readFile(join(work, 'app/public/static/img/ss/ss-icons.svg')),
    await readFile(join(work, 'project/img/ss/ss-icons.svg')));
  await writeFile(join(work, 'app/public/js/stale-01234567.js'), 'stale output');
  await writeFile(join(work, 'dist/app/stale.js'), 'stale output');
  await runBuild();
  assert.deepEqual(await digestTree(join(work, 'app/public')), first, 'Clean builds must be byte-identical and remove stale files');
  assert.deepEqual(await digestTree(join(work, 'dist')), compiled, 'Compiled runtime must be repeatable and remove stale files');
  console.log('PASS: repeatable builds, manifest references, gzip, all fonts and image bytes');

  for (const [filename, invalid] of [
    ['project/coffee/Main.coffee', '\ninvalid = -> ('],
    ['project/coffee/data/UserData.coffee', '\ninvalid = -> ('],
    ['app/health/routes.coffee', '\ninvalid = -> ('],
    ['config/server.coffee', '\ninvalid = -> ('],
    ['project/browser/features.js', '\ninvalid = ('],
    ['project/sass/main.scss', '\n.broken { color: ;'],
    ['project/data/tracking.json', '{invalid'],
    ['project/html/index.html', '\n{{ js/nonexistent.js }}'],
  ]) {
    const path = join(work, filename);
    const original = await readFile(path);
    await writeFile(path, Buffer.concat([original, Buffer.from(invalid)]));
    await runBuild(false);
    await writeFile(path, original);
  }
  console.log('PASS: invalid CoffeeScript, Sass, JSON and unresolved assets fail the build');

  watcher = spawn(process.execPath, [gulp, 'watch'], { cwd: work });
  watcher.stdout.on('data', bytes => { watchLog += bytes; });
  watcher.stderr.on('data', bytes => { watchLog += bytes; });
  await until(() => watchLog.includes('Watching project sources'), 'watch startup');
  await writeFile(join(work, 'project/coffee/build-probe.coffee'), 'module.exports = "coffee-watch-probe"\n');
  const main = join(work, 'project/coffee/Main.coffee');
  await writeFile(main, (await readFile(main, 'utf8')) + '\nwindow.buildProbe = require "./build-probe"\n');
  const css = join(work, 'project/sass/main.scss');
  const originalCss = await readFile(css, 'utf8');
  await writeFile(css, originalCss + '\n.build-watch-probe { color: #123456; }\n');
  const tracking = join(work, 'project/data/tracking.json');
  const values = JSON.parse(await readFile(tracking));
  values.buildProbe = 'data-watch-probe';
  await writeFile(tracking, JSON.stringify(values));
  const template = join(work, 'project/html/index.html');
  await writeFile(template, (await readFile(template, 'utf8')) + '\n<!-- html-watch-probe -->\n');
  await until(async () =>
    (await decoded('js/main.js')).includes('coffee-watch-probe') &&
    (await decoded('css/main.css')).includes('.build-watch-probe') &&
    (await decoded('data/tracking.json')).includes('data-watch-probe') &&
    (await readFile(join(work, 'app/site/index.html'), 'utf8')).includes('html-watch-probe'), 'all source edits rebuilt');
  await until(() => watchLog.includes('Rebuild complete'), 'successful watch cycle');
  watchLog = '';
  await writeFile(css, originalCss + '\n.invalid { color: ;');
  await until(() => watchLog.includes('Build failed; waiting for the next edit:'), 'watch error reporting');
  await writeFile(css, originalCss + '\n.build-recovered { color: #654321; }\n');
  await until(async () => (await decoded('css/main.css')).includes('.build-recovered'), 'watch recovery');
  console.log('PASS: CoffeeScript dependency, Sass, data and HTML watch rebuilds; recovery after errors');
  watcher.kill('SIGTERM');
  await once(watcher, 'exit');
  watcher = undefined;
  await checkDevelopment(root, work, gulp);
} finally {
  if (watcher && watcher.exitCode === null) {
    watcher.kill('SIGTERM');
    await once(watcher, 'exit');
  }
  await rm(work, { recursive: true, force: true });
}
