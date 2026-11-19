import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Preview the same static output a production host serves.
const deployment = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(
  deployment.headers[0].headers.map(({ key, value }: { key: string; value: string }) => [key, value]),
);
export default defineConfig({ preview: { headers, port: 4173 } });
