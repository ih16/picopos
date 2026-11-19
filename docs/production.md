# Production verification

## Build and host

Use Node 22.12 or newer and `npm ci`. Set the three public Google identifiers from `.env.example`, restrict the Picker API key by API and origin, and configure the exact OAuth JavaScript origin. These frontend identifiers are not secret credentials; never put service-account credentials in `VITE_*` variables.

Run `PUBLIC_ORIGIN=https://www.picopos.app npm run verify`. Deploy only `dist/` to HTTPS hosting at the origin root. The `server/` directory is build-time output, not a production API service. Hash routes need no server rewrites beyond serving `/`.

Serve HTML, `q-data.json`, and `picopos-service-worker.js` with revalidation (`Cache-Control: no-cache`). Serve hashed `build/` and `assets/` files with long-lived immutable caching. Keep prior hashed assets available during deployment so open tabs can load their matching chunks. The offline worker intentionally waits for old tabs to close before activating a new shell.

Use `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. Test any Content Security Policy against Google Identity, Picker, Qwik's bootstrap, and the inline theme initialization before enforcing it.

## Vercel

Import this project into Vercel with the project root as the Root Directory. The checked-in `vercel.json` selects the Other framework preset, installs with `npm ci`, builds with `npm run build`, and publishes `dist/`. It also sets the cache and security headers described above. No route rewrites are needed for hash navigation. Configuration fields follow [Vercel's static configuration reference](https://vercel.com/docs/project-configuration/vercel-json).

In the Vercel project settings, select Node.js 22.x and add `PUBLIC_ORIGIN` with `https://www.picopos.app`, plus `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, and `VITE_GOOGLE_PROJECT_NUMBER` from `.env.example`. Apply the variables to the intended deployment environments and redeploy after changes. Add the deployed origin to the Google OAuth client's authorized JavaScript origins and the Picker API key's website restrictions. Preview deployments that connect to Google need their own authorized origin; use the demo when those credentials are not configured.

Deploy through Vercel's Git integration or, with the Vercel CLI installed, run `vercel` for a preview and `vercel --prod` for production. Keep the normal release checks below; a successful local build does not verify deployed headers or Google authorization.

## Release checks

- Verify demo order creation and confirmation, product/category editing, customers, stock entries, purchase lots, and currency/shipping settings.
- In a disposable shared workbook, test initial setup, legacy migrations, offline saves, reload with queued edits, two-tab saves, reconnect, permission revocation, blocked edits, and interrupted writes followed by sync.
- Check narrow-screen layouts, keyboard navigation, dialog focus, and browser Back/Forward.
- Verify the deployed app opens offline after its first visit and receives a new shell after all older tabs close.

Automated verification does not exercise live Google OAuth, real Sheets writes, or production host caching. Record those release checks against the actual deployment and a disposable workbook; do not infer them from a passing build.

## Dependency audit

Run `npm run audit` against the installed lockfile for each release. Audit results are time-sensitive and are separate from `npm run verify` and CI. Record the audit date, affected dependency chain, and disposition with the release.

`package.json` currently overrides Sharp to `^0.35.5`. Product uploads use browser canvas; Sharp belongs to the Qwik build toolchain. Review the override against the installed dependency tree before changing it. A previous review recorded a Qwik City → Zod finding; rerun the audit to establish whether it still applies. Do not override a dependency across major versions merely to silence an advisory without checking the consuming framework's compatibility.

## Preview and rollback

`npm run preview` serves the built app, normally at `http://localhost:4173`; authorize that exact origin separately if testing Google connection there. The development origin is normally `http://localhost:8899`. Use the URL printed by Vite if a port is already occupied.

Before rolling back, retain the previous complete `dist/` artifact and check compatibility with workbook columns and browser snapshots created by the newer release. Replacing static files does not undo Sheets migrations or local edits. After deployment, close all app tabs and reopen to allow a waiting worker to activate. Do not clear site data to force an update while edits are queued.

## Storage and concurrency limits

Browser data eviction or clearing site data can remove unsynced edits. Requesting persistent storage is best-effort. Staff must use trusted browser profiles; encrypted token storage does not protect against same-origin script compromise.

Google Sheets cannot make the separate stock read and write transactional across devices. Cross-tab locks prevent same-browser races, but simultaneous staff edits can still over-reserve stock. Review negative balances. Strong inventory guarantees require a transactional backend, which this static architecture does not provide.
