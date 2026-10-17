import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runCollectionImport } from '../src/importer.js';
import { KoiosProvider } from '../src/providers/koios.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const mode = argument('--mode', 'manual');
const outputDirectory = resolve(argument('--output', '.data/import'));
const checkpointPath = resolve(argument('--checkpoint', `${outputDirectory}/checkpoint.json`));

const writeJsonAtomic = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
};

const checkpointStore = {
  async load() {
    try { return JSON.parse(await readFile(checkpointPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  },
  async save(value) { await writeJsonAtomic(checkpointPath, value); },
};

const provider = new KoiosProvider({
  baseUrl: process.env.KOIOS_API_URL,
  apiToken: process.env.KOIOS_API_TOKEN,
});

const result = await runCollectionImport({
  provider,
  mode,
  checkpointStore,
  onProgress(progress) { process.stdout.write(`${JSON.stringify(progress)}\n`); },
});

await Promise.all([
  writeJsonAtomic(`${outputDirectory}/collection.candidate.json`, result.snapshot),
  writeJsonAtomic(`${outputDirectory}/validation-report.json`, result.report),
  writeJsonAtomic(`${outputDirectory}/ingestion-run.json`, result.run),
  writeJsonAtomic(`${outputDirectory}/errors.json`, result.errors),
]);

const summary = [
  '# House of Titans metadata import',
  '',
  `- Status: **${result.run.status}**`,
  `- Discovered: ${result.run.counts.discovered}`,
  `- Normalized: ${result.run.counts.normalized}`,
  `- Changed: ${result.run.counts.changed}`,
  `- Errors: ${result.run.counts.errors}`,
  `- Snapshot: \`${result.snapshot.snapshotId}\``,
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
process.stdout.write(summary);
if (result.run.status !== 'succeeded') process.exitCode = 1;

