import test from 'node:test';
import assert from 'node:assert/strict';
import { CIP68_USER_LABEL_PREFIX, COLLECTION_POLICY_ID } from '../src/contracts.js';
import { resolvePortfolio } from '../src/portfolio.js';

const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';
const assetId = `${COLLECTION_POLICY_ID}${CIP68_USER_LABEL_PREFIX}${Buffer.from('HouseOfTitans0001').toString('hex')}`;

test('portfolio service returns a non-proof, canonical, deduplicated holdings response', async () => {
  const provider = { fetchAddressAssets: async addresses => {
    assert.deepEqual(addresses, [stakeAddress]);
    return { assetIds: [assetId, assetId], partial: false };
  } };
  const result = await resolvePortfolio(stakeAddress, { provider, now: () => new Date('2026-10-17T20:00:00.000Z') });
  assert.deepEqual(result, {
    contractVersion: '1.0.0', network: 'mainnet', retrievedAt: '2026-10-17T20:00:00.000Z',
    status: 'complete', addressKind: 'stake', ownershipProof: false, assetIds: [assetId],
  });
});

test('portfolio service preserves valid zero-holding and partial states', async () => {
  const empty = await resolvePortfolio(stakeAddress, {
    provider: { fetchAddressAssets: async () => ({ assetIds: [], partial: false }) },
    now: () => new Date('2026-10-17T20:00:00.000Z'),
  });
  assert.equal(empty.status, 'complete');
  assert.deepEqual(empty.assetIds, []);
  const partial = await resolvePortfolio(stakeAddress, {
    provider: { fetchAddressAssets: async () => ({ assetIds: [assetId], partial: true }) },
    now: () => new Date('2026-10-17T20:00:00.000Z'),
  });
  assert.equal(partial.status, 'partial');
});
