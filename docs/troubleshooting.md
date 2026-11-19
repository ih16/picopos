# Troubleshooting

Start in **Settings → Workbook connection**. Check connectivity, authorization, pending change count, and **Preview queued changes**. A local save is not proof that Sheets received the change.

## Google connection

- **Missing configuration:** populate all three identifiers in `.env.local`, then restart development or rebuild production. They are build-time frontend values.
- **Origin or access errors:** check that the exact origin shown in the address bar is authorized for the OAuth client, that the chosen account can edit the workbook, and that it is allowed by the OAuth consent configuration. Preview and development normally use different ports.
- **Picker fails:** check the Picker API configuration, API key restrictions, and numeric project number. Follow the [setup steps](../README.md#connect-google-sheets).
- **Session expired:** use **Reconnect**. Local edits can continue while authorization is expired; network sync needs a valid token. Use **Use another Google account** when the wrong account is selected.

Do not share access tokens, browser storage dumps, or private workbook contents when reporting an error.

## Pending or blocked changes

Automatic sync runs in an open, visible app at the configured interval, with additional checks when the tab becomes visible or the browser comes online. Closing every tab stops sync. **Sync now** bypasses the interval, but still needs network access and authorization.

If a write times out, leave the queue intact and sync again. A timeout does not establish whether Google applied the write. The next sync reads fresh data and uses stable IDs and field comparisons to recognize already-applied edits.

A validation issue remains attached to its queued operation. Inspect the preview, correct the underlying workbook problem (for example insufficient stock or a missing reference), then sync again. If the local operation is no longer wanted, discard that operation from the preview. Discarding removes the queued intent; it is not an undo for a write already applied to Sheets. Dependent operations may need review afterward.

Disconnect is blocked while edits remain queued. Sync or deliberately discard those edits first. Do not clear browser data as a shortcut: it removes pending edits and offline copies.

## Workbook errors

- **Unexpected headers:** compare the managed tab with the [exact header reference](workbook.md#managed-tabs). Preserve column order, spelling, and IDs.
- **Occupied migration column:** move custom contents out of the reserved column before reconnecting. Do not overwrite them to force setup.
- **Unsupported schema:** this app expects `schemaVersion` equal to `1`. Investigate the workbook's origin rather than changing its version marker blindly.
- **Invalid cell:** follow the tab/row/field reported in the error. Numeric fields require numeric cells, Active requires a boolean, and statuses must match supported values.
- **Negative inventory:** inspect stock entries, order statuses/quantities, and returns. Direct Sheets edits bypass app transition controls. Preserve historical order lines and use stock entries or returns for the appropriate correction.

## Browser storage and offline opening

Connected work requires OPFS, writable file handles, and Web Locks in a secure context. If the browser reports that it cannot save, check site storage permissions and browser support. Free storage for a quota error without deleting this site's data while changes are pending.

An unreadable saved workbook is preserved instead of overwritten. Keep that browser profile intact and investigate before resetting it; there is no documented automatic recovery or export flow for a corrupt local snapshot.

Offline opening requires a production build and a successful earlier shell-cache installation. Test it with `npm run build` followed by `npm run preview`. The development server deliberately retires the offline worker. Google sign-in and initial workbook setup still require connectivity.

If an old release remains visible, close all picopos tabs and reopen. A new worker waits for older tabs to close before activation. This behavior preserves matching chunks for open sessions.

## Reporting a problem

Include the app origin, browser/version, affected screen, exact error text, whether this is demo or a connected workbook, whether the browser is online, pending change count, and steps to reproduce. For a UI issue, include viewport size and theme. Redact customer information and credentials. Identify whether a save was local, synced, or uncertain.
