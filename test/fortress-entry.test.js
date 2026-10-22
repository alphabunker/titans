import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_POLICY_ID } from '../src/contracts.js';
import { decodeBech32 } from '../src/cardano-address.js';
import { FortressEntryError, connectCip30Wallet, listCip30Wallets, lookupPortfolio } from '../src/fortress-entry.js';

const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';
const stakeHex = [...decodeBech32(stakeAddress).bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
const assetId = `${COLLECTION_POLICY_ID}000de140486f7573654f66546974616e7330353937`;
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('CIP-30 discovery returns only compatible wallets in display order', () => {
  const wallets = listCip30Wallets({
    second: { name: 'Zephyr', enable() {} },
    ignored: { name: 'No API' },
    first: { name: 'Alpha', icon: 'data:image/png;base64,AA==', apiVersion: '1.0.0', enable() {} },
  });
  assert.deepEqual(wallets.map(wallet => wallet.key), ['first', 'second']);
  assert.equal(wallets[0].apiVersion, '1.0.0');
});

test('wallet connection requests read-only access and prefers the reward address', async () => {
  let enabled = 0;
  const wallet = {
    key: 'lace', name: 'Lace', provider: { async enable() {
      enabled += 1;
      return {
        async getNetworkId() { return 1; },
        async getRewardAddresses() { return [stakeHex]; },
        async getUsedAddresses() { throw new Error('reward address should be preferred'); },
      };
    } },
  };
  assert.deepEqual(await connectCip30Wallet(wallet), { address: stakeAddress, walletKey: 'lace', walletName: 'Lace' });
  assert.equal(enabled, 1);
});

test('wallet connection distinguishes rejected access and wrong network', async () => {
  await assert.rejects(
    connectCip30Wallet({ key: 'x', name: 'X', provider: { async enable() { throw new Error('denied'); } } }),
    error => error instanceof FortressEntryError && error.code === 'wallet_access_rejected',
  );
  await assert.rejects(
    connectCip30Wallet({ key: 'x', name: 'X', provider: { async enable() { return { async getNetworkId() { return 0; } }; } } }),
    error => error instanceof FortressEntryError && error.code === 'wrong_network',
  );
});

test('manual and wallet paths share the canonical portfolio lookup contract', async () => {
  let request;
  const portfolio = {
    contractVersion: '1.0.0', network: 'mainnet', retrievedAt: '2026-10-17T20:00:00.000Z',
    status: 'complete', addressKind: 'stake', ownershipProof: false, assetIds: [assetId],
  };
  const result = await lookupPortfolio(stakeAddress, { fetchImpl: async (url, init) => {
    request = { url, init };
    return response(portfolio);
  } });
  assert.equal(request.url, '/api/portfolio');
  assert.deepEqual(JSON.parse(request.init.body), { address: stakeAddress });
  assert.deepEqual(result, portfolio);
});

test('portfolio lookup preserves distinct server error states', async () => {
  await assert.rejects(
    lookupPortfolio('bad', { fetchImpl: async () => response({ error: { code: 'invalid_address', message: 'Invalid address', retryable: false } }, 400) }),
    error => error instanceof FortressEntryError && error.code === 'invalid_address' && error.status === 400,
  );
  await assert.rejects(
    lookupPortfolio(stakeAddress, { fetchImpl: async () => { throw new Error('offline'); } }),
    error => error instanceof FortressEntryError && error.code === 'network_error' && error.retryable,
  );
});
