import { CONTRACT_VERSION, assertPortfolioResponse } from './contracts.js';
import { parseCardanoAddress } from './cardano-address.js';

export async function resolvePortfolio(address, { provider, now = () => new Date() } = {}) {
  if (!provider?.fetchAddressAssets) throw new TypeError('A holdings provider is required');
  const parsed = parseCardanoAddress(address);
  const holdings = await provider.fetchAddressAssets([parsed.address]);
  const portfolio = {
    contractVersion: CONTRACT_VERSION,
    network: parsed.network,
    retrievedAt: now().toISOString(),
    status: holdings.partial ? 'partial' : 'complete',
    addressKind: parsed.kind,
    ownershipProof: false,
    assetIds: [...new Set(holdings.assetIds)].sort(),
  };
  return assertPortfolioResponse(portfolio);
}
