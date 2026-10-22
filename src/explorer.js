export function explore(items, { query = '', traits = {}, favoritesOnly = false, favorites = [], sort = 'asc' } = {}) {
  const text = query.trim().toLowerCase();
  return items.filter(item => (!text || item.name.toLowerCase().includes(text) || String(item.number ?? '') === text)
    && Object.entries(traits).every(([key, value]) => !value || item.traits[key] === value)
    && (!favoritesOnly || favorites.includes(item.id)))
    .sort((a, b) => {
      const left = a.number ?? Number.MAX_SAFE_INTEGER;
      const right = b.number ?? Number.MAX_SAFE_INTEGER;
      return sort === 'desc' ? right - left : left - right;
    });
}
export function traitOptions(items) {
  const traits = {};
  for (const item of items) for (const [key, value] of Object.entries(item.traits)) (traits[key] ??= new Set()).add(value);
  return Object.fromEntries(Object.entries(traits).map(([key, values]) => [key, [...values].sort()]));
}

export function traitOptionCounts(items) {
  const traits = {};
  for (const item of items) {
    for (const [category, value] of Object.entries(item.traits)) {
      const counts = traits[category] ??= {};
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(traits).map(([category, counts]) => [
    category,
    Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))),
  ]));
}

export function collectionSummary(items, collectionSize = 6500) {
  const classes = new Set(items.map(item => item.traits?.Class).filter(Boolean));
  return {
    titans: items.length,
    percentage: `${((items.length / collectionSize) * 100).toFixed(2)}%`,
    classes: classes.size,
  };
}
