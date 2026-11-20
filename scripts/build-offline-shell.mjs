import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const assets = ['/index.html', '/help/index.html', '/picopos-mark.svg'];

const files = await readdir(join(dist, 'assets'), { recursive: true, withFileTypes: true });
for (const file of files) {
  if (file.isFile()) {
    const path = relative(dist, join(file.parentPath, file.name)).split(sep).join('/');
    assets.push(`/${path}`);
  }
}
assets.sort();

const worker = await readFile(new URL('./offline-worker.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(worker);
for (const path of assets) {
  const contents = await readFile(join(dist, path));
  hash.update(JSON.stringify([path, contents.length]));
  hash.update(contents);
}

const version = hash.digest('hex').slice(0, 16);
// Older installations update from their originally registered URL.
for (const name of ['picopos-service-worker.js', 'piecom-service-worker.js']) {
  await writeFile(
    join(dist, name),
    `${worker}\ninstallOfflineShell(${JSON.stringify(version)}, ${JSON.stringify(assets)});\n`,
  );
}
