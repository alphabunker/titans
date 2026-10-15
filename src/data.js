// Collection identity and property names verified from the user-supplied Wayup page.
// Trait values and item combinations remain fictional. This is not live metadata.
export const collection = {
  name: 'House Of Titans',
  policyId: '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
  sourceUrl: 'https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
};
export const traitCategories = ['Back', 'Background', 'Class', 'Eyes', 'Face', 'Hand', 'Head', 'House', 'Outfit', 'Skin', 'Special', 'Type'];
// Wayup also exposes Trait count; treat it as a derived property when real metadata is integrated.
export const sampleItems = Array.from({ length: 24 }, (_, i) => ({
  id: `demo-${i + 1}`, number: i + 1, name: `Sample Titan #${String(i + 1).padStart(4, '0')}`,
  traits: Object.fromEntries(traitCategories.map((key, index) => [key, `Sample ${['A', 'B', 'C'][Math.floor(i / (index % 3 + 1)) % 3]}`])),
  hue: [8, 28, 43, 210][i % 4], sample: true,
}));
export const sampleCollectionProvider = { async getItems() { return sampleItems; } };
// Future providers should return the same item shape. Wallet ownership belongs in a separate adapter.
