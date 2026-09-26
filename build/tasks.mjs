import { readFile, writeFile, mkdir, rm, cp, readdir, rename } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import browserify from 'browserify';
import coffeeify from 'coffeeify';
import { compileAsync } from 'sass';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { minify } from 'terser';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const publicDir = 'app/public';
const generatedPages = ['index.html', 'holding.html', 'login.html'];
const revisionExtensions = new Set(['.js', '.css', '.json', '.xml']);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const filename = join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : filename;
  }));
  return nested.flat().sort();
}

async function output(filename, contents) {
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, contents);
}

export async function clean() {
  await rm(publicDir, { recursive: true, force: true });
  await rm('rev-manifest.json', { force: true });
  await Promise.all(generatedPages.map(page => rm(`app/site/${page}`, { force: true })));
  await cp('project/public', publicDir, { recursive: true });
}

export async function scripts() {
  const bundle = await new Promise((resolve, reject) => {
    browserify({ entries: ['project/coffee/Main.coffee'], extensions: ['.coffee'] })
      .transform(coffeeify)
      .bundle((error, buffer) => error ? reject(error) : resolve(buffer.toString()));
  });
  const result = await minify(bundle, { format: { comments: /^!/ } });
  await output(`${publicDir}/js/main.js`, result.code);
}

export async function vendor() {
  // Object insertion order is the legacy execution order. Glob ordering is not.
  const sources = await Promise.all(Object.values(pkg.vendor).map(name => readFile(`${pkg.folders.vendor}/${name}`, 'utf8')));
  const result = await minify(sources.join('\n;\n'), { format: { comments: /^!/ } });
  await output(`${publicDir}/js/vendor/v.js`, result.code);
}

export async function styles() {
  const compiled = await compileAsync('project/sass/main.scss', { style: 'compressed' });
  const result = await postcss([autoprefixer()]).process(compiled.css, { from: 'project/sass/main.scss', map: false });
  for (const warning of result.warnings()) console.warn(warning.toString());
  await output(`${publicDir}/css/main.css`, result.css);
  // Login/holding share fonts and preloader styles; relative URLs resolve to
  // their own /holding/static directory.
  await output(`${publicDir}/holding/css/main.css`, result.css);
}

export async function images() {
  // Copy original bytes: no native optimizer or implicit UTF-8 conversion.
  await cp('project/img', `${publicDir}/static/img`, { recursive: true });
}

export async function fonts() {
  await Promise.all(['static/fonts', 'holding/static/fonts'].map(path =>
    cp('project/fonts', `${publicDir}/${path}`, { recursive: true })));
}

export async function data() {
  for (const source of await files('project/data')) {
    if (!['.xml', '.json'].includes(extname(source))) continue;
    const bytes = await readFile(source);
    // XML contains client-side template syntax and significant text.
    const contents = source.endsWith('.json') ? JSON.stringify(JSON.parse(bytes)) : bytes;
    await output(`${publicDir}/data/${source.slice('project/data/'.length)}`, contents);
  }
}

export async function revision() {
  const manifest = {};
  for (const filename of await files(publicDir)) {
    if (!revisionExtensions.has(extname(filename))) continue;
    const logical = filename.slice(publicDir.length + 1);
    if (!/^(?:js|css|data|holding\/css)\//.test(logical)) continue;
    const bytes = gzipSync(await readFile(filename), { level: 9 });
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const ext = extname(logical);
    const revised = `${logical.slice(0, -ext.length)}-${hash}${ext}`;
    await writeFile(filename, bytes);
    await rename(filename, `${publicDir}/${revised}`);
    manifest[logical] = revised;
  }
  await output('rev-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
}

export async function html() {
  const manifest = JSON.parse(await readFile('rev-manifest.json', 'utf8'));
  for (const page of generatedPages) {
    const source = await readFile(`project/html/${page}`, 'utf8');
    const rendered = source.replace(/\{\{ ([^{}]+) \}\}/g, (_, asset) => {
      if (!Object.hasOwn(manifest, asset)) throw new Error(`Missing build asset: ${asset} in ${page}`);
      return manifest[asset];
    });
    await output(`app/site/${page}`, rendered);
  }
}
