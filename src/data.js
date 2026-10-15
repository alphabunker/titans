import { filterTraitCatalog, filterTraitCategories } from './trait-catalog.js';

// Collection identity and property names were verified from the user-supplied
// Wayup page. The catalog values are source-observed, but these item assignments
// and combinations are synthetic fixtures. This is not live NFT metadata.
export const collection = {
  name: 'House Of Titans',
  policyId: '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
  sourceUrl: 'https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
};
export const sampleItems = Array.from({ length: 24 }, (_, i) => ({
  id: `demo-${i + 1}`, number: i + 1, name: `Sample Titan #${String(i + 1).padStart(4, '0')}`,
  traits: Object.fromEntries(filterTraitCategories.map((key, index) => {
    const values = filterTraitCatalog[key];
    return [key, values[(i * (index + 3) + index) % values.length]];
  })),
  hue: [8, 28, 43, 210][i % 4], sample: true,
}));
export const sampleCollectionProvider = { async getItems() { return sampleItems; } };
// Future providers should return the same item shape. Wallet ownership belongs in a separate adapter.
