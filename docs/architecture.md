# Architecture and conventions

picopos is a static, browser-owned Qwik application. Google Sheets is the shared source of truth; OPFS holds the last snapshot and an outbox. The demo uses the same validation and projection rules in memory.

## Boundaries

`routes/index.tsx` mounts `app/workspace.tsx`. The workspace composes screens and shared controls. Before a workbook loads, a static backdrop keeps demo records and feature state out of the prerendered HTML. The real demo is created when users enter or restore demo mode. `use-workspace-navigation.ts` owns URL/tab state; `use-workbook.ts` owns connection, local edits, and sync lifecycle. Feature components own their forms, filters, and display state.

The domain must remain independent of Qwik, browser storage, and Google APIs. `workbook.ts` defines persisted records and validation; `outbox.ts` merges field-level edits and projects pending changes. Infrastructure owns effects: Google authorization, Sheets requests/schema upgrades, and OPFS reads/writes. Infrastructure uses domain rules, never UI components. Shared UI must not import feature components. Sync interval choices and parsing live in the domain; browser preferences and timing keys live in infrastructure.

The orders feature separates creation, detail/list views, return receipt, and presentation helpers. The domain owns line subtotals and order totals so forms, reports, order history, and validation agree. Catalog option parsing and browser image conversion are independent of the catalog editor. Shared searchable controls have their own module; `controls.tsx` exposes the small public UI surface.

## Saving and syncing

1. A form sends a typed `RowChange[]` plus its original edited rows.
2. The local write lock reads the latest snapshot, merges only edited fields, validates, and atomically closes the new OPFS file.
3. The outbox projects unblocked edits into the visible workbook. BroadcastChannel notifies other tabs.
4. The separate sync lock serializes network sync for a workbook across tabs. Each sync reads fresh Sheets data, checks compatibility before writing migrations, validates pending changes, and reads back the batch before acknowledging it.
5. `sync-workbook-queue.ts` reconciles each confirmed result against the latest local snapshot. The captured queue can span several batches while edits saved during sync stay queued for the next run. A failed or uncertain write retains queued edits. Stable record IDs and readback allow the next sync to recognize applied changes. Never retry a POST directly.

Sheets reads have a 30-second deadline per attempt and at most three attempts for network failures, rate limits, and server errors. Retry delays grow exponentially with jitter. Writes have the same deadline but no automatic transport retry.

Preserve persisted `piecom.*` keys, workbook tab headers, IDs, and schema migration rules. A branding or folder change must not migrate storage implicitly.

## Coding conventions

- Use strict TypeScript, explicit domain types, named exports, and feature-local helpers.
- Keep Qwik callbacks as QRLs (`$`/`component$`). Do not capture nonserializable clients, DOM elements, or arbitrary class instances across resumable boundaries.
- Use computed signals for derived state. Keep browser APIs out of server rendering; use visible tasks only for browser initialization, measurement, or lifecycle listeners, with cleanup.
- Reuse shared controls for keyboard/focus behavior and consistent form semantics.
- Keep validation in the domain; UI validation may guide users to a field, but it cannot replace save-time and sync-time validation.
- Add regression tests for behavior changes. Preserve test order and existing assertions. Tests must not contact a real workbook.
- Run `npm run verify`; use `npm run audit` separately to inspect current advisories. Do not use `npm audit fix --force` to downgrade the framework or override a major API blindly.

References: [Qwik tasks and lifecycle](https://qwik.dev/docs/core/tasks/), [Qwik best practices](https://qwik.dev/docs/guides/best-practices/), and [Sheets API limits](https://developers.google.com/workspace/sheets/api/limits).

## Navigation and derived views

`app/navigation/screen-route.ts` defines hash routes and tab identities. Detail routes encode record keys; URL parsing falls back to Orders for unknown or malformed routes. Navigation retains open tabs during the visit, while the hash restores only the current screen after a reload. Form drafts and filters are feature state, not persisted navigation state. See the [route list](../README.md#screen-navigation).

`domain/dashboard.ts` derives metrics from the projected workbook, including pending local changes. `domain/settings.ts` normalizes the display currency and number format; shipping option parsing and purchase-lot summaries live in `domain/workbook.ts`. The Inventory sheet is a formula projection; browser balances are independently calculated by `getInventory`. Changes to stock rules must keep both implementations consistent.

## Build and generated files

`npm run build` builds the browser bundle, runs the static adapter, adds a content security policy to the generated HTML, and generates the offline worker with `scripts/build-offline-shell.mjs`. The worker caches a content-versioned shell and bundled assets, not Google API responses. `scripts/offline-worker.js` owns its cache behavior. Development serves a worker that unregisters itself to retire a prior preview on the same origin.

Edit `src/`, `scripts/`, and configuration sources; `dist/` and `server/` are generated output. `output/` is excluded from formatting and is not an application source directory. Public Google identifiers are compiled from `VITE_*` values; `PUBLIC_ORIGIN` configures the static adapter and defaults to `http://localhost:4173`.

## Verification commands

See [development setup](development.md) for prerequisites, environment modes, and Makefile equivalents.

| Command                | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run format:check` | Check repository formatting without writing files                |
| `npm run check`        | Strict TypeScript checking                                       |
| `npm test`             | Run `tests/*.test.ts` with Node's test runner and type stripping |
| `npm run build`        | Generate static assets and the offline shell                     |
| `npm run verify`       | Run all four checks in that order                                |
| `npm run audit`        | Inspect dependency advisories separately                         |

Tests cover domain behavior, outbox replay, migrations, Sheets transport, Google session storage, routing, and virtual window calculations. They do not replace the [release checks](production.md#release-checks). When updating documentation, check local links and formatting; when documenting behavior, trace the owning implementation and its tests rather than assuming a UI label defines the rule.

See [workbook schema](workbook.md) before changing persisted fields and [troubleshooting](troubleshooting.md) before proposing storage resets.

## Refactor priorities

1. Protect active sessions and drafts. A Sheets failure from an older request can clear authorization renewed by another tab. Make invalidation conditional on the credential actually used. Business Settings currently refreshes editable fields when synced values change. Preserve dirty fields and their edit baselines across a refresh.
2. Add built-browser smoke coverage for workbook setup, deep links, open-tab draft preservation, and offline reload before splitting larger feature components or reorganizing the shared stylesheet. Keep browser-specific listeners where browser initialization or synchronous popup handling requires them.
3. Profile large workbooks before changing persistence. Pending edits currently rewrite the encrypted workbook snapshot. Measure write latency and memory with representative data and photos before considering a journal. For expensive domain calculations, start by reusing validated projections and deriving inventory only where a rule needs it.
4. If stock updates must be strictly serialized across devices, move that invariant to a transactional shared store. The browser locks and Sheets batch requests cover different boundaries, as described in [production limitations](production.md#storage-and-concurrency-limits).
