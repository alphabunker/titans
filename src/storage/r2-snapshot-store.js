import { createHash } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { assertAnalyticsReconciles } from '../analytics.js';
import {
  COLLECTION_POLICY_ID,
  COLLECTION_SIZE,
  CONTRACT_VERSION,
  assertCollectionSnapshot,
  assertIngestionRun,
  assertSnapshotManifest,
  assertValidationReport,
} from '../contracts.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const jsonBytes = value => encoder.encode(`${JSON.stringify(value)}\n`);
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export class R2SnapshotStore {
  constructor(bucket, { now = () => new Date() } = {}) {
    if (!bucket?.put || !bucket?.get) throw new TypeError('A Cloudflare R2 binding is required');
    this.bucket = bucket;
    this.now = now;
  }

  async putJson(key, value) {
    const bytes = jsonBytes(value);
    const sha256 = digest(bytes);
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { sha256 },
    });
    return { key, sha256, bytes: bytes.byteLength };
  }

  async getJson(key) {
    const object = await this.bucket.get(key);
    if (!object) return null;
    const buffer = await object.arrayBuffer();
    return JSON.parse(decoder.decode(buffer));
  }

  async publish({ snapshot, analytics, report, run, normalizationVersion }) {
    assertCollectionSnapshot(snapshot);
    assertAnalyticsReconciles(snapshot, analytics);
    assertValidationReport(report);
    assertIngestionRun(run);
    if (report.status !== 'valid' || run.status !== 'succeeded') throw new TypeError('Only a valid successful import can be published');
    if (report.snapshotId !== snapshot.snapshotId) throw new TypeError('Validation report does not match the snapshot');
    if (analytics.snapshotId !== snapshot.snapshotId || analytics.assetCount !== snapshot.assets.length) {
      throw new TypeError('Analytics do not match the canonical snapshot');
    }
    const prefix = `snapshots/${snapshot.snapshotId}`;
    const artifacts = [];
    artifacts.push({ kind: 'canonical', ...await this.putJson(`${prefix}/collection.json`, snapshot) });
    artifacts.push({ kind: 'analytics', ...await this.putJson(`${prefix}/analytics.json`, analytics) });
    artifacts.push({ kind: 'validation', ...await this.putJson(`${prefix}/validation-report.json`, report) });
    artifacts.push({ kind: 'ingestion-run', ...await this.putJson(`${prefix}/ingestion-run.json`, run) });
    const contentHash = artifacts.find(artifact => artifact.kind === 'canonical').sha256;
    const manifest = assertSnapshotManifest({
      contractVersion: CONTRACT_VERSION,
      snapshotId: snapshot.snapshotId,
      schemaVersion: CONTRACT_VERSION,
      normalizationVersion,
      policyId: COLLECTION_POLICY_ID,
      expectedCount: COLLECTION_SIZE,
      actualCount: snapshot.assets.length,
      generatedAt: this.now().toISOString(),
      contentHash,
      validationReportId: report.reportId,
      artifacts,
    });
    const manifestArtifact = await this.putJson(`${prefix}/manifest.json`, manifest);
    const previous = await this.getJson('latest.json');
    if (previous) await this.putJson(`pointers/history/${this.now().toISOString()}-${previous.snapshotId}.json`, previous);
    const pointer = {
      contractVersion: CONTRACT_VERSION,
      snapshotId: snapshot.snapshotId,
      manifestKey: manifestArtifact.key,
      contentHash,
      activatedAt: this.now().toISOString(),
      runId: run.runId,
      previousSnapshotId: previous?.snapshotId ?? null,
    };
    await this.putJson('latest.json', pointer);
    return { pointer, manifest };
  }

  async rollback(pointer) {
    if (!pointer?.snapshotId || !pointer?.manifestKey || !pointer?.contentHash || !pointer?.runId) throw new TypeError('A complete prior pointer is required');
    const manifest = await this.getJson(pointer.manifestKey);
    assertSnapshotManifest(manifest);
    if (manifest.snapshotId !== pointer.snapshotId || manifest.contentHash !== pointer.contentHash) throw new TypeError('Prior pointer does not match its manifest');
    const current = await this.getJson('latest.json');
    if (current) await this.putJson(`pointers/history/${this.now().toISOString()}-${current.snapshotId}.json`, current);
    const restored = { ...pointer, activatedAt: this.now().toISOString(), previousSnapshotId: current?.snapshotId ?? null };
    await this.putJson('latest.json', restored);
    return restored;
  }
}
