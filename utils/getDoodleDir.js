const { join } = require('node:path');
const slug = require('slug').default;

const getAuthorDir = name => slug(name.trim().replace(/\s+/g, '-').toLowerCase());
const getDoodleDir = getAuthorDir;
const getSlug = manifest => `${getAuthorDir(manifest.author.github)}/${getDoodleDir(manifest.name)}`;
const getFullPath = manifest => join('doodles', getSlug(manifest));

module.exports = { getFullPath, getSlug, getAuthorDir, getDoodleDir };
