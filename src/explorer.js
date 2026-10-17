export function explore(items, { query = '', traits = {}, favoritesOnly = false, favorites = [], sort = 'asc' } = {}) {
  const text = query.trim().toLowerCase();
  return items.filter(item => (!text || item.name.toLowerCase().includes(text) || String(item.number) === text)
    && Object.entries(traits).every(([key, value]) => !value || item.traits[key] === value)
    && (!favoritesOnly || favorites.includes(item.id)))
    .sort((a, b) => sort === 'desc' ? b.number - a.number : a.number - b.number);
}
export function traitOptions(items) {
  const traits = {};
  for (const item of items) for (const [key, value] of Object.entries(item.traits)) (traits[key] ??= new Set()).add(value);
  return Object.fromEntries(Object.entries(traits).map(([key, values]) => [key, [...values].sort()]));
}

export function collectionSummary(items, collectionSize = 6500) {
  const classes = new Set(items.map(item => item.traits?.Class).filter(Boolean));
  return {
    titans: items.length,
    percentage: `${((items.length / collectionSize) * 100).toFixed(2)}%`,
    classes: classes.size,
  };
}
