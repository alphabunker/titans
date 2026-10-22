import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.woff', '.woff2', '.zip', '.gz']);
const patterns = [
  { name: 'private key', value: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'provider token', value: /(?:ghp|github_pat|glpat|sk_live|sk_test)_[A-Za-z0-9_-]{16,}/ },
  { name: 'AWS access key', value: /AKIA[0-9A-Z]{16}/ },
  { name: 'configured server secret', value: /(?:KOIOS_API_TOKEN|BLOCKFROST_PROJECT_ID|CLOUDFLARE_API_TOKEN|PINATA_JWT)[ \t]*[=:][ \t]*["']?[A-Za-z0-9._-]{12,}/ },
  { name: 'credentialed URL', value: /https?:\/\/[^\s/:]+:[^\s/@]{12,}@/ },
];

function findings(label, body) {
  if (body.includes('\0')) return [];
  return patterns.flatMap(pattern => pattern.value.test(body) ? [`${label}: ${pattern.name}`] : []);
}

const failures = [];
const objects = execFileSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf8' });
const seen = new Set();
for (const line of objects.trim().split('\n')) {
  const [sha, ...parts] = line.split(' ');
  const path = parts.join(' ');
  if (!sha || seen.has(sha) || binaryExtensions.has(extname(path).toLowerCase())) continue;
  seen.add(sha);
  let type;
  let size;
  try {
    type = execFileSync('git', ['cat-file', '-t', sha], { encoding: 'utf8' }).trim();
    size = Number(execFileSync('git', ['cat-file', '-s', sha], { encoding: 'utf8' }).trim());
  } catch { continue; }
  if (type !== 'blob' || size > 8 * 1024 * 1024) continue;
  const body = execFileSync('git', ['cat-file', '-p', sha], { encoding: 'utf8', maxBuffer: 9 * 1024 * 1024 });
  failures.push(...findings(`history ${sha.slice(0, 12)} ${path || '(unnamed blob)'}`, body));
}

async function scanDirectory(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scanDirectory(path);
    else if (entry.isFile() && !binaryExtensions.has(extname(path).toLowerCase()) && (await stat(path)).size <= 8 * 1024 * 1024) {
      failures.push(...findings(`artifact ${path}`, await readFile(path, 'utf8')));
    }
  }
}

for (const candidate of ['dist', '.data/publication-story8/r2']) await scanDirectory(resolve(candidate));

if (failures.length) {
  process.stderr.write(`Potential secrets detected:\n${failures.map(value => `- ${value}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Secret scan passed across ${seen.size.toLocaleString()} unique Git blobs and available generated artifacts.\n`);
}
