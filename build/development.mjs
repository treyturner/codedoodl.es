import gulp from 'gulp';
import browserSync from 'browser-sync';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { developmentArchive } from './archive.mjs';

const sourceGlobs = ['project/**/*', '!project/vendor/**/node_modules/**',
  'app/**/*.coffee', 'app/**/*.js', 'app/**/*.cjs', '!app/public/**', 'config/**/*', 'doodles/**/*.json'];

export function watchSources(build, reload = () => {}) {
  // One queue covers all source types so revisioning cannot race other writes.
  const watcher = gulp.watch(sourceGlobs, { delay: 200 });
  let running = false;
  let pending = false;
  function rebuild() {
    if (running) { pending = true; return; }
    running = true;
    build(async error => {
      try {
        if (error) throw error;
        await reload();
        console.log('Rebuild complete');
      } catch (failure) { console.error('Build failed; waiting for the next edit:', failure.message); }
      running = false;
      if (pending) { pending = false; rebuild(); }
    });
  }
  watcher.on('all', rebuild);
  watcher.once('ready', () => console.log('Watching project sources'));
  return watcher;
}

export async function serve(build) {
  const port = Number(process.env.BIND_PORT || process.env.PORT || 3000);
  const proxyPort = Number(process.env.DEV_PORT || 3002);
  const target = `http://127.0.0.1:${port}`;
  const archive = developmentArchive(target);
  const spawnOptions = {
    cwd: resolve('dist/app'), stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', BIND_ADDRESS: '127.0.0.1',
      // BrowserSync rewrites the upstream origin to the request's Host header,
      // including forwarded ports and LAN addresses used by remote browsers.
      BASE_URL: process.env.BASE_URL || target,
      ...(archive ? { DOODLES_URL: archive.url } : {}) },
  };
  let child;
  const expectedExits = new WeakSet();
  const browser = browserSync.create();
  let watcher;
  let closing = false;
  function close() {
    if (closing) return;
    closing = true;
    watcher?.close();
    browser.exit();
    child?.kill('SIGTERM');
  }
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  async function startApp() {
    if (closing) return;
    const started = child = spawn(process.execPath, ['start.cjs'], spawnOptions);
    started.once('exit', code => {
      if (!expectedExits.has(started)) { close(); if (code) process.exitCode = code; }
    });
    const deadline = Date.now() + 30000;
    while (!closing && started.exitCode === null && Date.now() < deadline) {
      try { if ((await fetch(`${target}/health`, { signal: AbortSignal.timeout(1000) })).ok) return; }
      catch { /* Wait until the compiled application's cache is ready. */ }
      await delay(50);
    }
    if (!closing) throw new Error('Development application did not become ready');
  }
  async function restartApp() {
    if (closing) return;
    if (child.exitCode === null) {
      expectedExits.add(child);
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    await startApp();
    if (!closing) browser.reload();
  }
  try {
    await startApp();
    if (closing) return;
    await new Promise((resolveReady, reject) => browser.init({
      proxy: target, port: proxyPort, ui: false,
      open: false, notify: false, online: false, ghostMode: false,
      // A relative Socket.IO namespace keeps live reload on forwarded ports too.
      socket: { domain: () => '' },
      middleware: archive ? [archive.middleware] : [],
      // Serve artwork byte-for-byte; only the shell receives the reload client.
      snippetOptions: { ignorePaths: ['/__doodles/**'] },
    }, error => error ? reject(error) : resolveReady()));
    if (closing) { browser.exit(); return; }
    watcher = watchSources(build, restartApp);
  } catch (error) { close(); throw error; }
}
