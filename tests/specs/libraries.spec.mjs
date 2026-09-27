import { test, expect } from '@playwright/test';
import { returningVisitor, ready, gridReady, canvasFrame, observe, attachDiagnostics } from '../support/browser.mjs';

test.afterEach(attachDiagnostics);

test('pinned browser libraries provide full Ajax and native feature detection', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  expect(await page.evaluate(() => ({
    jquery: $.fn.jquery, underscore: _.VERSION, backbone: Backbone.VERSION, gsap: gsap.version,
    ajax: typeof $.ajax, deferred: typeof $.Deferred, migrate: typeof $.migrateVersion,
    modernizr: typeof window.Modernizr, iscroll: typeof window.IScroll, loader: typeof window.$script,
    javascriptClass: document.documentElement.classList.contains('js') && !document.documentElement.classList.contains('no-js'),
    hover: Features.hover === matchMedia('(hover: hover)').matches,
    codec: Features.video.webm === document.createElement('video').canPlayType('video/webm; codecs="vp8, vorbis"'),
  }))).toEqual({ jquery: '4.0.0', underscore: '1.13.8', backbone: '1.6.1', gsap: '3.15.0',
    ajax: 'function', deferred: 'function', migrate: 'undefined', modernizr: 'undefined',
    iscroll: 'undefined', loader: 'undefined', javascriptClass: true, hover: true, codec: true });
  if (await page.evaluate(() => Features.hover)) {
    await gridReady(page);
    const unhandled = [];
    page.on('pageerror', error => unhandled.push(error.message));
    const card = page.locator('[data-grid-item]').first();
    const video = card.locator('video');
    await card.hover();
    await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(0);
    for (let n = 0; n < 3; n++) {
      await page.mouse.move(0, 0);
      await card.hover();
    }
    await page.mouse.move(0, 0);
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
    expect(unhandled).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('native grid scrolling restores offsets, reveals credits, and returns to the top', async ({ page, isMobile }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  const home = page.locator('#page-home');
  if (isMobile) await home.evaluate(el => el.scrollTo(0, 700));
  else {
    await page.mouse.move(1000, 600);
    await page.mouse.wheel(0, 700);
  }
  await expect.poll(() => home.evaluate(el => el.scrollTop)).toBeGreaterThan(300);
  // WebKit may process a wheel in multiple native scroll updates.
  await expect.poll(() => home.evaluate(el => el.scrollTop)).toBe(700);
  await expect.poll(() => page.evaluate(() => {
    const view = CD.appView.wrapper.views.home.view;
    return !view.isScrolling && view.constructor.scrollDistance === view.el.scrollTop;
  })).toBe(true);
  const offset = await home.evaluate(el => el.scrollTop);
  await page.locator('.about-btn').click();
  await expect(page.locator('#page-about')).toBeVisible();
  await page.goBack();
  await expect(home).toBeVisible();
  await expect.poll(() => home.evaluate(el => el.scrollTop)).toBeCloseTo(offset, 0);
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: size.height - 100 });
  await home.evaluate(el => el.scrollTo(0, el.scrollHeight));
  await expect.poll(() => page.evaluate(() => CD.appView.wrapper.views.home.view.creditsVisible)).toBe(true);
  await expect(home.locator('[data-credits]')).toBeInViewport();
  await expect(home.locator('[data-grid-item]').last()).toBeInViewport();
  await page.locator('[data-logo]').click();
  await expect.poll(() => home.evaluate(el => el.scrollTop)).toBe(0);
  // A wheel/touch/key input must be able to interrupt the animated return.
  await home.evaluate(el => el.scrollTop = 1000);
  await page.evaluate(() => CD.appView.wrapper.views.home.view.scrollToTop());
  await home.dispatchEvent('wheel');
  expect(await home.evaluate(el => gsap.getTweensOf(el).length)).toBe(0);
  if (!isMobile) {
    await home.focus();
    await page.keyboard.press('End');
    await expect.poll(() => home.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(2);
  }
  expect(errors).toEqual([]);
});

test('info panels scroll natively and still expose source and share links after resize', async ({ page, isMobile }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await page.setViewportSize({ width: isMobile ? 390 : 1000, height: 500 });
  await ready(page, '/_/gianab/neon-bubbles');
  await canvasFrame(page, 'gianab/neon-bubbles');
  await page.locator('[data-show-info]').click();
  await expect(page.locator('#page-doodle')).toHaveClass(/show-info/);
  const scroll = page.locator(isMobile ? '[data-doodle-info]' : '.doodle-info-inner');
  await expect.poll(() => scroll.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  await scroll.evaluate(el => el.scrollTop = el.scrollHeight);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('[data-doodle-info] a[href="http://site.test:3000/yrg"]')).toBeVisible();
  await expect(page.locator('[data-doodle-info] a[href*="github.com"]').first()).toHaveAttribute('href', /^https?:\/\//);
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await page.locator('.close-btn').click();
  await expect(page.locator('#page-doodle')).not.toHaveClass(/show-info/);
  await page.locator('[data-show-info]').click();
  await expect(page.locator('[data-doodle-info]')).toContainText('Random interactive particles');
  expect(errors).toEqual([]);
});

test('GSAP transitions complete and a modal can close while its entry animation is running', async ({ page }) => {
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  const about = page.locator('.about-btn');
  await about.hover();
  const bounds = await about.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 80, bounds.y);
  await page.mouse.up();
  await expect(page).toHaveURL('http://site.test:3000/');
  await page.evaluate(() => {
    window.transitionCompletions = 0;
    const view = CD.appView.transitioner;
    view.on(view.EVENT_TRANSITIONER_OUT_DONE, () => window.transitionCompletions++);
  });
  await page.locator('.about-btn').click();
  await expect.poll(() => page.evaluate(() => window.transitionCompletions)).toBe(1);
  await page.locator('.contribute-btn').click();
  await expect.poll(() => page.evaluate(() => window.transitionCompletions)).toBe(2);
  expect(await page.evaluate(() => gsap.getTweensOf(CD.appView.transitioner.$panes.toArray()).length)).toBe(0);
  await page.evaluate(() => {
    // This retained primitive has no live route/template. Supply a fixture to
    // exercise its real animation, Escape listener and interrupted cleanup.
    if (!CD.templates.templates.get('orientation-modal')) CD.templates.templates.add({
      id: 'orientation-modal',
      text: '<div id="orientationModal" style="position:fixed;inset:20%;z-index:10000;opacity:0;visibility:hidden"><div class="inner" style="opacity:0;transform:scale(.8)">Orientation fixture</div></div>',
    });
    CD.appView.modalManager.showModal('orientationModal');
  });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => CD.appView.modalManager.isOpen())).toBe(false);
  await page.evaluate(() => {
    // This retained primitive has no live route/template. Supply a fixture to
    // exercise its real animation, Escape listener and interrupted cleanup.
    if (!CD.templates.templates.get('orientation-modal')) CD.templates.templates.add({
      id: 'orientation-modal',
      text: '<div id="orientationModal" style="position:fixed;inset:20%;z-index:10000;opacity:0;visibility:hidden"><div class="inner" style="opacity:0;transform:scale(.8)">Orientation fixture</div></div>',
    });
    CD.appView.modalManager.showModal('orientationModal');
  });
  await expect(page.locator('#orientationModal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => CD.appView.modalManager.isOpen())).toBe(false);
  expect(errors).toEqual([]);
});

test('a touch swipe scrolls the grid without an iScroll event interceptor', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || !isMobile, 'Chromium CDP touch input; other engines use the shared native-scroll contracts.');
  const errors = observe(page);
  await returningVisitor(page);
  await ready(page);
  await gridReady(page);
  const size = page.viewportSize();
  const session = await page.context().newCDPSession(page);
  try {
    const x = size.width / 2;
    const start = size.height * 0.75;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ x, y: start - step * size.height / 16 }] });
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.locator('#page-home').evaluate(el => el.scrollTop)).toBeGreaterThan(150);
    expect(errors).toEqual([]);
  } finally { await session.detach(); }
});
