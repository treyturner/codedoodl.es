#!/usr/bin/env node
const { mkdir, writeFile, rm } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');
const figlet = require('figlet');
const { create } = require('./manifestCreator');
const { getFullPath, getSlug } = require('./getDoodleDir');

const escapeHTML = text => text.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

async function writeDoodle(manifest) {
  const directory = resolve(getFullPath(manifest));
  await mkdir(dirname(directory), { recursive: true });
  // Claim only a new directory, so existing artwork is never overwritten.
  await mkdir(directory);
  try {
    manifest.slug = getSlug(manifest);
    const title = escapeHTML(`${manifest.name} | ${manifest.author.name}`);
    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<title>${title}</title>\n</head>\n<body></body>\n</html>\n`;
    await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 4) + '\n', { flag: 'wx' });
    await writeFile(`${directory}/index.html`, html, { flag: 'wx' });
    console.log(`Created ${directory}`);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  console.log(figlet.textSync('codedoodl.es', { font: 'Digital' }));
  console.log('Create a local doodle directory and manifest. You can edit them afterward.\n');
  await writeDoodle(await create());
}

if (require.main === module) main().catch(error => {
  console.error(error.code === 'EEXIST' ? 'This doodle directory already exists; no files were changed.' : error.message);
  process.exitCode = 1;
});
