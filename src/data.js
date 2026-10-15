// Replace this adapter with verified collection metadata. Never treat these fixtures as holdings.
export const sampleItems = Array.from({ length: 24 }, (_, i) => ({
  id: `demo-${i + 1}`, number: i + 1, name: `Sample Titan #${String(i + 1).padStart(4, '0')}`,
  traits: { 'Demo palette': ['Ember', 'Ash', 'Gold'][i % 3], 'Demo emblem': ['Crown', 'Shield', 'Star', 'Spear'][i % 4] },
  hue: [8, 28, 43, 210][i % 4], sample: true,
}));
export const sampleCollectionProvider = { async getItems() { return sampleItems; } };
// Future providers should return the same item shape. Wallet ownership belongs in a separate adapter.
