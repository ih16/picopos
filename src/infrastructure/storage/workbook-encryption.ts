let storedKey: Promise<CryptoKey> | undefined;

// Separate from the OAuth key: clearing a Google session must never strand offline edits.
export function workbookEncryptionKey(): Promise<CryptoKey> {
  storedKey ??= loadKey().catch((cause) => {
    storedKey = undefined;
    throw cause;
  });
  return storedKey;
}

async function loadKey(): Promise<CryptoKey> {
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('picopos-workbook-encryption', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      request.onsuccess = () => request.result.close();
      reject(new Error('Browser storage is busy. Close other picopos tabs and retry.'));
    };
  });
  try {
    return await new Promise<CryptoKey>((resolve, reject) => {
      const transaction = database.transaction('keys', 'readwrite');
      const store = transaction.objectStore('keys');
      const request = store.get('workbooks');
      let key = candidate;
      request.onsuccess = () => {
        if (request.result) key = request.result as CryptoKey;
        else store.add(candidate, 'workbooks');
      };
      transaction.oncomplete = () => resolve(key);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function encryptWorkbook(contents: string, id: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    key,
    new TextEncoder().encode(contents),
  );
  return JSON.stringify({ encrypted: 1, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}

export async function decryptWorkbook(contents: string, id: string, key: CryptoKey): Promise<string> {
  const envelope = JSON.parse(contents) as { encrypted: number; iv: string; ciphertext: string };
  if (envelope.encrypted !== 1) throw new Error('Unsupported encrypted workbook format.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(envelope.iv), additionalData: new TextEncoder().encode(id) },
    key,
    decode(envelope.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
