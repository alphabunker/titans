import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildCollectionAnalytics } from '../src/analytics.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const input = resolve(argument('--input', '.data/import/collection.candidate.json'));
const output = resolve(argument('--output', '.data/import/analytics.json'));
const snapshot = JSON.parse(await readFile(input, 'utf8'));
const analytics = buildCollectionAnalytics(snapshot);
const body = `${JSON.stringify(analytics)}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, body);
const rawBytes = Buffer.byteLength(body);
const gzipBytes = gzipSync(body).byteLength;
process.stdout.write(`${JSON.stringify({ output, rawBytes, gzipBytes, underTarget: gzipBytes <= 2 * 1024 * 1024 })}\n`);
if (gzipBytes > 2 * 1024 * 1024) process.exitCode = 2;

