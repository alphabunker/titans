import { assertAnalyticsSnapshot, assertSnapshotManifest } from '../../src/contracts.js';

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...init.headers,
  },
});

async function readJson(bucket, key) {
  const object = await bucket.get(key);
  if (!object) throw new TypeError(`Missing health-check object: ${key}`);
  return JSON.parse(await object.text());
}

export async function buildHealthReport(bucket, { now = new Date() } = {}) {
  if (!bucket?.get) throw new TypeError('The SNAPSHOTS R2 binding is required');
  const pointer = await readJson(bucket, 'latest.json');
  if (!pointer.snapshotId || !pointer.manifestKey || !pointer.activatedAt) throw new TypeError('The active pointer is incomplete');
  const manifest = assertSnapshotManifest(await readJson(bucket, pointer.manifestKey));
  if (manifest.snapshotId !== pointer.snapshotId || manifest.contentHash !== pointer.contentHash) throw new TypeError('The active pointer and manifest do not match');
  const canonicalArtifact = manifest.artifacts.find(artifact => artifact.kind === 'canonical');
  const analyticsArtifact = manifest.artifacts.find(artifact => artifact.kind === 'analytics');
  if (!canonicalArtifact || canonicalArtifact.sha256 !== pointer.contentHash || !analyticsArtifact) throw new TypeError('The active manifest is incomplete');
  const analytics = assertAnalyticsSnapshot(await readJson(bucket, analyticsArtifact.key));
  if (analytics.snapshotId !== pointer.snapshotId || analytics.assetCount !== manifest.actualCount) throw new TypeError('The active analytics do not match the canonical snapshot');
  const activatedAt = new Date(pointer.activatedAt);
  const ageMs = Math.max(0, now.getTime() - activatedAt.getTime());
  const stale = ageMs > STALE_AFTER_MS;
  return {
    status: stale ? 'degraded' : 'healthy',
    checkedAt: now.toISOString(),
    snapshot: {
      id: pointer.snapshotId,
      activatedAt: pointer.activatedAt,
      ageHours: Number((ageMs / 3_600_000).toFixed(2)),
      stale,
      assetCount: manifest.actualCount,
      rulesVersion: analytics.rulesVersion,
    },
    services: {
      snapshotStore: 'available',
      canonicalData: 'available',
      analytics: 'available',
      holdingsProvider: 'request-scoped',
      mediaGateway: 'client-observed',
    },
  };
}

export async function onRequestGet({ env, logger = console }) {
  try {
    const report = await buildHealthReport(env.SNAPSHOTS);
    return jsonResponse(report, { status: report.status === 'healthy' ? 200 : 503 });
  } catch (error) {
    logger.error?.('Health check failed', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({
      status: 'unhealthy',
      checkedAt: new Date().toISOString(),
      reason: 'active_snapshot_unavailable',
    }, { status: 503 });
  }
}
