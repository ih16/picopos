# Development setup

picopos runs as a static Qwik app. Local development needs Node.js 22.12 or newer and npm; Make is optional. There is no application backend, database server, Docker stack, or service-account setup to run. Google connection is optional for demo development.

## First run

From the project root:

```sh
node --version
npm --version
make install
make dev
```

Without Make, use `npm ci` and `npm run dev`. Install from `package-lock.json` with `npm ci` to use the locked dependency versions. Open the URL printed by Vite, normally `http://localhost:5173`, and choose **Try the demo**. Demo changes reset when you reload or leave it.

For Google-connected development, create `.env.local` from `.env.example` if it does not already exist, fill in the three public Google identifiers, and restart the server. Keep existing local configuration when repeating setup. Follow [Google setup](../README.md#connect-google-sheets) and use a disposable workbook for development and migration testing.

## Environment variables

| Variable                     | Purpose                                                                  | Required for                             |
| ---------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID`      | Google OAuth Web application client ID                                   | Google sign-in                           |
| `VITE_GOOGLE_API_KEY`        | Restricted Google Picker API key                                         | Workbook picker                          |
| `VITE_GOOGLE_PROJECT_NUMBER` | Numeric Google Cloud project number, not project ID                      | Workbook picker                          |
| `PUBLIC_ORIGIN`              | Origin passed to the static adapter; defaults to `http://localhost:4173` | Builds for a different deployment origin |

The `VITE_*` values are read in `src/infrastructure/google/google.ts` and bundled into frontend assets. They are public identifiers, not a place for client secrets or service-account credentials. Apply the Google restrictions described in setup. `.env.local` and other private env files are ignored by Git; `.env.example` is the tracked template.

Vite loads `.env` and `.env.local`, plus files for the selected mode. The development script explicitly uses mode `ssr`, so its mode-specific files are `.env.ssr` and `.env.ssr.local`. Builds use the default production mode, with `.env.production` and `.env.production.local`. Mode-specific values override generic files, and variables already set in the shell take priority. `.env.local` is the simplest shared local configuration for both development and builds.

`PUBLIC_ORIGIN` is read directly from `process.env` in `adapters/static/vite.config.ts`. Supply it through the shell or CI environment; placing it only in a Vite env file does not configure the current adapter:

```sh
PUBLIC_ORIGIN=https://your-domain.example make build
```

Restart development after changing environment configuration. Rebuild to update frontend values in `dist/`; setting new variables while serving an existing build does not rewrite that build. `PUBLIC_ORIGIN` does not change Vite's listening port or add an authorized Google origin.

## Makefile commands

The [Makefile](../Makefile) delegates to `package.json`; keep npm scripts as the command source of truth. Running `make` without a target shows help.

| Make target         | npm equivalent         | Behavior                                       |
| ------------------- | ---------------------- | ---------------------------------------------- |
| `make help`         | —                      | Show available shortcuts                       |
| `make install`      | `npm ci`               | Install locked dependencies                    |
| `make dev`          | `npm run dev`          | Start the development server                   |
| `make build`        | `npm run build`        | Build static output and offline worker         |
| `make preview`      | `npm run preview`      | Serve the existing build; does not build first |
| `make check`        | `npm run check`        | TypeScript checks                              |
| `make test`         | `npm test`             | Run the regression suite                       |
| `make verify`       | `npm run verify`       | Check formatting, types, tests, then build     |
| `make audit`        | `npm run audit`        | Inspect dependency advisories separately       |
| `make format`       | `npm run format`       | Rewrite repository formatting                  |
| `make format-check` | `npm run format:check` | Check formatting without rewriting             |

Only `dev` and `preview` forward `ARGS` to Vite:

```sh
make dev ARGS="--port 5174 --strictPort"
make preview ARGS="--port 4174 --strictPort"
```

`--strictPort` makes an occupied port an error instead of allowing Vite to choose another port. Authorize the actual origin in Google OAuth and Picker configuration. `localhost` and `127.0.0.1`, and different ports, are different origins with separate browser storage.

Targets do not automatically install dependencies. Run `make install` before development or verification. Run build and preview sequentially; avoid running formatting and verification concurrently. Makefile recipe indentation must use tabs; `.editorconfig` includes that exception.

## Preview and offline development

```sh
make build
make preview
```

Preview normally serves `http://localhost:4173`. For a different preview origin, use matching build and preview settings:

```sh
PUBLIC_ORIGIN=http://localhost:4174 make build
make preview ARGS="--port 4174 --strictPort"
```

The build produces `dist/` for hosting and `server/` as intermediate static-generation output. Edit source files, not these generated directories. Preview serves static assets and does not provide a production API server.

Offline shell testing requires the production build, a secure context, and a successful online visit that installs the worker. Connected workbook persistence also requires OPFS, writable file handles, and Web Locks. The development server deliberately unregisters a previous offline worker on its origin. Close all older preview tabs to allow a new worker to activate; avoid clearing site data while changes are queued. See [troubleshooting](troubleshooting.md#browser-storage-and-offline-opening).

## Testing and contribution loop

1. Trace the existing feature and domain rules using [architecture and conventions](architecture.md).
2. Make the scoped change and add regression coverage when behavior changes. Keep tests independent of live Google credentials and workbooks.
3. Run `make format`, then `make verify` before handing off the change.
4. Exercise affected screens in the demo. For Sheets, storage, or authorization changes, also run the relevant [release checks](production.md#release-checks) in a disposable workbook.

`make verify` matches CI's `npm run verify`. It does not run the advisory audit or live Google/browser checks. Run `make audit` separately when reviewing dependencies.

For a focused existing test, invoke Node directly; `ARGS` is not forwarded by `make test`:

```sh
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/screen-route.test.ts
```

Use [the design system](../DESIGN.md) for UI work and [the workbook reference](workbook.md) before changing persisted columns or migration behavior.
