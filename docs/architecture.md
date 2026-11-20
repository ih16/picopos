# Architecture and conventions

picopos is a static, browser-owned SolidJS application. Google Sheets is the shared source of truth; OPFS holds the last snapshot and an outbox. The demo uses the same validation and projection rules in memory.

## Boundaries

`main.tsx` mounts `app/workspace.tsx`. The workspace composes screens and shared controls. Before a workbook loads, the workspace displays an inactive preview. The real demo is created when users enter or restore demo mode. `use-workspace-navigation.ts` owns URL/tab state; `use-workbook.ts` owns connection, local edits, and sync lifecycle. Feature components own their forms, filters, and display state. Business Settings keeps an overlay for edited fields and preserves the original values used to queue those edits. Background sync refreshes the untouched fields.

The domain must remain independent of SolidJS, browser storage, and Google APIs. `workbook.ts` defines persisted records and validation; `outbox.ts` merges field-level edits and projects pending changes. Infrastructure owns effects: Google authorization, Sheets requests/schema upgrades, and OPFS reads/writes. Infrastructure uses domain rules, never UI components. Shared UI must not import feature components. Sync interval choices and parsing live in the domain; browser preferences and timing keys live in infrastructure.

Record lists read 12-row pages from the filtered local workbook. Solid Primitives selects pages by scroll offset, and ResizeObserver measures wrapped or expanded pages. Orders formats totals and return labels for mounted pages. Search, balances, and journey counts use the full snapshot. Opening a list or scrolling it does not start a Sheets sync.

The orders feature separates creation, detail/list views, return receipt, and presentation helpers. The domain owns line subtotals and order totals so forms, reports, order history, and validation agree. Catalog option parsing and browser image conversion are independent of the catalog editor. Shared searchable controls have their own module; `controls.tsx` exposes the small public UI surface.

## Saving and syncing

1. A form sends a typed `RowChange[]` plus its original edited rows.
2. The local write lock reads the latest snapshot, merges only edited fields, validates, and atomically closes the new OPFS file.
3. The outbox projects unblocked edits into the visible workbook. BroadcastChannel notifies other tabs.
4. The separate sync lock serializes network sync for a workbook across tabs. Sync resolves Google authorization after acquiring the lock. A rejected request can invalidate only the session it used. If a different session has replaced it, sync can retry once from fresh Sheets data and the latest local outbox. Each sync reads fresh Sheets data, checks compatibility before writing migrations, validates pending changes, and reads back the batch before acknowledging it.
5. `sync-workbook-queue.ts` reconciles each confirmed result against the latest local snapshot. The captured queue can span several batches while edits saved during sync stay queued for the next run. A failed or uncertain write retains queued edits. Stable record IDs and readback allow the next sync to recognize applied changes. Never retry a POST directly.

Sheets reads have a 30-second deadline per attempt and at most three attempts for network failures, rate limits, and server errors. Retry delays grow exponentially with jitter. Writes have the same deadline but no automatic transport retry.

Preserve persisted `piecom.*` keys, workbook tab headers, IDs, and schema migration rules. A branding or folder change must not migrate storage implicitly.

## Component file structure

Feature directories group screens with their forms, presentation helpers, and types. A component file starts with imports, followed by its props and local constants or pure helpers, then the named component. Inside the component, group state and derived values, event handlers and lifecycle subscriptions, then return the JSX. Shared controls expose values and callbacks. Async workbook commands own persistence, authorization, and concurrency.

## Coding conventions

- Use strict TypeScript, explicit domain types, named exports, and feature-local helpers.
- Read reactive props in JSX or memos. Use Solid effects for browser listeners and measurement, and return their cleanup callbacks.
- Reuse shared controls for keyboard/focus behavior and consistent form semantics.
- Keep validation in the domain; UI validation may guide users to a field, but it cannot replace save-time and sync-time validation.
- Add regression tests for behavior changes. Preserve test order and existing assertions. Tests must not contact a real workbook.
- Run `npm run verify`; use `npm run audit` separately to inspect current advisories. Do not use `npm audit fix --force` to downgrade the framework or override a major API blindly.

References: [SolidJS](https://github.com/solidjs/solid) and [Sheets API limits](https://developers.google.com/workspace/sheets/api/limits).

## Navigation and derived views

`app/navigation/screen-route.ts` defines hash routes and tab identities. Detail routes encode record keys; URL parsing falls back to Orders for unknown or malformed routes. Navigation retains open tabs during the visit, while the hash restores only the current screen after a reload. Form drafts and filters are feature state, not persisted navigation state. See the [route list](../README.md#screen-navigation).

`domain/dashboard.ts` derives metrics from the projected workbook, including pending local changes. `domain/settings.ts` normalizes the display currency and number format; shipping option parsing and purchase-lot summaries live in `domain/workbook.ts`. The Inventory sheet is a formula projection; browser balances are independently calculated by `getInventory`. Changes to stock rules must keep both implementations consistent.

## Build and generated files

`npm run build` builds the workspace and Help entry points, adds a content security policy to the generated HTML, and generates the offline worker with `scripts/build-offline-shell.mjs`. The worker caches a content-versioned shell and bundled assets, not Google API responses. `scripts/offline-worker.js` owns its cache behavior. Development serves a worker that unregisters itself to retire a prior preview on the same origin.

Edit `src/`, `scripts/`, and configuration sources; `dist/` contains generated output. `output/` is excluded from formatting and is not an application source directory. Public Google identifiers are compiled from `VITE_*` values.

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

1. The browser suite covers deep links, open-tab drafts, catalog interactions, and offline reload. Extend it to cover workbook setup with a controlled Sheets fixture. Keep browser-specific listeners where browser initialization or synchronous popup handling requires them.
2. Profile large workbooks before changing persistence. Pending edits currently rewrite the encrypted workbook snapshot. Measure write latency and memory with representative data and photos before considering a journal. For expensive domain calculations, start by reusing validated projections and deriving inventory only where a rule needs it.
3. If stock updates must be strictly serialized across devices, move that invariant to a transactional shared store. The browser locks and Sheets batch requests cover different boundaries, as described in [production limitations](production.md#storage-and-concurrency-limits).
