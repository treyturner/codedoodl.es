import { test, expect } from '@playwright/test';
import { returningVisitor, ready, gridReady, canvasFrame, observe, attachDiagnostics } from '../support/browser.mjs';

test.afterEach(attachDiagnostics);

test('password pages show a styled wordmark and loaded font without application JavaScript', async ({ page }) => {
  const errors = observe(page);
  await page.goto('http://auth:3000/');
  const wordmark = page.locator('.preloader__text-outer');
  await expect(wordmark).toHaveText('codedoodl.es');
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('#preloader')).toHaveCSS('background-color', 'rgb(235, 66, 62)');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.replace(/["']/g, '') === 'monostena' && face.status === 'loaded'))).toBe(true);
  await expect(page.locator('script[src]')).toHaveCount(0);
  await page.goto('http://auth:3000/login');
  await expect(page.locator('input[name=pw]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('15px monostena'))).toBe(true);
  expect(errors).toEqual([]);
});

test('home grid, fonts, thumbnails, and stable shell screenshot', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  await expect(page.locator('[data-grid-item] a').first()).toHaveAttribute('href', 'http://site.test:3000/_/dmnsgn/oitnb');
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family);
  });
  expect(font.length).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('home.png', { animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('first visit opens the grid without the extension promotion splash', async ({ page }) => {
  const errors = observe(page);
  await ready(page);
  await gridReady(page);
  await expect(page.locator('[data-intro-btn]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('CD_VISITED'))).toBeNull();
  expect(errors).toEqual([]);
});

test('about/contribute navigation and browser history work without full reloads', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  await page.evaluate(() => { window.baselineNavigationMarker = 'preserved'; });
  await page.locator('.about-btn').click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('#page-about')).toBeVisible();
  await expect(page.locator('.sponsor-nexus img')).toHaveAttribute('src', 'http://site.test:3000/static/img/logos/nexus_70.png');
  await expect(page.locator('#page-about a[href="https://github.com/treyturner/codedoodl.es-chrome-extension/releases"]')).toHaveText('chrome extension');
  await page.locator('.contribute-btn').click();
  await expect(page).toHaveURL(/\/contribute\/?$/);
  await expect(page.locator('#page-contribute')).toBeVisible();
  await expect(page.locator('[data-contributors]')).toContainText('Damien Seguin');
  await page.goBack();
  await expect(page.locator('#page-about')).toBeVisible();
  expect(await page.evaluate(() => window.baselineNavigationMarker)).toBe('preserved');
  expect(errors).toEqual([]);
});

test('doodle deep link renders a moving canvas, info, reload, and navigation', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page, '/_/gianab/neon-bubbles');
  const canvas = await canvasFrame(page, 'gianab/neon-bubbles');
  const before = await canvas.evaluate(node => node.toDataURL());
  await expect.poll(() => canvas.evaluate(node => node.toDataURL())).not.toBe(before);
  // Force the press to span the delayed artwork focus; shell input cancels it.
  await page.evaluate(() => CD.appView.wrapper.views.doodle.view.queueFrameFocus());
  await page.locator('[data-show-info]').click({ delay: 600 });
  await expect(page.locator('#page-doodle')).toHaveClass(/show-info/);
  await expect(page.locator('[data-doodle-info]')).toContainText('Random interactive particles');
  await expect(page.locator('[data-doodle-info] a[href="http://site.test:3000/yrg"]')).toHaveCount(1);
  await page.locator('.close-btn').click();
  await expect(page.locator('#page-doodle')).not.toHaveClass(/show-info/);
  await expect.poll(() => page.evaluate(() => document.activeElement === document.querySelector('[data-doodle-frame]'))).toBe(true);
  // Require a fresh document instead of a transient same-URL navigation event.
  // The locator resolves the new root after reload; a missed click keeps the marker.
  const doodleDocument = page.frameLocator('[data-doodle-frame]').locator('html');
  await doodleDocument.evaluate(node => { node.baselineReloadMarker = true; });
  await expect(doodleDocument).toHaveJSProperty('baselineReloadMarker', true);
  await page.locator('[data-doodle-refresh]').click();
  await expect(doodleDocument).toHaveJSProperty('baselineReloadMarker', undefined);
  const refreshedCanvas = await canvasFrame(page, 'gianab/neon-bubbles');
  const refreshedBefore = await refreshedCanvas.evaluate(node => node.toDataURL());
  await expect.poll(() => refreshedCanvas.evaluate(node => node.toDataURL())).not.toBe(refreshedBefore);
  const next = page.locator('[data-doodle-nav="next"]');
  const previous = page.locator('[data-doodle-nav="prev"]');
  const navigation = await next.getAttribute('href') ? next : previous;
  const destination = await navigation.getAttribute('href');
  expect(destination).toContain('/_/');
  await navigation.click();
  await expect(page).toHaveURL(new RegExp(new URL(destination).pathname + '/?$'));
  await page.goBack();
  await canvasFrame(page, 'gianab/neon-bubbles');
  expect(errors).toEqual([]);
});

test('mobile fallback keeps unsupported doodles accessible as a preview', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only fallback.');
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page, '/_/andrevenancio/infinite-spaces');
  await expect(page.locator('[data-doodle-instructions]')).toHaveClass(/show-fallback/);
  await expect(page.locator('[data-doodle-instructions] a')).toHaveAttribute('href', /\/andrevenancio\/infinite-spaces\/thumb\.(mp4|webm)$/);
  await expect(page.locator('[data-doodle-frame]')).toHaveAttribute('src', '');
  const sourceURL = page.url();
  const previewURL = await page.locator('[data-doodle-instructions] a').evaluate(link => link.href);
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-doodle-instructions] a').click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(previewURL);
  await expect.poll(() => popup.evaluate(() => document.querySelector('video')?.videoWidth || 0)).toBeGreaterThan(0);
  await popup.close();
  await expect(page).toHaveURL(sourceURL);
  expect(errors).toEqual([]);
});

test('preview links bypass routing for protocol-relative local archive URLs', async ({ page, context }) => {
  const errors = observe(page);
  // Reproduce the development origin/path with real archive video responses.
  // HTTP/gzip/range behavior of the actual dev middleware is checked by test:build.
  await context.route('http://site.test:3000/__doodles/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/__doodles', '');
    await route.fulfill({ response: await route.fetch({ url: `http://assets:8080${path}` }) });
  });
  await page.setViewportSize({ width: 749, height: 900 });
  await returningVisitor(page);
  await ready(page, '/_/flexi23/candlewick');
  await page.evaluate(() => {
    CD.DOODLES_URL = `//${location.host}/__doodles`;
    CD.appView.wrapper.views.doodle.view.setupMobileFallback();
  });
  const link = page.locator('[data-doodle-instructions] a');
  const sourceURL = page.url();
  const previewURL = await link.evaluate(link => link.href);
  const popupPromise = page.waitForEvent('popup', { timeout: 5000 });
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(previewURL);
  await expect.poll(() => popup.evaluate(() => document.querySelector('video')?.videoWidth || 0)).toBeGreaterThan(0);
  await popup.close();
  await expect(page).toHaveURL(sourceURL);

  // Even without target=_blank, media is a document navigation, never an SPA route.
  await link.evaluate(link => link.removeAttribute('target'));
  expect(errors).toEqual([]);
  // WebKit keeps native media navigation pending while its player owns the
  // stream. Inspect the document directly instead of waiting for navigation.
  await link.click({ noWaitAfter: true });
  await expect(page).toHaveURL(previewURL);
  await expect.poll(() => page.evaluate(() => document.querySelector('video')?.videoWidth || 0)).toBeGreaterThan(0);
});

test('the optimization warning follows the 750px threshold on resize', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await page.setViewportSize({ width: 750, height: 900 });
  await ready(page, '/_/gwenvanhee/pulsator');
  await canvasFrame(page, 'gwenvanhee/pulsator');
  const instructions = page.locator('[data-doodle-instructions]');
  const iframe = page.locator('[data-doodle-frame]');
  await page.setViewportSize({ width: 749, height: 900 });
  await expect(instructions).toHaveClass(/show-fallback/);
  await expect(iframe).toHaveAttribute('src', '');
  await expect(iframe).not.toHaveClass(/show/);
  await page.locator('[data-doodle-refresh]').click();
  // Span the initial instruction delay and refresh delay: neither may reload
  // the iframe or replace the warning's link after switching to fallback.
  await page.waitForTimeout(2200);
  await expect(instructions.locator('a')).toBeVisible();
  await expect(iframe).toHaveAttribute('src', '');

  for (let cycle = 0; cycle < 2; cycle++) {
    await page.setViewportSize({ width: 750, height: 900 });
    const canvas = await canvasFrame(page, 'gwenvanhee/pulsator');
    await expect(instructions).not.toHaveClass(/show-fallback/);
    await expect(instructions.locator('a')).toHaveCount(0);
    const before = await canvas.evaluate(node => node.toDataURL());
    // Pulsator initializes its animation around the first mouse position.
    await canvas.dispatchEvent('mousemove', { clientX: 200, clientY: 250, bubbles: true });
    await expect.poll(async () => await canvas.evaluate(node => node.toDataURL()) !== before).toBe(true);
    await canvas.evaluate(node => node.ownerDocument.defaultView.resizeMarker = 'retained');
    await page.setViewportSize({ width: 800, height: 900 });
    await expect.poll(() => page.evaluate(() => CD.appView.dims.w)).toBe(800);
    expect(await canvas.evaluate(node => node.ownerDocument.defaultView.resizeMarker)).toBe('retained');
    await page.setViewportSize({ width: 749, height: 900 });
    await expect(instructions).toHaveClass(/show-fallback/);
    await expect(iframe).toHaveAttribute('src', '');
  }

  await page.locator('[data-logo]').click();
  await expect(page.locator('#page-home')).toBeVisible();
  await page.goBack();
  await expect(instructions.locator('a')).toBeVisible();
  await expect(iframe).toHaveAttribute('src', '');
  expect(errors).toEqual([]);
});

test('mobile-friendly sketches keep running across the optimization threshold', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await page.setViewportSize({ width: 749, height: 900 });
  await ready(page, '/_/gianab/neon-bubbles');
  const instructions = page.locator('[data-doodle-instructions]');
  const mobileCanvas = await canvasFrame(page, 'gianab/neon-bubbles');
  await mobileCanvas.evaluate(node => node.ownerDocument.defaultView.resizeMarker = 'mobile');
  for (const width of [750, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => CD.appView.dims.w)).toBe(width);
    await expect(instructions).not.toHaveClass(/show-fallback/);
    expect(await mobileCanvas.evaluate(node => node.ownerDocument.defaultView.resizeMarker)).toBe('mobile');
  }
  expect(errors).toEqual([]);
});

test('native classes preserve model construction and view callbacks across repeated navigation', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  const model = await page.evaluate(() => {
    const collection = window.CD.appData.doodles;
    const original = collection.at(0);
    const copy = new original.constructor(original.toJSON(), { collection });
    let changes = 0;
    copy.on('change:author.name', () => changes++);
    copy.set('viewed', true);
    copy.set('author.name', 'Compiler migration probe');
    copy.set({ 'author.website': 'https://example.test/' }, { silent: true });
    return { collection: copy.collection === collection, id: copy.id === original.id,
      url: copy.get('url') === original.get('url'), index: copy.get('index_padded') === original.get('index_padded'),
      viewed: copy.get('viewed'), website: copy.get('author.website'),
      name: copy.get('author.name'), changes, originalUnchanged: original.get('author.name') !== copy.get('author.name') };
  });
  expect(model).toEqual({ collection: true, id: true, url: true, index: true,
    viewed: true, website: 'https://example.test/',
    name: 'Compiler migration probe', changes: 1, originalUnchanged: true });

  await page.evaluate(() => {
    const home = window.CD.appView.wrapper.views.home.view;
    window.compilerCallback = home.onResize;
    window.compilerView = home;
  });
  for (let visit = 0; visit < 2; visit++) {
    await page.locator('.about-btn').click();
    await expect(page.locator('#page-about')).toBeVisible();
    expect(await page.evaluate(() => {
      const app = window.CD.appView;
      return (app._events[app.EVENT_UPDATE_DIMENSIONS] || []).filter(event => event.callback === window.compilerCallback).length;
    })).toBe(0);
    await page.goBack();
    await gridReady(page);
    await expect.poll(() => page.evaluate(() => {
      const app = window.CD.appView;
      return (app._events[app.EVENT_UPDATE_DIMENSIONS] || []).filter(event => event.callback === window.compilerCallback).length;
    })).toBe(1);
    expect(await page.evaluate(() => {
      const home = window.CD.appView.wrapper.views.home.view;
      const detached = home.CD;
      return home === window.compilerView && home.onResize === window.compilerCallback && detached() === window.CD;
    })).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('DeepModel preserves nested defaults, changes, arrays, and collection IDs', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  const result = await page.evaluate(() => {
    const Model = Backbone.DeepModel.extend({
      defaults: { author: { name: 'default', website: 'original' }, tags: ['a'] },
      preinitialize() { this.initializedEarly = true; },
    });
    const model = new Model({ id: 'old', author: { name: 'first' } });
    const collection = new Backbone.Collection([model]);
    const changes = [];
    model.on('change:author.name change:author.* change:author', () => changes.push(true));
    model.set('author.name', 'second');
    const previous = model.previous('author.name');
    const changed = model.changedAttributes();
    const json = model.toJSON();
    json.author.name = 'isolated';
    model.set('tags.1', 'b', { silent: true });
    model.set('id', 'new', { silent: true });
    const reindexed = collection.get('new') === model && !collection.get('old');
    model.unset('author.website');
    return { initializedEarly: model.initializedEarly, name: model.get('author.name'), previous, changed,
      defaults: json.author.website, changes: changes.length, tags: model.get('tags'), reindexed,
      unset: model.get('author.website') === undefined, isolated: model.toJSON().author.name !== json.author.name };
  });
  expect(result).toEqual({ initializedEarly: true, name: 'second', previous: 'first',
    changed: { 'author.name': 'second' }, defaults: 'original', changes: 5,
    tags: ['a', 'b'], reindexed: true, unset: true, isolated: true });
  expect(errors).toEqual([]);
});
