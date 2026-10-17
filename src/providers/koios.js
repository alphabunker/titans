import { createHash } from 'node:crypto';
import { COLLECTION_POLICY_ID } from '../contracts.js';
import { CIP67_LABEL_PREFIXES, decodeCip68Metadata, parseCip67Label } from '../metadata-normalizer.js';

const DEFAULT_BASE_URL = 'https://api.koios.rest/api/v1';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
};

export function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')}`;
}

export function referenceAssetName(rawAssetNameHex) {
  const { label, payloadHex } = parseCip67Label(rawAssetNameHex);
  return label === 222 ? `${CIP67_LABEL_PREFIXES[100]}${payloadHex}` : null;
}

export function koiosRowToEvidence(row, retrievedAt) {
  if (!row || row.policy_id !== COLLECTION_POLICY_ID || typeof row.asset_name !== 'string') {
    throw new TypeError('Koios asset row does not identify a House of Titans asset');
  }
  const { label } = parseCip67Label(row.asset_name);
  if (label !== 222) throw new TypeError('Koios asset row is not a CIP-68 user token');
  const metadata = decodeCip68Metadata(row.cip68_metadata, 222);
  if (!metadata) throw new TypeError('Koios asset row does not contain decodable CIP-68 label 222 metadata');
  const referenceName = referenceAssetName(row.asset_name);
  return {
    assetId: `${row.policy_id}${row.asset_name}`,
    referenceAssetId: referenceName ? `${row.policy_id}${referenceName}` : null,
    rawAssetNameHex: row.asset_name,
    cip68Label: 222,
    metadata,
    metadataHash: sha256Json(metadata),
    provider: 'koios',
    retrievedAt,
    blockHeight: null,
    blockTime: Number.isSafeInteger(row.creation_time) ? new Date(row.creation_time * 1000).toISOString() : null,
  };
}

export class KoiosProvider {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    apiToken = '',
    fetchImpl = globalThis.fetch,
    retries = 4,
    retryBaseMs = 500,
    timeoutMs = 20_000,
    sleepImpl = sleep,
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('KoiosProvider requires fetch');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
    this.fetchImpl = fetchImpl;
    this.retries = retries;
    this.retryBaseMs = retryBaseMs;
    this.timeoutMs = timeoutMs;
    this.sleepImpl = sleepImpl;
    this.id = 'koios';
  }

  async request(path, init = {}) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            accept: 'application/json',
            ...(init.body ? { 'content-type': 'application/json' } : {}),
            ...(this.apiToken ? { authorization: `Bearer ${this.apiToken}` } : {}),
            ...init.headers,
          },
        });
        if (response.ok) return response.json();
        const message = `Koios ${response.status} for ${path}`;
        if (!RETRYABLE_STATUS.has(response.status) || attempt === this.retries) throw new Error(message);
        const retryAfter = Number(response.headers.get('retry-after'));
        await this.sleepImpl(Number.isFinite(retryAfter) ? retryAfter * 1000 : this.retryBaseMs * (2 ** attempt));
      } catch (error) {
        lastError = error;
        if (attempt === this.retries || (error instanceof Error && error.message.startsWith('Koios ') && !/Koios (408|425|429|500|502|503|504)/.test(error.message))) throw error;
        await this.sleepImpl(this.retryBaseMs * (2 ** attempt));
      }
    }
    throw lastError;
  }

  async listPolicyAssets({ cursor = '0', limit = 500 } = {}) {
    const offset = Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new TypeError('cursor must be a non-negative integer string');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new TypeError('limit must be between 1 and 1000');
    // A stable order is mandatory for offset pagination. Without it, Koios can
    // return a different row order on each request, which creates duplicates
    // and omissions as the importer advances through the policy.
    const query = new URLSearchParams({
      _asset_policy: COLLECTION_POLICY_ID,
      order: 'asset_name.asc',
      limit: String(limit),
      offset: String(offset),
    });
    const rows = await this.request(`/policy_asset_list?${query}`);
    if (!Array.isArray(rows)) throw new TypeError('Koios policy_asset_list response must be an array');
    const assets = rows.flatMap(row => {
      if (!row || typeof row.asset_name !== 'string') return [];
      const { label } = parseCip67Label(row.asset_name);
      return label === 222 ? [{ assetId: `${COLLECTION_POLICY_ID}${row.asset_name}`, rawAssetNameHex: row.asset_name }] : [];
    });
    return { assets, nextCursor: rows.length === limit ? String(offset + rows.length) : null };
  }

  async fetchAssetMetadata(assets) {
    if (!Array.isArray(assets) || !assets.length) return [];
    const body = { _asset_list: assets.map(asset => [COLLECTION_POLICY_ID, asset.rawAssetNameHex]) };
    const rows = await this.request('/asset_info', { method: 'POST', body: JSON.stringify(body) });
    if (!Array.isArray(rows)) throw new TypeError('Koios asset_info response must be an array');
    return rows;
  }
}
