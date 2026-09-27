# Server behavior

The runtime uses Express 5.2.1, EJS 6.0.1, express-session 1.19.0, compression
1.8.2, CORS 2.8.6, Hashids 2.3.0, Underscore 1.13.8 and Winston 3.19.0 on the
existing Node 24 toolchain. Stage 4 compiles the server with CoffeeScript 2.7.0
and removes the compiler from production; see [coffeescript.md](coffeescript.md). The browser's vendored libraries and the artwork are unchanged.
Request, cookie-parser and the old body-parser are no longer direct dependencies;
Express supplies current JSON/form parsers. Colors is only a local-authoring
development dependency. Retired helpers using Request are outside supported
commands and the production image; see [legacy/README.md](../legacy/README.md).

## Startup, readiness and shutdown

One Node process owns the HTTP server, manifest cache and optional login sessions.
The Docker command invokes Node directly so it receives container signals. There
is no cluster or test-only CPU override. Use the container runtime's restart
policy for supervision.

Startup loads a complete initial cache before binding the HTTP port. `/health`
then returns `200 OK`; an API response cannot expose the old `null` startup cache.
If neither a valid master nor any individual manifests are available, startup
logs the failure and exits with code 1. A valid empty master is a successful empty
archive and becomes ready normally. A nonempty master with some unavailable
individual manifests becomes ready with the available entries, as before.

SIGTERM and SIGINT stop accepting new connections, abort outgoing manifest
fetches and let active HTTP responses finish. After five seconds, remaining HTTP
connections are closed. Shutdown during initial loading cancels that load and
exits cleanly. Winston writes structured JSON to the container console.

## Manifest loading and refresh

Production loads the remote production master only when
`DOODLE_DATA_SOURCE=production`; other values select the remote DEV master.
On a failed cold-start master request (network error, HTTP error, timeout, invalid
JSON or invalid shape), it uses the application's local DEV master and fetches
the individual remote manifests. This retains the original fallback selection.
Development continues to read local source manifests from `doodles/`.

Fetch decodes gzip responses. Each request, including body reading, has an abort
timeout; individual manifest requests run in a bounded pool. Entries keep their
original metadata, IDs and newest-first order. Contributors retain the same
deduplication and order. Hashids uses the original salt, alphabet and minimum
length; the original shortlinks are regression checked.

Concurrent startup/refresh callers share one operation. Once the cache expires,
reads return the last snapshot while one background refresh runs. A successful
refresh publishes doodles and contributors together and starts a new TTL. An
invalid master, total outage, or failed fetch of a previously available doodle
retains the entire previous snapshot. Failed refreshes retry on a later read,
after a one-second backoff. New unavailable entries can be skipped; an entry
explicitly removed from a valid master is removed on successful refresh. A valid
empty master replaces previous data with empty arrays.

## Configuration and sessions

Existing variables keep their meanings: `NODE_ENV`, `BIND_ADDRESS`, `BIND_PORT`,
`BASE_URL`, `DOODLES_URL`, `DOODLE_DATA_SOURCE`, `GOOGLE_ANALYTICS_CODE`, and
`DEV_PASSWORD`. Development's `DOODLES_ARCHIVE` option is described in
[build.md](build.md).

| Optional setting | Default | Purpose |
| --- | --- | --- |
| `DOODLE_CACHE_TIMEOUT_MS` | 300000 in production, 0 in development | Successful-cache TTL; nonnegative integer. |
| `DOODLE_FETCH_TIMEOUT_MS` | 10000 | Per-request timeout in milliseconds, including JSON body consumption. |
| `DOODLE_FETCH_CONCURRENCY` | 8 | Maximum simultaneous individual-manifest loads. |
| `SESSION_SECRET` | Random per-process secret | Signs the optional password gate's session cookie. |
| `TRUST_PROXY` | Disabled | Express trusted proxy hop count or IP/CIDR list. |

The password gate uses explicit JSON/form parsing, regenerates the session after
login and saves it before redirecting. Anonymous visits do not create saved
sessions. Cookies are HTTP-only and SameSite=Lax, with Secure selected from the
request's protocol. For TLS terminated by a reverse proxy, configure
`TRUST_PROXY` for that proxy so Express can recognize HTTPS. The session store
remains in-process and is appropriate to the existing single-instance preview
gate: restarting the process requires users to log in again. A persistent or
multi-instance authentication system would need a shared store.

The historical push webhook still verifies its signature/branch and returns its
disabled-deployer response. No deployment helper can be reached past that return.

## Templates and static responses

EJS retains the page/metadata contracts. Inline configuration uses JSON escaping
appropriate to a script context; HTML metadata still uses EJS's HTML escaping.
Explicit incomplete-doodle and shortlink routes replace the removed Express 4
wildcard grammar. Existing redirect destinations and status codes are retained.

The shell keeps its precompressed files under normal filenames. Static middleware
checks actual file bytes: clients accepting gzip get the stored bytes, clients
requesting identity get decoded bytes, and clients rejecting both receive 406.
Responses vary on Accept-Encoding, use representation-specific ETags, preserve
Last-Modified, and support HEAD and conditional 304 responses. Compressed files
are sent as whole representations; ordinary binary files retain Express's range
handling. Missing files and ordinary SVGs cannot inherit a gzip header. This does
not change the separate artwork host's encoding policy.

## Verification

`npm run test:server` exercises real local HTTP fixtures and subprocesses for
loading failures, concurrency, refresh, sessions, EJS and signal handling. The
Docker builder runs it alongside the existing build/watch checks. `npm test`
runs the production image's HTTP and browser contracts, then checks container
SIGTERM exit status and restart readiness. See [testing.md](testing.md) for the
recorded results and remaining browser/artwork release checks.

Migration references: [Express 5](https://expressjs.com/en/guide/migrating-5/),
[EJS API](https://ejs.co/#docs),
[session options](https://expressjs.com/en/resources/middleware/session/), and
[Node 24 HTTP lifecycle](https://nodejs.org/docs/latest-v24.x/api/http.html#serverclosecallback).
