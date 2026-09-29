# CoffeeScript 2 migration

Stage 4 uses CoffeeScript **2.7.0** for both browser and server code, with the
same compiler shared by Coffeeify 3.0.1. There is no CoffeeScript 1 checkpoint or
additional ES5 transpilation layer. The agreed current desktop/mobile browser
target supports the emitted native classes. Stage 5 updates the browser
dependencies; see [browser.md](browser.md).

## Construction and callbacks

Backbone invokes `initialize` from its own constructor. CoffeeScript 2
normally binds a subclass's `=>` methods after `super()` returns, which is too
late for view initialization: templates, child views and event subscriptions
already need those methods. Binding them again afterward would also change
callback identity and prevent `off` from removing the original subscriptions.

Application views declare ordinary instance methods and use one early
binding step in `AbstractView.preinitialize`, before Backbone initializes the
element and invokes any subclass `initialize`. Stage 4 used `_ensureElement`;
stage 5 moves to the public hook provided by Backbone 1.6.1. `bindViewMethods`
visits the application's prototype chain, binds the most-derived implementation once, and
stops before Backbone's own methods. Subclass constructors become `initialize`
hooks, preserving setup before template rendering and work after the parent
initializer. Nested callback closures still use `=>` to capture the view.
New view methods should follow this pattern rather than adding constructor-bound
`=>` methods. `preinitialize` is covered by the repeated-navigation and callback tests.

Models inherit normal native constructors with attributes/options forwarding;
the old `Backbone.DeepModel.apply(this, arguments)` path is removed. Filtering
remains in `set`, including the call DeepModel makes during construction.
Filters and their construction-time helpers are ordinary methods, so they can
run before the native constructor returns. `set` explicitly handles both an
attribute map and a key/value pair; the old override attempted to write options
onto primitive values, which native class strict mode rejects. Data-class
constructors call `super` before touching the instance and no longer return
`null` from derived classes.
Bare `super` calls explicitly forward arguments. Locale/modal lookup loops and
two files with mixed indentation were adjusted for the current parser.

## Compiled server layout

`npm run build` checks every `.coffee` file in `app`, `config` and
`project/coffee`, including modules outside the current browser entrypoint.
After generating the shell assets and EJS pages, it creates a fresh `dist/`:

- `dist/app` contains compiled server JavaScript, native JavaScript helpers,
  EJS views and the public assets.
- `dist/config` contains compiled configuration modules.
- `dist/project/data/locales` preserves the server's locale lookup paths.
- `dist/doodles` contains JSON manifests for local development, preserving the
  cache's relative paths. Artwork source is not copied.

The container copies the compiled application and only the two master manifests
from that tree. Its command is `node dist/app/start.cjs`; `npm start` runs the
same entrypoint locally after a build. CoffeeScript is a development dependency,
absent from the production installation, and there is no runtime registration
hook or `.coffee` source in the image. Retained local authoring/preview helpers
can still register CoffeeScript from the development installation.

Development also runs compiled JavaScript. Browser, server, configuration and
manifest edits trigger the shared build queue; a successful rebuild restarts the
app, waits for readiness and reloads BrowserSync. Invalid source reports an
error and watch mode can recover on the next valid edit. Watch readiness is
reported after the initial filesystem scan, so edits made immediately after
that message are not lost.

## Verification

The native server suite imports and starts `dist` directly. Build checks reject
invalid browser/server/configuration CoffeeScript, including an unreferenced
module; compare repeated compiled outputs; remove stale generated modules; and
verify a server source edit reaches the running BrowserSync preview after a
clean restart. The browser suite adds model construction/nested change events
and repeated navigation checks for view reuse, bound callback identity and
listener removal/reinstallation. Existing visual, routing, artwork and process
lifecycle contracts still apply; see [testing.md](testing.md) for results.

Validation also reproduced a pre-existing WebKit entry-screen issue on the
stage 3 image: replacing animated letter text between mouse-down and mouse-up
could lose the click entirely. Intro letters now ignore pointer events, keeping
the parent button as the click target. That interaction was covered with a
200 ms press. The splash is now retained but disabled; the first-visit test
checks automatic entry to the grid without extension-promotion buttons.

Language reference: [CoffeeScript 2 breaking changes](https://coffeescript.org/#breaking-changes).
