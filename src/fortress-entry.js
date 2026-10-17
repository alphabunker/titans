import { assertPortfolioResponse } from './contracts.js';
import { CardanoAddressError, cardanoAddressFromHex } from './cardano-address.js';

export class FortressEntryError extends Error {
  constructor(code, message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = 'FortressEntryError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function listCip30Wallets(cardano = globalThis.window?.cardano) {
  if (!cardano || typeof cardano !== 'object') return [];
  return Object.entries(cardano).flatMap(([key, provider]) => {
    if (!provider || typeof provider.enable !== 'function') return [];
    return [{
      key,
      name: typeof provider.name === 'string' && provider.name.trim() ? provider.name.trim() : key,
      icon: typeof provider.icon === 'string' ? provider.icon : '',
      apiVersion: typeof provider.apiVersion === 'string' ? provider.apiVersion : '',
      provider,
    }];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

async function firstWalletAddress(api) {
  for (const method of ['getRewardAddresses', 'getUsedAddresses', 'getUnusedAddresses']) {
    if (typeof api[method] !== 'function') continue;
    const values = await api[method]();
    if (Array.isArray(values) && values.length) return cardanoAddressFromHex(values[0]);
  }
  if (typeof api.getChangeAddress === 'function') {
    const value = await api.getChangeAddress();
    if (value) return cardanoAddressFromHex(value);
  }
  throw new FortressEntryError('wallet_no_address', 'The wallet did not provide an address for this account.');
}

export async function connectCip30Wallet(wallet) {
  if (!wallet?.provider || typeof wallet.provider.enable !== 'function') {
    throw new FortressEntryError('unsupported_wallet', 'No compatible CIP-30 wallet was found.');
  }
  let api;
  try {
    api = await wallet.provider.enable();
  } catch {
    throw new FortressEntryError('wallet_access_rejected', 'Wallet access was rejected. You can try again or analyze an address instead.');
  }
  try {
    const networkId = await api.getNetworkId();
    if (networkId !== 1) throw new FortressEntryError('wrong_network', 'Switch the wallet to Cardano mainnet and try again.');
    return { address: await firstWalletAddress(api), walletKey: wallet.key, walletName: wallet.name };
  } catch (error) {
    if (error instanceof FortressEntryError || error instanceof CardanoAddressError) throw error;
    throw new FortressEntryError('wallet_unavailable', 'The wallet could not provide account addresses. Please try again.');
  }
}

export async function lookupPortfolio(address, { fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  let response;
  try {
    response = await fetchImpl('/api/portfolio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    });
  } catch {
    throw new FortressEntryError('network_error', 'The Fortress could not reach the holdings service. Please try again.', { retryable: true });
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new FortressEntryError('invalid_response', 'The holdings service returned an unreadable response.', { status: response.status, retryable: true });
  }
  if (!response.ok) {
    const upstream = payload?.error;
    throw new FortressEntryError(
      upstream?.code || 'provider_unavailable',
      upstream?.message || 'The holdings service is temporarily unavailable.',
      { status: response.status, retryable: Boolean(upstream?.retryable) },
    );
  }
  try {
    return assertPortfolioResponse(payload);
  } catch {
    throw new FortressEntryError('invalid_response', 'The holdings service returned an invalid portfolio.', { status: response.status, retryable: true });
  }
}
