import { COLLECTION_POLICY_ID } from '../contracts.js';
import { parseCip67Label } from '../metadata-normalizer.js';
import { referenceAssetName, sha256Json } from './koios.js';

const DEFAULT_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function blockfrostAssetToEvidence(row, retrievedAt) {
  if (!row || row.policy_id !== COLLECTION_POLICY_ID || typeof row.asset_name !== 'string') {
    throw new TypeError('Blockfrost asset does not identify a House of Titans asset');
  }
  const { label } = parseCip67Label(row.asset_name);
  if (label !== 222) throw new TypeError('Blockfrost asset is not a CIP-68 user token');
  if (!row.onchain_metadata || typeof row.onchain_metadata !== 'object' || Array.isArray(row.onchain_metadata)) {
    throw new TypeError('Blockfrost asset does not contain decoded CIP-68 metadata');
  }
  if (row.onchain_metadata_standard && !String(row.onchain_metadata_standard).startsWith('CIP68')) {
    throw new TypeError(`Blockfrost reported unexpected metadata standard ${row.onchain_metadata_standard}`);
  }
  const referenceName = referenceAssetName(row.asset_name);
  return {
    assetId: `${row.policy_id}${row.asset_name}`,
    referenceAssetId: referenceName ? `${row.policy_id}${referenceName}` : null,
    rawAssetNameHex: row.asset_name,
    cip68Label: 222,
    metadata: row.onchain_metadata,
    metadataHash: sha256Json(row.onchain_metadata),
    provider: 'blockfrost',
    retrievedAt,
    blockHeight: null,
    blockTime: null,
  };
}

export class BlockfrostProvider {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    projectId = '',
    fetchImpl = globalThis.fetch,
    retries = 4,
    retryBaseMs = 500,
    timeoutMs = 20_000,
    concurrency = 4,
    sleepImpl = sleep,
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('BlockfrostProvider requires fetch');
    if (!projectId) throw new TypeError('BlockfrostProvider requires a server-side project ID');
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new TypeError('concurrency must be between 1 and 10');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.projectId = projectId;
    this.fetchImpl = fetchImpl;
    this.retries = retries;
    this.retryBaseMs = retryBaseMs;
    this.timeoutMs = timeoutMs;
    this.concurrency = concurrency;
    this.sleepImpl = sleepImpl;
    this.id = 'blockfrost';
  }

  async request(path) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { accept: 'application/json', project_id: this.projectId },
        });
        if (response.ok) return response.json();
        const message = `Blockfrost ${response.status} for ${path}`;
        if (!RETRYABLE_STATUS.has(response.status) || attempt === this.retries) throw new Error(message);
        const retryAfter = Number(response.headers.get('retry-after'));
        await this.sleepImpl(Number.isFinite(retryAfter) ? retryAfter * 1000 : this.retryBaseMs * (2 ** attempt));
      } catch (error) {
        lastError = error;
        if (attempt === this.retries || (error instanceof Error && error.message.startsWith('Blockfrost ') && !/Blockfrost (408|425|429|500|502|503|504)/.test(error.message))) throw error;
        await this.sleepImpl(this.retryBaseMs * (2 ** attempt));
      }
    }
    throw lastError;
  }

  async listPolicyAssets({ cursor = '1', limit = 100 } = {}) {
    const page = Number(cursor);
    if (!Number.isSafeInteger(page) || page < 1) throw new TypeError('cursor must be a positive page-number string');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('limit must be between 1 and 100');
    const query = new URLSearchParams({ count: String(limit), page: String(page), order: 'asc' });
    const rows = await this.request(`/assets/policy/${COLLECTION_POLICY_ID}?${query}`);
    if (!Array.isArray(rows)) throw new TypeError('Blockfrost policy response must be an array');
    const assets = rows.flatMap(row => {
      if (!row || typeof row.asset !== 'string' || !row.asset.startsWith(COLLECTION_POLICY_ID)) return [];
      const rawAssetNameHex = row.asset.slice(COLLECTION_POLICY_ID.length);
      return parseCip67Label(rawAssetNameHex).label === 222
        ? [{ assetId: row.asset, rawAssetNameHex }]
        : [];
    });
    return { assets, nextCursor: rows.length === limit ? String(page + 1) : null };
  }

  async fetchAssetMetadata(assets) {
    if (!Array.isArray(assets) || !assets.length) return [];
    const rows = new Array(assets.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < assets.length) {
        const index = nextIndex;
        nextIndex += 1;
        const asset = assets[index];
        const row = await this.request(`/assets/${asset.assetId}`);
        rows[index] = {
          ...row,
          policy_id: row.policy_id ?? COLLECTION_POLICY_ID,
          asset_name: row.asset_name ?? asset.rawAssetNameHex,
        };
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, assets.length) }, worker));
    return rows;
  }

  toEvidence(row, retrievedAt) {
    return blockfrostAssetToEvidence(row, retrievedAt);
  }
}
