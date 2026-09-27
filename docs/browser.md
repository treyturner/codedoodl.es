# Browser dependency migration

Stage 5 keeps the Backbone application and the original artwork boundary. The
shell now takes full jQuery **4.0.0**, Underscore **1.13.8**, Backbone **1.6.1** and
GSAP **3.15.0** from exact npm versions and the lockfile. Versions were rechecked
on 2026-09-27. Artwork libraries inside the sibling archive are unchanged.

## Build and library order

`package.json` lists explicit browser distribution paths, in execution order:
application feature detection, jQuery, Underscore, Backbone, the DeepModel
compatibility fork, GSAP, and application animation defaults. These files retain
the browser globals used by the CoffeeScript bundle. jQuery's full build supplies
Ajax and Deferreds used to fetch templates, locale strings and application data.
The browser packages are build inputs, not additional server runtime packages.

The build retains copyright/license comments and emits the MIT license texts
and GSAP distribution notices at `/static/licenses/browser.txt`. GSAP's notice
includes its standard-license URL. Superseded checked-in distributions are
removed; their history remains in Git.

## DOM and model compatibility

The migration checkpoints use jQuery 3.7.1 with Migrate 3.6.0, then jQuery 4.0.0
with Migrate 4.0.2. Browser checks fail on Migrate warnings. The final bundle and
installation omit Migrate. Template trimming uses native `String.trim`, and
iframe focus uses the DOM method. Grid views now receive `{ model, parentGrid }`
options; passing a model directly accidentally made its attributes into DOM
attributes during Backbone element construction. The Migrate checks exposed
this issue, including boolean attributes whose behavior changes in jQuery 4.

Backbone 1.6's public `preinitialize` hook binds application view callbacks before
element creation and initialization. This replaces stage 4's `_ensureElement`
integration. Repeated-navigation tests retain the construction, callback identity
and event removal/reinstallation contract.

### Frozen dependency exception: DeepModel

`project/vendor/backbone-deep-model.js` remains an application-owned compatibility
fork of the checked-in **0.11.0** implementation, under its MIT license. The npm
package labelled 0.11.0 contains a distribution labelled 0.10.4, missing behavior
in this checkout (including array paths and parent change notifications). Moving
to that distribution would be a downgrade. No newer npm release was available.

The local patch adds Backbone's `preinitialize`/`cidPrefix` behavior and emits
`changeId` after changing attributes, including silent updates. Backbone 1.6
collections need that event to reindex IDs. Tests cover nested defaults, both
set forms, arrays, cloned JSON, previous values, nested/wildcard/parent changes,
unset, silent changes and collection IDs, as well as actual doodle construction.

Owner: maintainers of this application's shell. Replacement task: replace this
fork with an application-owned Backbone.Model subclass implementing the used
nested-data contract, using these tests as acceptance criteria. Review any new
model mutation or editable-data feature against that contract first. This stage
preserves the existing archive data model; it does not restore retired editing
or publishing services. The fork is the sole retained old browser distribution.

## Animation

All application TweenLite calls now use GSAP 3's duration-in-options API and
string easing names. Existing durations, delays and completion callbacks remain.
`overwrite: 'auto'` preserves property-level cancellation when tweens overlap.
Transition resets kill stale pane tweens and use `gsap.set` for transforms so
GSAP's transform cache stays synchronized with the DOM. Grid entry, preload,
page transitions and retained modal animation methods use the same GSAP core
and built-in CSS plugin; separate CSSPlugin/EasePack bundles are removed.

Animated letter spans ignore pointer events, keeping the enclosing link/button
as the target when text changes during a press. This extends the stage 4 intro
fix to header/info links. Delayed iframe focus is cancelled on shell pointer or
keyboard input, info opening and view teardown: event traces showed that moving
focus into the iframe between mouse-down and mouse-up lost the info-button
click. Artwork still receives automatic focus if the user has not intervened. Header
links also capture a stationary pointer press while adjacent labels change
width; moving the pointer more than eight pixels releases capture for normal
drag cancellation. This preserves the existing layout and animations.

Hover preview playback handles cancellation when the pointer leaves before
`play()` resolves, and tolerates cards without a video element at narrow widths.
It logs other playback failures. This closes the previous unhandled play/pause
race without changing archived media.

## Native scrolling and feature detection

The home grid and overflowing doodle info panel use native overflow scrolling.
The grid listens passively to scroll events, retains offsets across view removal
and browser-history navigation, updates row visibility, and reveals credits near
the bottom. A brief scroll-idle timer restores hover effects. The logo animates
`scrollTop` back to zero over the existing 700 ms; wheel, touch, pointer or keyboard
input cancels the tween itself, including before its first animation frame. Teardown removes listeners and timers. The grid is
keyboard focusable, and native scrollbars retain drag interaction. The established
simpler grid styling on Firefox and touch layouts remains separate from scrolling.

`project/browser/features.js` detects hover with a media query and video codec
support with `canPlayType`. CSS uses `can-hover`/`no-hover`. The supported browser
matrix provides transforms, requestAnimationFrame, array methods and computed
styles natively. Modernizr, iScroll, the unused `$script` loader, console/IE/RAF
polyfills, unused Array prototype extension and unused query-string globals are
removed. No active caller depended on the removed plugin helpers.

## Checks and limits

### Preview links and responsive fallback

Every sketch uses the same 750 CSS-pixel threshold. Below it, the shell shows the
optimization warning unless the archive manifest sets `mobile_friendly: true`.
The decision now updates on resize: widening loads the sketch, narrowing unloads
it and restores the warning, and resizing within the same mode keeps the running
sketch. Pending refresh, instruction and focus callbacks are cancelled when the
mode changes or the view is removed. Mobile-friendly sketches run at either width.

The development archive's protocol-relative links (`//host/__doodles/...`) exposed
an old navigation parser bug: it treated the empty segment after the first slash
as the home route and appended a slash to the video filename. Link handling now
uses the URL parser and routes only recognized paths on the current origin. New
tabs, download links and modified clicks retain their browser behavior.

Browser regressions click the preview link and require video metadata to load,
cover the local archive URL with and without a new-tab target, and repeatedly
cross 749/750 pixels with both manifest settings. The local archive routing and
resize regressions both fail against the preceding stage 5 image. The original
mobile fallback test only checked the generated href; it now opens the video.

### Coverage boundaries

The standard container suite compares the original screenshots and exercises
real navigation, Canvas/WebGL frames, first-visit entry, mobile fallback and
model lifecycle. Additional browser contracts cover exact library versions,
native scrolling/restoration/credits/keyboard input, interruption of scrolling,
info-panel overflow and resizing, transition completion and modal cleanup.
The retained orientation-modal primitive has no live template or route; its
animation/cleanup check deliberately supplies a fixture template, without adding
a production UI. A Chromium mobile test sends touch input through CDP.

Desktop browser automation and mobile emulation do not establish real-device
Safari/Chrome gesture, media or WebGL behavior. Those checks and a visual tour of
every artwork remain release gates. See [testing.md](testing.md) for recorded
results and [modernization-plan.md](modernization-plan.md) for stage 6.

References: [jQuery 4 changes](https://blog.jquery.com/2026/01/17/jquery-4-0-0/),
[jQuery Migrate version pairing](https://github.com/jquery/jquery-migrate/blob/main/README.md),
[Backbone lifecycle and changeId](https://backbonejs.org/),
[GSAP 3 API and overwrite migration](https://gsap.com/resources/3-migration/),
[DeepModel upstream](https://github.com/powmedia/backbone-deep-model).
