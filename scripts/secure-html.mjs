import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hash the final static scripts, rather than allowing arbitrary inline JavaScript.
// A meta policy also survives service-worker caching and offline navigation.
export function secureHtml(html) {
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!match[2] || /\bsrc\s*=/.test(match[1])) continue;
    hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  }
  const policy = [
    "default-src 'self'",
    `script-src 'self' https://accounts.google.com/gsi/client https://apis.google.com ${[...hashes].join(' ')}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "connect-src 'self' https://accounts.google.com/gsi/ https://sheets.googleapis.com https://apis.google.com",
    'frame-src https://accounts.google.com https://docs.google.com',
    "img-src 'self' data: https://www.gstatic.com",
    "font-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  return html.replace(
    /<head([^>]*)>/i,
    `<head$1><meta http-equiv="Content-Security-Policy" content="${policy}">`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  for (const path of await readdir(dist, { recursive: true })) {
    if (!path.endsWith('.html')) continue;
    const file = join(dist, path);
    await writeFile(file, secureHtml(await readFile(file, 'utf8')));
  }
}
