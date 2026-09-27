import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import CoffeeScript from 'coffeescript';

async function files(directory) {
  const paths = await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : path;
  }));
  return paths.flat().sort();
}

export async function checkCoffee() {
  // Include modules outside the current browser entrypoint as well.
  for (const root of ['app', 'config', 'project/coffee']) {
    for (const filename of await files(root)) {
      if (filename.endsWith('.coffee')) CoffeeScript.compile(await readFile(filename, 'utf8'), { filename });
    }
  }
}

export async function server() {
  await rm('dist', { recursive: true, force: true });
  for (const root of ['app', 'config']) {
    for (const filename of await files(root)) {
      const target = join('dist', filename.replace(/\.coffee$/, '.js'));
      await mkdir(dirname(target), { recursive: true });
      if (filename.endsWith('.coffee')) {
        await writeFile(target, CoffeeScript.compile(await readFile(filename, 'utf8'), { filename }));
      } else await cp(filename, target);
    }
  }
  await cp('project/data/locales', 'dist/project/data/locales', { recursive: true });
  // Local development uses individual manifests; no artwork source is bundled.
  for (const filename of await files('doodles')) {
    if (!filename.endsWith('.json')) continue;
    const target = join('dist', filename);
    await mkdir(dirname(target), { recursive: true });
    await cp(filename, target);
  }
}
