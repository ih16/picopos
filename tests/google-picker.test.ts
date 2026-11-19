import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function pickerHarness() {
  const settings: Record<string, unknown> = {};
  let callback: (response: unknown) => void;
  let disposed = false;
  class View {
    setMode(value: string) {
      settings.mode = value;
      return this;
    }
    setMimeTypes(value: string) {
      settings.mime = value;
      return this;
    }
    setQuery(value: string) {
      settings.query = value;
      return this;
    }
  }
  class Builder {
    addView() {
      return this;
    }
    setSelectableMimeTypes() {
      return this;
    }
    setDeveloperKey() {
      return this;
    }
    setAppId() {
      return this;
    }
    setOAuthToken() {
      return this;
    }
    setCallback(value: typeof callback) {
      callback = value;
      return this;
    }
    build() {
      return {
        setVisible() {},
        dispose() {
          disposed = true;
        },
      };
    }
  }
  const source = readFileSync(
    new URL('../src/infrastructure/google/google.ts', import.meta.url),
    'utf8',
  ).replaceAll(
    'import.meta.env',
    '({ VITE_GOOGLE_CLIENT_ID: "client", VITE_GOOGLE_API_KEY: "key", VITE_GOOGLE_PROJECT_NUMBER: "project" })',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {} as {
    pickSpreadsheet: (
      token: string,
      signal?: AbortSignal,
    ) => Promise<{ id: string; name: string } | undefined>;
  };
  runInNewContext(outputText, {
    exports,
    window: {
      gapi: {},
      google: {
        picker: {
          DocsView: View,
          PickerBuilder: Builder,
          ViewId: { SPREADSHEETS: 'sheets' },
          DocsViewMode: { LIST: 'list' },
          Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error' },
        },
      },
    },
  });
  return { api: exports, settings, respond: (value: unknown) => callback(value), disposed: () => disposed };
}

test('picker starts with picopos spreadsheet search and returns the selected workbook', async () => {
  const picker = pickerHarness();
  const result = picker.api.pickSpreadsheet('token');
  await Promise.resolve();
  assert.deepEqual(picker.settings, {
    mode: 'list',
    mime: 'application/vnd.google-apps.spreadsheet',
    query: 'picopos',
  });
  picker.respond({ action: 'picked', docs: [{ id: 'book', name: 'picopos · Shop' }] });
  assert.equal((await result)?.id, 'book');
  assert.equal(picker.disposed(), true);
});

test('picker cancellation and abort release the chooser without selecting a workbook', async () => {
  for (const abort of [false, true]) {
    const picker = pickerHarness();
    const controller = new AbortController();
    const result = picker.api.pickSpreadsheet('token', controller.signal);
    await Promise.resolve();
    if (abort) controller.abort();
    else picker.respond({ action: 'cancel' });
    assert.equal(await result, undefined);
    assert.equal(picker.disposed(), true);
  }
});
