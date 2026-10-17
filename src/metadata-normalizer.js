import { COLLECTION_POLICY_ID, CONTRACT_VERSION, assertCanonicalAsset } from './contracts.js';

export const NORMALIZATION_VERSION = '1.0.0';
export const CIP67_LABEL_PREFIXES = Object.freeze({ 100: '000643b0', 222: '000de140' });

const RESERVED_METADATA_KEYS = new Set([
  'name', 'image', 'mediaType', 'description', 'website', 'files', 'attributes', 'traits', 'number',
]);

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function normalizeComparisonKey(value) {
  return String(value).normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export function parseCip67Label(rawAssetNameHex) {
  if (typeof rawAssetNameHex !== 'string' || rawAssetNameHex.length < 8) return { label: null, payloadHex: rawAssetNameHex };
  const prefix = rawAssetNameHex.slice(0, 8).toLowerCase();
  const entry = Object.entries(CIP67_LABEL_PREFIXES).find(([, value]) => value === prefix);
  return entry ? { label: Number(entry[0]), payloadHex: rawAssetNameHex.slice(8) } : { label: null, payloadHex: rawAssetNameHex };
}

export function decodeAssetName(rawAssetNameHex) {
  if (typeof rawAssetNameHex !== 'string' || !rawAssetNameHex.length || rawAssetNameHex.length % 2 || !/^[0-9a-f]+$/i.test(rawAssetNameHex)) return null;
  try {
    const { payloadHex } = parseCip67Label(rawAssetNameHex);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(payloadHex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16)));
    return /^[\x20-\x7E]+$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function decodeBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 || !/^[0-9a-f]*$/i.test(hex)) throw new TypeError('CIP-68 bytes must be even-length hexadecimal');
  const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return /^[\x20-\x7E\n\r\t]*$/.test(decoded) ? decoded : `0x${hex}`;
  } catch {
    return `0x${hex}`;
  }
}

export function decodePlutusData(value) {
  if (Array.isArray(value)) return value.map(decodePlutusData);
  if (!isRecord(value)) return value;
  if (Object.hasOwn(value, 'bytes')) return decodeBytes(value.bytes);
  if (Object.hasOwn(value, 'int')) return Number(value.int);
  if (Array.isArray(value.list)) return value.list.map(decodePlutusData);
  if (Array.isArray(value.map)) return Object.fromEntries(value.map.map(entry => [String(decodePlutusData(entry.k)), decodePlutusData(entry.v)]));
  if (Array.isArray(value.fields) && Object.hasOwn(value, 'constructor')) {
    const fields = value.fields.map(decodePlutusData);
    return fields.length === 1 ? fields[0] : fields;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodePlutusData(child)]));
}

export function decodeCip68Metadata(cip68Metadata, label = 222) {
  if (!isRecord(cip68Metadata)) return null;
  const datum = cip68Metadata[String(label)] ?? cip68Metadata[label];
  if (!datum) return null;
  const decoded = decodePlutusData(datum);
  // CIP-68 constructor fields are [metadata map, version]. Older examples may
  // contain only the metadata map, so accept both without exposing the wrapper.
  if (Array.isArray(decoded) && isRecord(decoded[0])) return decoded[0];
  return isRecord(decoded) ? decoded : null;
}

export function extractIpfsCid(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('ipfs://')) return null;
  const value = uri.slice('ipfs://'.length).replace(/^ipfs\//, '').split(/[/?#]/, 1)[0];
  return value || null;
}

function findNumber(metadata, rawAssetName) {
  if (Number.isSafeInteger(metadata.number) && metadata.number > 0) return { number: metadata.number, numberSource: 'metadata' };
  if (typeof metadata.number === 'string' && /^\d+$/.test(metadata.number) && Number(metadata.number) > 0) {
    return { number: Number(metadata.number), numberSource: 'metadata' };
  }
  const match = rawAssetName?.match(/(\d+)$/);
  return match ? { number: Number(match[1]), numberSource: 'asset-name' } : { number: null, numberSource: null };
}

function traitEntries(metadata) {
  const declared = isRecord(metadata.attributes) ? metadata.attributes : isRecord(metadata.traits) ? metadata.traits : null;
  const source = declared ?? Object.fromEntries(Object.entries(metadata).filter(([key]) => !RESERVED_METADATA_KEYS.has(key)));
  return Object.entries(source).flatMap(([category, value]) => {
    if (!category.trim() || value === null || value === undefined || typeof value === 'object') return [];
    const sourceValue = String(value);
    if (!sourceValue.length) return [];
    return [{
      category,
      value: sourceValue,
      normalizedCategory: normalizeComparisonKey(category),
      normalizedValue: normalizeComparisonKey(sourceValue),
    }];
  });
}

/**
 * Normalize provider-extracted CIP-68 evidence. The provider adapter is
 * responsible only for locating the metadata object and associated chain
 * evidence; this function owns all provider-independent transformations.
 */
export function normalizeCip68Asset(evidence) {
  if (!isRecord(evidence)) throw new TypeError('evidence: must be an object');
  if (!isRecord(evidence.metadata)) throw new TypeError('evidence.metadata: must be an object');
  const rawAssetName = decodeAssetName(evidence.rawAssetNameHex);
  const numberFields = findNumber(evidence.metadata, rawAssetName);
  const asset = {
    contractVersion: CONTRACT_VERSION,
    policyId: COLLECTION_POLICY_ID,
    assetId: evidence.assetId,
    referenceAssetId: evidence.referenceAssetId ?? null,
    rawAssetNameHex: evidence.rawAssetNameHex,
    rawAssetName,
    displayName: typeof evidence.metadata.name === 'string' && evidence.metadata.name.length ? evidence.metadata.name : null,
    ...numberFields,
    metadataStandard: 'CIP-68',
    cip68Label: evidence.cip68Label,
    imageUri: typeof evidence.metadata.image === 'string' && evidence.metadata.image.length ? evidence.metadata.image : null,
    imageCid: extractIpfsCid(evidence.metadata.image),
    traits: traitEntries(evidence.metadata),
    metadataHash: evidence.metadataHash,
    normalizationVersion: NORMALIZATION_VERSION,
    source: {
      provider: evidence.provider,
      retrievedAt: evidence.retrievedAt,
      blockHeight: evidence.blockHeight ?? null,
      blockTime: evidence.blockTime ?? null,
    },
  };
  return assertCanonicalAsset(asset);
}
