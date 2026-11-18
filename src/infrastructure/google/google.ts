const driveScope = 'https://www.googleapis.com/auth/drive.file';
const spreadsheetMimeType = 'application/vnd.google-apps.spreadsheet';
const tokenStorageKey = 'piecom-google-session';
const tokenKeyStore = 'keys';
const tokenKeyId = 'access-token';

const config = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim(),
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY?.trim(),
  projectNumber: import.meta.env.VITE_GOOGLE_PROJECT_NUMBER?.trim(),
};

export interface SpreadsheetSelection {
  id: string;
  name: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
}

interface RememberedToken {
  workbookId: string;
  expiresAt: number;
  iv: string;
  ciphertext: string;
}

interface OAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes: boolean;
    callback: (response: TokenResponse) => void;
    error_callback: (error: { type: string }) => void;
  }): { requestAccessToken(config: { prompt: string }): void };
}

interface DocsView {
  setMode(mode: string): DocsView;
  setMimeTypes(mimeTypes: string): DocsView;
}

interface PickerResponse {
  action: string;
  docs?: { id?: string; name?: string; mimeType?: string }[];
}

interface PickerBuilder {
  addView(view: DocsView): PickerBuilder;
  setSelectableMimeTypes(mimeTypes: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void; dispose(): void };
}

interface PickerApi {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId: string) => DocsView;
  ViewId: { SPREADSHEETS: string };
  DocsViewMode: { LIST: string };
  Action: { PICKED: string; CANCEL: string; ERROR: string };
}

interface GoogleWindow extends Window {
  google?: {
    accounts?: { oauth2?: OAuth2 };
    picker?: PickerApi;
  };
  gapi?: {
    load: (
      module: string,
      options: {
        callback: () => void;
        onerror: () => void;
        timeout: number;
        ontimeout: () => void;
      },
    ) => void;
  };
}

let activeToken: { value: string; expiresAt: number } | undefined;
let tokenKey: Promise<CryptoKey> | undefined;
const scripts = new Map<string, Promise<void>>();
let pickerLoading: Promise<void> | undefined;

const googleWindow = () => window as GoogleWindow;

export const isGoogleConfigured = Boolean(config.clientId && config.apiKey && config.projectNumber);

export function getAccessToken(allowExpired = false): string | undefined {
  // Sync can ask Google to validate a session rather than relying on the local clock.
  if (activeToken && (allowExpired || activeToken.expiresAt > Date.now())) return activeToken.value;
  return undefined;
}

export function clearAccessToken(): void {
  activeToken = undefined;
  clearRememberedAccessToken();
  try {
    window.sessionStorage.removeItem(tokenStorageKey);
  } catch {
    /* Storage is optional. */
  }
}

function clearRememberedAccessToken(expectedValue?: string): void {
  try {
    const storage = window.localStorage;
    if (expectedValue === undefined || storage.getItem(tokenStorageKey) === expectedValue) {
      storage.removeItem(tokenStorageKey);
    }
  } catch {
    // The in-memory session still works when browser storage is unavailable.
  }
}

async function loadTokenKey(): Promise<CryptoKey> {
  const candidate = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(tokenStorageKey, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(tokenKeyStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      request.onsuccess = () => request.result.close();
      reject(new Error('Browser storage is busy.'));
    };
  });

  try {
    return await new Promise<CryptoKey>((resolve, reject) => {
      // Use one transaction so tabs opening together settle on the same key.
      const transaction = database.transaction(tokenKeyStore, 'readwrite');
      const store = transaction.objectStore(tokenKeyStore);
      const request = store.get(tokenKeyId);
      let key = candidate;
      request.onsuccess = () => {
        const existing = request.result as CryptoKey | undefined;
        if (existing) key = existing;
        else store.add(candidate, tokenKeyId);
      };
      transaction.oncomplete = () => resolve(key);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

function getTokenKey(): Promise<CryptoKey> {
  tokenKey ??= loadTokenKey().catch((error: unknown) => {
    tokenKey = undefined;
    throw error;
  });
  return tokenKey;
}

function tokenEncryption(iv: Uint8Array<ArrayBuffer>, workbookId: string, expiresAt: number): AesGcmParams {
  return {
    name: 'AES-GCM',
    iv,
    additionalData: new TextEncoder().encode(JSON.stringify([config.clientId, workbookId, expiresAt])),
  };
}

function encodeBytes(bytes: Uint8Array): string {
  return window.btoa(String.fromCharCode(...bytes));
}

function decodeBytes(encoded: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(window.atob(encoded), (character) => character.charCodeAt(0));
}

export async function rememberAccessToken(workbookId: string): Promise<void> {
  const token = activeToken;
  if (!token || token.expiresAt <= Date.now()) return;
  try {
    const storage = window.localStorage;
    const { expiresAt, value } = token;
    const key = await getTokenKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      tokenEncryption(iv, workbookId, expiresAt),
      key,
      new TextEncoder().encode(value),
    );
    if (activeToken !== token || expiresAt <= Date.now()) return;

    const stored: RememberedToken = {
      workbookId,
      expiresAt,
      iv: encodeBytes(iv),
      ciphertext: encodeBytes(new Uint8Array(encrypted)),
    };
    storage.setItem(tokenStorageKey, JSON.stringify(stored));
  } catch {
    // A reload will require reconnecting when browser storage is unavailable.
  }
}

export async function restoreAccessToken(workbookId: string, allowExpired = false): Promise<boolean> {
  const currentToken = activeToken;
  let serialized: string | null = null;
  try {
    const storage = window.localStorage;
    // Migrate sessions saved before authorization was shared between tabs.
    if (storage.getItem(tokenStorageKey) === null) {
      const legacy = window.sessionStorage.getItem(tokenStorageKey);
      if (legacy !== null) {
        storage.setItem(tokenStorageKey, legacy);
        window.sessionStorage.removeItem(tokenStorageKey);
      }
    }
    serialized = storage.getItem(tokenStorageKey);
    if (serialized === null) return false;

    const stored = JSON.parse(serialized) as Partial<RememberedToken> | null;
    if (
      typeof stored?.workbookId !== 'string' ||
      !stored.workbookId ||
      typeof stored.expiresAt !== 'number' ||
      !Number.isFinite(stored.expiresAt) ||
      (!allowExpired && stored.expiresAt <= Date.now()) ||
      typeof stored.iv !== 'string' ||
      typeof stored.ciphertext !== 'string'
    ) {
      clearRememberedAccessToken(serialized);
      return false;
    }
    if (stored.workbookId !== workbookId) return false;

    const key = await getTokenKey();
    const { expiresAt } = stored;
    const decrypted = await window.crypto.subtle.decrypt(
      tokenEncryption(decodeBytes(stored.iv), workbookId, expiresAt),
      key,
      decodeBytes(stored.ciphertext),
    );
    if (activeToken !== currentToken || storage.getItem(tokenStorageKey) !== serialized) return false;

    const value = new TextDecoder().decode(decrypted);
    if (!value || (!allowExpired && expiresAt <= Date.now())) {
      clearRememberedAccessToken(serialized);
      return false;
    }
    activeToken = { value, expiresAt };
    return true;
  } catch {
    if (serialized !== null) clearRememberedAccessToken(serialized);
    return false;
  }
}

export function watchAccessToken(workbookId: string, onChange: (authorized: boolean) => void): () => void {
  let watching = true;
  const changed = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage || (event.key !== tokenStorageKey && event.key !== null))
      return;
    activeToken = undefined;
    void restoreAccessToken(workbookId, true).then((authorized) => {
      if (watching) onChange(authorized);
    });
  };
  window.addEventListener('storage', changed);
  return () => {
    watching = false;
    window.removeEventListener('storage', changed);
  };
}

function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;

  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Google could not load. Check your connection and try again.'));
    };
    const timeout = window.setTimeout(fail, 15000);
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error: unknown) => {
    scripts.delete(src);
    throw error;
  });

  scripts.set(src, loading);
  return loading;
}

export async function prepareGoogle(): Promise<void> {
  if (!isGoogleConfigured) throw new Error('Google Sheets access has not been configured for this app.');
  if (!googleWindow().google?.accounts?.oauth2) {
    await loadScript('https://accounts.google.com/gsi/client');
  }
  if (!googleWindow().google?.accounts?.oauth2) {
    throw new Error('Google authorization could not load. Reload the page and try again.');
  }
}

// Call directly inside the user's click handler so Google can open its popup.
export function requestGoogleAccess(signal?: AbortSignal, chooseAccount = false): Promise<string> {
  const oauth = googleWindow().google?.accounts?.oauth2;
  const clientId = config.clientId;
  if (!oauth || !clientId) return Promise.reject(new Error('Google authorization is not ready.'));
  if (signal?.aborted) return Promise.reject(signal.reason);

  return new Promise<string>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: driveScope,
      include_granted_scopes: false,
      callback: (response) => {
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error === 'access_denied'
                ? 'Google access was denied. Grant access to connect a spreadsheet.'
                : 'Google could not authorize access. Try connecting again.',
            ),
          );
          return;
        }
        if (!response.scope?.split(/\s+/).includes(driveScope)) {
          reject(new Error('Grant permission to the selected Google Drive files to continue.'));
          return;
        }
        const lifetime = Number(response.expires_in);
        if (!Number.isFinite(lifetime) || lifetime <= 0) {
          reject(new Error('Google returned an expired session. Try connecting again.'));
          return;
        }
        activeToken = {
          value: response.access_token,
          expiresAt: Date.now() + (lifetime - Math.min(lifetime / 10, 10)) * 1000,
        };
        resolve(activeToken.value);
      },
      error_callback: (error) => {
        const message =
          error.type === 'popup_failed_to_open'
            ? 'Allow pop-ups for this site and try connecting again.'
            : error.type === 'popup_closed'
              ? 'The Google authorization window was closed.'
              : 'Google authorization could not open. Try connecting again.';
        reject(new Error(message));
      },
    });
    client.requestAccessToken({ prompt: chooseAccount ? 'select_account' : '' });
  });
}

async function loadPickerApi(): Promise<PickerApi> {
  if (!googleWindow().gapi) await loadScript('https://apis.google.com/js/api.js');
  const gapi = googleWindow().gapi;
  if (!gapi) throw new Error('Google Picker could not load. Reload the page and try again.');

  if (!googleWindow().google?.picker) {
    pickerLoading ??= new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error('Google Picker could not load. Try again.'));
      gapi.load('picker', { callback: resolve, onerror: fail, timeout: 15000, ontimeout: fail });
    }).catch((error: unknown) => {
      pickerLoading = undefined;
      throw error;
    });
    await pickerLoading;
  }

  const api = googleWindow().google?.picker;
  if (!api?.PickerBuilder) throw new Error('Google Picker is unavailable. Reload the page and try again.');
  return api;
}

export async function pickSpreadsheet(
  token: string,
  signal?: AbortSignal,
): Promise<SpreadsheetSelection | undefined> {
  const { apiKey, projectNumber } = config;
  if (!apiKey || !projectNumber) throw new Error('Google Picker has not been configured for this app.');
  const api = await loadPickerApi();
  if (signal?.aborted) return;

  return new Promise((resolve, reject) => {
    const view = new api.DocsView(api.ViewId.SPREADSHEETS)
      .setMode(api.DocsViewMode.LIST)
      .setMimeTypes(spreadsheetMimeType);

    const close = () => {
      signal?.removeEventListener('abort', cancel);
      picker.dispose();
    };
    const cancel = () => {
      close();
      resolve(undefined);
    };

    const picker = new api.PickerBuilder()
      .addView(view)
      .setSelectableMimeTypes(spreadsheetMimeType)
      .setDeveloperKey(apiKey)
      .setAppId(projectNumber)
      .setOAuthToken(token)
      .setCallback((response) => {
        if (response.action === api.Action.CANCEL) {
          cancel();
        } else if (response.action === api.Action.ERROR) {
          close();
          reject(new Error('Google Picker could not open. Check your Google access and try again.'));
        } else if (response.action === api.Action.PICKED) {
          close();
          const file = response.docs?.[0];
          if (file?.id && (!file.mimeType || file.mimeType === spreadsheetMimeType)) {
            resolve({ id: file.id, name: file.name || 'Google spreadsheet' });
          } else {
            reject(new Error('Choose a Google Sheets spreadsheet.'));
          }
        }
      })
      .build();

    signal?.addEventListener('abort', cancel, { once: true });
    picker.setVisible(true);
  });
}
