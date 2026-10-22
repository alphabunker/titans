import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { handlePortfolioRequest } from '../functions/api/portfolio.js';
import { buildHealthReport } from '../functions/api/health.js';
import { toPublicCollectionSnapshot } from '../src/public-snapshot.js';
const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
const port = Number(process.env.PORT || 5173);
const localR2 = resolve(process.env.TITANS_LOCAL_R2_DIR || join(root, '.data/publication-story8/r2'));

async function localPublicSnapshot() {
 const pointer = JSON.parse(await readFile(join(localR2, 'latest.json'), 'utf8'));
 const manifest = JSON.parse(await readFile(join(localR2, pointer.manifestKey), 'utf8'));
 if (manifest.snapshotId !== pointer.snapshotId || manifest.contentHash !== pointer.contentHash) throw new TypeError('Local pointer and manifest do not match');
 const canonicalKey = manifest.artifacts.find(artifact => artifact.kind === 'canonical')?.key;
 if (!canonicalKey) throw new TypeError('Local canonical artifact is missing');
 const canonical = JSON.parse(await readFile(join(localR2, canonicalKey), 'utf8'));
 return toPublicCollectionSnapshot(canonical, { activatedAt: pointer.activatedAt });
}

async function localAnalytics() {
 const pointer = JSON.parse(await readFile(join(localR2, 'latest.json'), 'utf8'));
 const manifest = JSON.parse(await readFile(join(localR2, pointer.manifestKey), 'utf8'));
 if (manifest.snapshotId !== pointer.snapshotId || manifest.contentHash !== pointer.contentHash) throw new TypeError('Local pointer and manifest do not match');
 const analyticsKey = manifest.artifacts.find(artifact => artifact.kind === 'analytics')?.key;
 if (!analyticsKey) throw new TypeError('Local analytics artifact is missing');
 return JSON.parse(await readFile(join(localR2, analyticsKey), 'utf8'));
}

const localBucket = {
 async get(key) {
  try {
   const body = await readFile(join(localR2, key), 'utf8');
   return { async text() { return body; } };
  } catch { return null; }
 },
};

http.createServer(async (req, res) => {
 try {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/api/collection') {
   const body = JSON.stringify(await localPublicSnapshot());
   res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(body);
   return;
  }
  if (pathname === '/api/analytics') {
   const body = JSON.stringify(await localAnalytics());
   res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(body);
   return;
  }
  if (pathname === '/api/health') {
   const report = await buildHealthReport(localBucket);
   res.writeHead(report.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(JSON.stringify(report));
   return;
  }
  if (pathname === '/api/portfolio') {
   if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
   const chunks = [];
   for await (const chunk of req) chunks.push(chunk);
   const request = new Request(`http://localhost:${port}/api/portfolio`, {
    method: 'POST', headers: req.headers, body: Buffer.concat(chunks),
   });
   const response = await handlePortfolioRequest({ request });
   res.writeHead(response.status, Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));
   return;
  }
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + sep) || !(file === resolve(root, 'index.html') || file.startsWith(resolve(root, 'src') + sep))) { res.writeHead(404).end('Not found'); return; }
  const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(body);
 } catch (error) {
  if (req.url?.startsWith('/api/collection') || req.url?.startsWith('/api/analytics') || req.url?.startsWith('/api/health')) {
   res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error: 'Collection data is temporarily unavailable.' }));
   return;
  }
  res.writeHead(404).end('Not found');
 }
}).listen(port, '127.0.0.1', () => console.log(`Local preview: http://localhost:${port}`));
