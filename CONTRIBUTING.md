# Contributing doodles

See the [relevant docs section](docs/contributing.md).

# Contributing to the site

Clone the repo, submit a pull request!

Use Node 24.21.0 and its bundled npm 11.19.0 (`nvm install && nvm use`), then:

1. `npm ci`
2. `npm run dev`
3. Open http://localhost:3002 for the application with browser reloading.

`npm run build` creates production assets and compiles the server into `dist/`.
`npm start` runs that generated JavaScript on port 3000; `npm run watch` rebuilds
after edits without starting a server. Development mode recompiles and restarts
the server before reloading the browser.
Development serves artwork from the sibling `codedoodl.es-doodles` checkout.
Use `DOODLES_ARCHIVE` for another checkout, or `DOODLES_URL` for a remote host
that serves the archived gzip files correctly.
See [the build guide](docs/build.md) for the source layout, environment settings,
local doodle tools, and the boundary around retired publishing tools.

Run `npm run test:build` for build/watch checks, or `npm test` (equivalently
`bash tests/run.sh`) for the container and browser suite. The container suite
needs Bash, Git and Docker; it does not need host application dependencies.
See [the testing guide](docs/testing.md) for the pinned archive and diagnostics.
