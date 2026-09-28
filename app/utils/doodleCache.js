const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const _ = require('underscore');

function validateMaster(value) {
  if (!value || !Array.isArray(value.doodles)) throw new Error('Invalid master manifest: expected doodles array');
  const slugs = new Set();
  for (const entry of value.doodles) {
    if (!entry || !/^[a-z0-9_-]+\/[a-z0-9_-]+$/i.test(entry.slug) ||
        !Number.isSafeInteger(entry.index) || typeof entry.id !== 'string' || slugs.has(entry.slug)) {
      throw new Error('Invalid or duplicate master manifest entry');
    }
    slugs.add(entry.slug);
  }
  return value;
}

function validateDoodle(value) {
  if (!value || typeof value.name !== 'string' || typeof value.author?.github !== 'string' ||
      typeof value.author.name !== 'string' || !Array.isArray(value.tags)) {
    throw new Error('Invalid doodle manifest');
  }
  return value;
}

module.exports = function createDoodleCache({
  production, baseUrl, dataSource, directory, ttl = 300000,
  timeout = 10000, concurrency = 8, retryDelay = 1000,
  logger = console, now = Date.now,
}) {
  let snapshot = null;
  let inFlight = null;
  let nextRefresh = 0;
  let closed = false;
  const lifetime = new AbortController();

  async function remoteJson(path) {
    const url = `${baseUrl.replace(/\/$/, '')}/${path}`;
    const response = await fetch(url, { signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(timeout)]) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}: ${path}`);
    }
    // Fetch decodes Content-Encoding; parsing is covered by the same timeout.
    return response.json();
  }

  async function localMaster() {
    return validateMaster(JSON.parse(await readFile(join(directory, 'master_manifest_DEV.json'), 'utf8')));
  }

  async function load() {
    let master;
    if (production) {
      try {
        master = validateMaster(await remoteJson(dataSource === 'production' ? 'master_manifest.json' : 'master_manifest_DEV.json'));
      } catch (error) {
        // Cold-start fallback retains the historical local DEV-master selection.
        // A failed refresh must not replace a working snapshot with fallback data.
        if (snapshot || closed) throw error;
        logger.warn('Remote master unavailable; using local DEV master', { error: error.message });
        master = await localMaster();
      }
    } else master = await localMaster();

    const results = new Array(master.doodles.length);
    const previous = new Set(snapshot?.doodles.map(doodle => doodle.slug));
    const failedPrevious = [];
    let cursor = 0;
    async function worker() {
      while (!closed) {
        const position = cursor++;
        if (position >= master.doodles.length) return;
        const entry = master.doodles[position];
        try {
          const manifest = validateDoodle(production
            ? await remoteJson(`${entry.slug}/manifest.json`)
            : JSON.parse(await readFile(join(directory, entry.slug, 'manifest.json'), 'utf8')));
          results[position] = { ...entry, ...manifest };
        } catch (error) {
          if (closed) throw error;
          logger.warn('Doodle manifest unavailable', { slug: entry.slug, error: error.message });
          if (previous.has(entry.slug)) failedPrevious.push(entry.slug);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, master.doodles.length) }, worker));
    if (closed) throw new Error('Doodle cache closed');
    if (failedPrevious.length) throw new Error(`Refresh lost ${failedPrevious.length} previously available doodle(s)`);
    const doodles = _.sortBy(results.filter(Boolean), 'index').reverse();
    if (master.doodles.length && !doodles.length) throw new Error('No individual doodle manifests are available');
    const contributors = Object.values(_.groupBy(_.pluck(doodles, 'author'), author => author.github)).map(group => group[0]);
    return { doodles, contributors };
  }

  function refresh() {
    if (closed) return Promise.reject(new Error('Doodle cache closed'));
    if (inFlight) return inFlight;
    inFlight = load().then(value => {
      snapshot = value;
      nextRefresh = now() + ttl;
      logger.info('Doodle cache ready', { doodles: value.doodles.length });
      return value;
    }).catch(error => {
      nextRefresh = now() + retryDelay;
      if (!closed) logger.error('Doodle cache update failed', { error: error.message });
      throw error;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  function current() {
    if (!snapshot) throw new Error('Doodle cache is not initialized');
    if (!closed && now() >= nextRefresh) void refresh().catch(() => {});
    return snapshot;
  }

  return {
    initialize: () => snapshot ? Promise.resolve(snapshot) : refresh(),
    refresh,
    getDoodles: () => current().doodles,
    getContributors: () => current().contributors,
    close() { closed = true; lifetime.abort(); },
  };
};
