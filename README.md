<div align="center">
  <img src="public/picopos-mark.svg" alt="" width="72" height="72" />
  <h1>picopos</h1>
  <p><strong>Your shop. Your spreadsheet.</strong></p>
  <p>Catalog, orders, and inventory in one browser app, backed by a Google Sheet you own.</p>
  <p>
    <a href="https://www.picopos.app/">Open picopos</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#connect-google-sheets">Google Sheets setup</a> ·
    <a href="#documentation">Documentation</a> ·
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

picopos helps small shops manage day-to-day operations without running an application backend or database server. It runs as a static web app, connects directly to Google Sheets, and keeps a local copy of your workbook so you can continue working offline.

Each staff member signs in with their own Google account. Your workbook's sharing permissions control access, and your business data stays accessible in Sheets.

## Features

- **Product catalog** — Products, variants, SKUs, nested categories, and photo thumbnails stored in your workbook.
- **Order management** — Drafts, stock reservations, shipping, completion, discounts, and separate payment statuses.
- **Returns and inventory** — Partial returns, sellable and damaged stock, stock corrections, purchase lots, and calculated balances.
- **Customer directory** — Saved contacts and addresses, with customer details preserved on historical orders.
- **Shop overview** — Order summaries, fulfilled order value, top products, and low-stock visibility.
- **Offline work** — Local saves, a persistent queue of pending changes, configurable foreground sync, and a preview of queued edits.
- **Shared workbooks** — Staff access through Google accounts, with coordinated saves across tabs in the same browser profile.
- **Responsive interface** — Light and dark themes, direct links to screens, and browser Back/Forward support.

## Quick start

### Requirements

- **Node.js 22.12 or newer** and npm.
- A browser with **Origin Private File System (OPFS)** writable files and **Web Locks** for connected workspaces.
- **HTTPS or localhost** for browser storage and offline capabilities.

From the project directory:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:8899`, and choose **Try the demo**. No Google credentials are needed for the demo; its changes stay in memory and reset when you reload or leave it.

Make shortcuts are also available: `make install`, `make dev`, and `make help`. See the [development guide](docs/development.md) for environment modes, custom ports, and local previews.

## Connect Google Sheets

1. **Configure a Google Cloud project.** Enable the Google Sheets API and Google Picker API.
2. **Create an OAuth client.** Configure the consent screen and create a **Web application** client. Add the exact JavaScript origins you will use, such as `http://localhost:8899` and `https://www.picopos.app`. For the public deployment, use the app name `picopos`, authorize `picopos.app` under Branding, and publish the External audience to production.
3. **Create a Picker API key.** Use the same Cloud project. Restrict the key to the Google Picker API and configure website restrictions for `https://www.picopos.app/*`, your development origins, and `https://docs.google.com/*`.
4. **Set the public browser configuration.** Copy `.env.example` to `.env.local` if you do not already have local configuration, then fill in:

   ```dotenv
   VITE_GOOGLE_CLIENT_ID=your-web-application-client-id
   VITE_GOOGLE_API_KEY=your-restricted-picker-api-key
   VITE_GOOGLE_PROJECT_NUMBER=your-numeric-cloud-project-number
   ```

5. **Restart the development server or rebuild.** These values are bundled into the frontend. They must not contain client secrets or service-account credentials.
6. **Choose a workbook.** Create a blank Google spreadsheet, share it with staff who need edit access, and select it in picopos. Each staff member connects using their own account.

picopos requests the `drive.file` scope for files authorized through the app. It creates the managed workbook tabs and leaves unrelated tabs alone. Start with a blank workbook for the simplest setup; see the [workbook reference](docs/workbook.md) before connecting an existing one.

When Google access expires, choose **Reconnect** to resume sync from your current screen. Local edits can continue while disconnected. Use **Use another Google account** to switch accounts.

## How it works

```text
Browser                                      Google Sheets
┌──────────────────────────────┐             ┌───────────────────────┐
│ picopos                      │             │ Your shared workbook  │
│                              │  Sheets API │                       │
│ Screens and business rules   │ ◄─────────► │ Catalog and customers │
│ Local workbook + edit queue  │             │ Orders and returns    │
│ Persisted in browser OPFS    │             │ Stock and settings    │
└──────────────────────────────┘             └───────────────────────┘
```

A save updates the local workbook and inventory immediately, then queues the change for sync. After the first successful connection, the browser retains the workbook and pending edits in OPFS. Production builds also cache the app shell after an online visit so it can reopen offline; the development server does not provide offline shell caching.

In **Settings → Sync settings**, choose the minimum interval between automatic syncs. The default is 30 seconds. While the app is open, sync checks for Sheet edits and uploads queued changes in batches. Returning to the tab or coming back online triggers sync when due. Use **Sync now** for an immediate attempt, or **Preview queued changes** to inspect pending edits and validation issues.

If both sides edit the same field before sync, the picopos value wins. Changes to other fields in Sheets are preserved. Changes that reference deleted records or fail validation stay queued for review.

### Inventory behavior

| Order status | Stock effect                                     |
| ------------ | ------------------------------------------------ |
| Draft        | No stock effect                                  |
| In progress  | Reserve the order's quantities                   |
| Shipped      | Deduct quantities on hand and clear reservations |
| Completed    | Keep shipped quantities deducted                 |
| Cancelled    | Release reservations                             |

Available stock is **on hand − reserved − unavailable**. Requested returns do not affect stock. Received sellable returns restore available stock; received damaged returns increase on-hand and unavailable stock together.

See [daily workflows](docs/workflows.md) for supported transitions, partial returns, purchase lots, and dashboard metric definitions.

### Operational limits

- **Sync runs in the foreground.** Check sync status before closing the app or changing devices.
- **Unsynced edits belong to the browser profile.** Clearing site data or browser storage eviction can remove them. Use a trusted profile and resolve pending changes before disconnecting a workbook.
- **Stock reservations are not transactional across devices.** Google Sheets cannot make a separate stock read and write atomic. Simultaneous staff edits can over-reserve stock; review negative balances.
- **Direct Sheet edits bypass app validation.** Keep managed headers and IDs intact. Preserve shipped order lines and received returns; use returns and stock entries to record subsequent changes.
- **Dashboard totals are operational summaries.** They are not cash receipts, profit, or accounting reports.

## Development

Built with **Qwik City**, **TypeScript**, and **Vite**, using Google Identity, Google Picker, and the Google Sheets API. Browser persistence uses OPFS; no application API server is required.

| Command                | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start the development server                  |
| `npm run check`        | Run strict TypeScript checks                  |
| `npm test`             | Run the regression suite                      |
| `npm run format`       | Format project files                          |
| `npm run format:check` | Check formatting without modifying files      |
| `npm run build`        | Build the static app and offline shell        |
| `npm run preview`      | Serve the existing production build locally   |
| `npm run verify`       | Check formatting, types, tests, and the build |
| `npm run audit`        | Check dependency advisories separately        |

### Project structure

```text
src/
├── app/              Workspace composition, lifecycle, and navigation
├── domain/           Workbook types, business rules, and sync merging
├── features/         Catalog, orders, customers, inventory, and settings
├── infrastructure/   Google integration and browser persistence
├── routes/           Qwik City entry points
├── shared/           Reusable controls, hooks, and formatting
└── styles/           Application styles and design tokens
tests/                Regression tests
scripts/              Offline shell build and service worker
adapters/static/      Static build configuration
docs/                 Setup, workflows, schema, and release guides
```

Screens use hash routes such as `#/orders`, `#/catalog`, and `#/inventory`. Direct links, reloads, and browser Back/Forward work with static hosting. Unsaved form values and filters are not persisted by navigation.

## Deployment

Build for your deployment origin, then publish **`dist/`** to a static HTTPS host at the origin root:

```sh
PUBLIC_ORIGIN=https://www.picopos.app npm run verify
npm run preview
```

Set the Google environment variables before building and authorize the deployed origin in Google Cloud. The generated `server/` directory is used for static generation and is not a production backend. Hash routes do not require application route rewrites.

The project includes `vercel.json` for Vercel hosting. Follow the [production guide](docs/production.md) for configuration, cache headers, offline updates, and release checks. Automated checks do not verify live Google authorization, real workbook writes, or production caching.

## Documentation

| Guide                                         | Covers                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| [Development setup](docs/development.md)      | Environment variables, Make commands, tests, and preview |
| [Daily workflows](docs/workflows.md)          | Orders, customers, returns, stock, and dashboard metrics |
| [Workbook reference](docs/workbook.md)        | Managed tabs, exact headers, relationships, and upgrades |
| [Architecture](docs/architecture.md)          | Code boundaries, conventions, and verification           |
| [Design system](DESIGN.md)                    | Shared controls, themes, and responsive review           |
| [Troubleshooting](docs/troubleshooting.md)    | Connection, offline storage, and queued changes          |
| [Production verification](docs/production.md) | Hosting, release checks, caching, and rollback           |

## Contributing

Start with the [development guide](docs/development.md) and [architecture conventions](docs/architecture.md). Keep changes focused and follow the existing domain rules and UI patterns.

1. Reproduce the issue or describe the behavior you are adding.
2. Make the change and add regression coverage when behavior changes.
3. Run `npm run format`, followed by `npm run verify`.
4. Exercise affected screens in the demo. For authorization, storage, or Sheets changes, also test against a disposable workbook using the [release checklist](docs/production.md#release-checks).
5. Describe the change, the checks performed, and any remaining limitations in your pull request.

Keep credentials, private environment files, and real customer data out of contributions. For bug reports, include reproduction steps, browser details, and relevant errors with sensitive information removed.

## License

picopos is licensed under the [MIT License](LICENSE).
