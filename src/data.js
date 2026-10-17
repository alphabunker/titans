import { assertPublicCollectionSnapshot } from './public-snapshot.js';

export const collection = {
  name: 'House Of Titans',
  policyId: '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
  sourceUrl: 'https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
};

export function snapshotItems(snapshot) {
  assertPublicCollectionSnapshot(snapshot);
  return snapshot.assets.map(asset => ({
    ...asset,
    id: asset.assetId,
    name: asset.displayName || asset.rawAssetName || (asset.number ? `Titan #${asset.number}` : 'Unnamed Titan'),
  }));
}

export async function fetchPublicCollection({
  endpoint = '/api/collection',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  const response = await fetchImpl(endpoint, {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) throw new TypeError(`Collection request failed with HTTP ${response.status}`);
  const snapshot = await response.json();
  assertPublicCollectionSnapshot(snapshot);
  return snapshot;
}

export const publicCollectionProvider = {
  async getSnapshot(options) {
    return fetchPublicCollection(options);
  },
};
