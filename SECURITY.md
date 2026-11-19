# Security notes

picopos is a static browser application. Google enforces workbook access through the `drive.file` OAuth scope and spreadsheet sharing. A filename or picker search is not an authorization check.

## Browser policy

Production HTML receives a hash-based Content Security Policy after prerendering and before the offline shell is versioned. Rebuild after changing generated scripts; do not edit built HTML after hashes are generated. Inline event handlers and eval are disallowed. Google Identity Services, Picker, and Sheets endpoints are explicitly allowed. Vercel headers prevent framing and preserve OAuth popup communication. The preview server uses the same headers.

The policy reduces script-injection risk, but any script that succeeds in running on the app origin can still access browser-held credentials and data. Encryption with a key available to that same origin does not prevent XSS or protect an unlocked browser profile.

## Offline data

Workbook snapshots and pending edits are encrypted with AES-GCM using a non-exportable device key in IndexedDB, separate from Google session keys. The workbook ID is authenticated with the ciphertext. Existing plaintext workbooks migrate when opened, under the workbook lock. Failed reads or writes do not discard queued work. Untouched legacy workbook files remain plaintext until opened.

Offline access intentionally remains available without a fresh Google login. Use a separate, locked OS/browser profile on shared devices. Sync and disconnect when finished; disconnect removes the current workbook's local file and remembered Google session. Previously opened workbooks may retain their own local files. Never clear site data or IndexedDB while unsynced changes remain: losing the encryption key makes those changes unrecoverable. This is not a substitute for device encryption or a passphrase-protected app lock.

## Dependency advisory requiring an upstream fix

`npm audit` currently reports GHSA-mrhx-c7xc-m3w5 through Qwik City's pinned Zod 3.25.48. The advisory's patched release is Zod 4.6.6 or later. Qwik City 1.20.4 still pins 3.25.48 and its validator calls `z.Schema`, which Zod 4.6.7 does not export. Do not force a major override or use `npm audit fix --force`.

This app does not use Qwik's Zod validators or server actions and deploys only static `dist` files. No Zod validation code was found in the generated browser bundles in this review. That limits present exposure but does not clear the dependency advisory. Reassess before adding validation/server endpoints and upgrade when Qwik provides a compatible fix.
