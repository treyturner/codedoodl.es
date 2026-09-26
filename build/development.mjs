import gulp from 'gulp';
import browserSync from 'browser-sync';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { developmentArchive } from './archive.mjs';

const sourceGlobs = ['project/**/*', '!project/vendor/**/node_modules/**'];

export function watchSources(build, reload = () => {}) {
  // One queue covers all source types so revisioning cannot race other writes.
  const watcher = gulp.watch(sourceGlobs, { delay: 200 });
  let running = false;
  let pending = false;
  function rebuild() {
    if (running) { pending = true; return; }
    running = true;
    build(error => {
      running = false;
      if (error) console.error('Build failed; waiting for the next edit:', error.message);
      else { console.log('Rebuild complete'); reload(); }
      if (pending) { pending = false; rebuild(); }
    });
  }
  watcher.on('all', rebuild);
  console.log('Watching project sources');
  return watcher;
}

export async function serve(build) {
  const port = Number(process.env.BIND_PORT || 3000);
  const proxyPort = Number(process.env.DEV_PORT || 3002);
  const target = `http://127.0.0.1:${port}`;
  const archive = developmentArchive(target);
  const child = spawn(process.execPath, ['start.cjs'], {
    cwd: resolve('app'), stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', BIND_ADDRESS: '127.0.0.1',
      // BrowserSync rewrites the upstream origin to the request's Host header,
      // including forwarded ports and LAN addresses used by remote browsers.
      BASE_URL: process.env.BASE_URL || target,
      ...(archive ? { DOODLES_URL: archive.url } : {}) },
  });
  const browser = browserSync.create();
  let watcher;
  let closing = false;
  function close() {
    if (closing) return;
    closing = true;
    watcher?.close();
    browser.exit();
    child.kill('SIGTERM');
  }
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  child.once('exit', code => { close(); if (code) process.exitCode = code; });
  try {
    await new Promise((resolveReady, reject) => browser.init({
      proxy: target, port: proxyPort, ui: false,
      open: false, notify: false, online: false, ghostMode: false,
      // A relative Socket.IO namespace keeps live reload on forwarded ports too.
      socket: { domain: () => '' },
      middleware: archive ? [archive.middleware] : [],
      // Serve artwork byte-for-byte; only the shell receives the reload client.
      snippetOptions: { ignorePaths: ['/__doodles/**'] },
    }, error => error ? reject(error) : resolveReady()));
    watcher = watchSources(build, () => browser.reload());
  } catch (error) { close(); throw error; }
}
