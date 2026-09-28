import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default function report(directory = '/results/artwork') {
  // Playwright passes configuration to teardown; a CLI caller can pass a path.
  if (typeof directory !== 'string') directory = '/results/artwork';
  if (!existsSync(directory)) return;
  const entries = readdirSync(directory).filter(file => file.endsWith('.json')).sort()
    .map(file => ({ name: file.slice(0, -5), data: JSON.parse(readFileSync(resolve(directory, file))) }));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cards = entries.map(({ name, data }) => `<article>
    <a href="${escape(name)}.png"><img loading="lazy" src="${escape(name)}.png" alt="${escape(data.slug)}"></a>
    <h2>${escape(data.slug)}</h2><p>${data.rendering.drew ? 'Drawing commands observed' : 'No Canvas/WebGL drawing observed'}</p>
    <details><summary>${data.errors.length} frame errors · ${data.failedRequests.length} failed requests</summary>
    <pre>${escape(JSON.stringify({ errors: data.errors, failedRequests: data.failedRequests }, null, 2))}</pre></details>
    <a href="${escape(name)}.json">Raw observation</a></article>`).join('\n');
  writeFileSync(resolve(directory, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1"><title>Artwork observations</title>
  <style>body{margin:2rem;background:#171717;color:#eee;font:16px system-ui}h1{margin-bottom:.5rem}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}article{background:#252525;padding:1rem;min-width:0}img{width:100%;aspect-ratio:1.6;object-fit:contain;background:#000}h2{font-size:1rem;overflow-wrap:anywhere}a{color:#86cdff}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.75rem}</style>
  <h1>Artwork observations</h1><p>${entries.length} sketches; ${entries.filter(entry => entry.data.rendering.drew).length} submitted Canvas/WebGL drawing commands.</p>
  <p>Screenshots and synthetic input support review. Drawing commands alone do not prove visual correctness. See each observation for existing archive/network failures.</p>
  <main>${cards}</main></html>`);
}

if (process.argv[1]?.endsWith('/artwork-report.mjs')) report(process.argv[2]);
