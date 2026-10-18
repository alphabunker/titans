import { buildOwnerAnalytics } from './analytics.js';
import { publicAnalyticsProvider, publicCollectionProvider, snapshotItems } from './data.js';
import { collectionSummary, explore, traitOptionCounts } from './explorer.js';
import { connectCip30Wallet, listCip30Wallets, lookupPortfolio } from './fortress-entry.js';
import { createTitanImage, readMediaConfig, resolveIpfsImageUrl } from './media.js';

const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 48;
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const mediaConfig = readMediaConfig();
let items = [];
let snapshot = null;
let analytics = null;
let itemsById = new Map();
let traitCounts = {};
let fortressSession = null;
let discoveredWallets = [];
let pairingReturnFocus = null;
let pairingDetailTransition = false;
let pyramidReturnFocus = null;
let pyramidDetailTransition = false;
let rareDetailReturnFocus = null;
let rareDetailTransition = false;
let miniCollectionReturnFocus = null;
let miniCollectionTransition = false;
const state = {
  query: '', traits: {}, favorites: [], favoritesOnly: false, sort: 'asc', view: 'grid', page: 0,
};

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const formatDate = value => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

function art(item) {
  return createTitanImage(item, mediaConfig);
}

function mediaProvenance(item) {
  try {
    const identity = resolveIpfsImageUrl(item, mediaConfig);
    const root = el('p', undefined, 'media-provenance');
    root.append(el('span', 'ON-CHAIN IMAGE'));
    const link = el('a', `CID ${identity.cid} ↗`);
    link.href = identity.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    root.append(link, el('code', identity.imageUri));
    return root;
  } catch {
    return null;
  }
}

function showDetail(item) {
  const content = $('#detail-content');
  const title = el('h2', item.name);
  title.id = 'detail-title';
  const traits = el('dl', undefined, 'detail-traits');
  for (const [key, value] of Object.entries(item.traits)) traits.append(el('dt', key), el('dd', value));
  const provenance = el('p', `${item.metadataStandard} metadata · ${item.source.provider} · retrieved ${formatDate(item.source.retrievedAt)}`, 'detail-provenance');
  const identity = el('p', item.number ? `Titan #${item.number}` : 'Titan number unavailable', 'muted');
  const children = [art(item), el('div', 'VERIFIED COLLECTION NFT', 'eyebrow'), title, provenance, identity, traits];
  const media = mediaProvenance(item);
  if (media) children.push(media);
  content.replaceChildren(...children);
  $('#detail').showModal();
  $('#close-detail').focus();
}

function itemAtAnalyticsIndex(index) {
  const assetId = analytics?.indexes.assetIds[index];
  return itemsById.get(assetId) ?? null;
}

function showCharacterDetail(highlight) {
  const content = $('#character-detail-content');
  const title = el('h2', `${highlight.value} in your collection`);
  title.id = 'character-detail-title';
  const intro = el('p', `${highlight.ownedCount.toLocaleString()} owned ${highlight.ownedCount === 1 ? 'Titan has' : 'Titans have'} this ${highlight.category} trait.`, 'muted');
  const grid = el('div', undefined, 'character-dialog-grid');
  for (const index of highlight.matchingOwnedIndexes) {
    const item = itemAtAnalyticsIndex(index);
    if (!item) continue;
    const card = el('article', undefined, 'character-dialog-card');
    const button = el('button', undefined, 'card-open');
    button.type = 'button';
    button.setAttribute('aria-label', `View ${item.name}`);
    button.append(art(item));
    button.onclick = () => { $('#character-detail').close(); showDetail(item); };
    card.append(button, el('h3', item.name), el('p', item.number ? `Titan #${item.number}` : 'Verified Titan', 'muted'));
    grid.append(card);
  }
  content.replaceChildren(el('div', 'COLLECTION CHARACTER', 'eyebrow'), title, intro, grid);
  $('#character-detail').showModal();
  $('#close-character-detail').focus();
}

function pairingTraitLabel(trait) {
  return `${trait.category}: ${trait.value}`;
}

function pairingResultCard(item, owned) {
  const card = el('article', undefined, `pairing-dialog-card${owned ? ' is-owned' : ''}`);
  const button = el('button', undefined, 'card-open');
  button.type = 'button';
  button.setAttribute('aria-label', `View ${item.name}${owned ? ', in your collection' : ''}`);
  button.append(art(item));
  button.onclick = () => {
    pairingDetailTransition = true;
    $('#pairing-detail').close();
    showDetail(item);
  };
  const copy = el('div', undefined, 'pairing-dialog-card-copy');
  copy.append(el('h3', item.name), el('p', item.number ? `Titan #${item.number}` : 'Verified Titan', 'muted'));
  if (owned) copy.append(el('span', 'YOUR TITAN', 'owned-badge'));
  card.append(button, copy);
  return card;
}

function showPairingDetail(pairing, trigger) {
  pairingReturnFocus = trigger;
  const content = $('#pairing-detail-content');
  const title = el('h2', `${pairing.left.value} + ${pairing.right.value}`);
  title.id = 'pairing-detail-title';
  const intro = el('p', `${pairing.ownedCount.toLocaleString()} in your collection · ${pairing.collectionCount.toLocaleString()} across all 6,500 Titans.`, 'pairing-dialog-intro');
  const tablist = el('div', undefined, 'pairing-tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Pairing results');
  const collectionTab = el('button', `Meet the collection (${pairing.collectionCount.toLocaleString()})`);
  const ownedTab = el('button', `Your Titans (${pairing.ownedCount.toLocaleString()})`);
  const panel = el('div', undefined, 'pairing-results');
  panel.id = 'pairing-results';
  panel.setAttribute('role', 'tabpanel');
  const tabs = [collectionTab, ownedTab];
  collectionTab.id = 'pairing-collection-tab';
  ownedTab.id = 'pairing-owned-tab';
  tabs.forEach(tab => {
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
  });
  const ownedIndexes = new Set(pairing.matchingOwnedIndexes);
  const renderView = view => {
    const activeTab = view === 'collection' ? collectionTab : ownedTab;
    tabs.forEach(tab => {
      const selected = tab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', activeTab.id);
    const indexes = view === 'collection' ? pairing.matchingCollectionIndexes : pairing.matchingOwnedIndexes;
    const grid = el('div', undefined, 'pairing-dialog-grid');
    for (const index of indexes) {
      const item = itemAtAnalyticsIndex(index);
      if (item) grid.append(pairingResultCard(item, ownedIndexes.has(index)));
    }
    panel.replaceChildren(grid);
  };
  collectionTab.onclick = () => renderView('collection');
  ownedTab.onclick = () => renderView('owned');
  tablist.onkeydown = event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  };
  tablist.append(...tabs);
  content.replaceChildren(el('div', 'UNEXPECTED PAIRING', 'eyebrow'), title, intro, tablist, panel);
  renderView('collection');
  $('#pairing-detail').showModal();
  collectionTab.focus();
}

function pyramidResultCard(item, owned) {
  const card = el('article', undefined, `pyramid-dialog-card${owned ? ' is-owned' : ''}`);
  const button = el('button', undefined, 'card-open');
  button.type = 'button';
  button.setAttribute('aria-label', `View ${item.name}${owned ? ', in your collection' : ''}`);
  button.append(art(item));
  button.onclick = () => {
    pyramidDetailTransition = true;
    $('#pyramid-detail').close();
    showDetail(item);
  };
  const copy = el('div', undefined, 'pyramid-dialog-card-copy');
  copy.append(el('h3', item.name), el('p', item.number ? `Titan #${item.number}` : 'Verified Titan', 'muted'));
  if (owned) copy.append(el('span', 'YOUR TITAN', 'owned-badge'));
  card.append(button, copy);
  return card;
}

function showPyramidDetail(tier, trigger, nextTarget) {
  pyramidReturnFocus = trigger;
  const content = $('#pyramid-detail-content');
  const title = el('h2', tier.isTitan ? 'Titans outside the ranks' : `${tier.classValue} rank`);
  title.id = 'pyramid-detail-title';
  const intro = el('p', tier.isTitan
    ? `${tier.owned.toLocaleString()} owned. The Titan class is tracked separately and never changes pyramid completion.`
    : `${tier.owned.toLocaleString()} owned · ${tier.required.toLocaleString()} required per pyramid · ${tier.missingForNext.toLocaleString()} still needed for Pyramid ${nextTarget}.`, 'pyramid-dialog-intro');
  const tablist = el('div', undefined, 'pyramid-tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', `${tier.classValue} rank results`);
  const ownedTab = el('button', `Your Titans (${tier.matchingOwnedIndexes.length.toLocaleString()})`);
  const collectionTab = el('button', `Collection candidates (${tier.matchingCollectionIndexes.length.toLocaleString()})`);
  const panel = el('div', undefined, 'pyramid-results');
  panel.id = 'pyramid-results';
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = -1;
  const tabs = [ownedTab, collectionTab];
  ownedTab.id = 'pyramid-owned-tab';
  collectionTab.id = 'pyramid-collection-tab';
  tabs.forEach(tab => {
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
  });
  const ownedIndexes = new Set(tier.matchingOwnedIndexes);
  let activeView = 'owned';
  let visibleCount = PAGE_SIZE;
  const renderGrid = () => {
    const indexes = activeView === 'owned' ? tier.matchingOwnedIndexes : tier.matchingCollectionIndexes;
    const shown = indexes.slice(0, visibleCount);
    const grid = el('div', undefined, 'pyramid-dialog-grid');
    for (const index of shown) {
      const item = itemAtAnalyticsIndex(index);
      if (item) grid.append(pyramidResultCard(item, ownedIndexes.has(index)));
    }
    const summary = el('p', `Showing ${shown.length.toLocaleString()} of ${indexes.length.toLocaleString()} ${tier.classValue} ${indexes.length === 1 ? 'Titan' : 'Titans'}.`, 'pyramid-result-count');
    summary.setAttribute('role', 'status');
    const children = [summary, grid];
    if (shown.length < indexes.length) {
      const more = el('button', `Show ${Math.min(PAGE_SIZE, indexes.length - shown.length).toLocaleString()} more`, 'pyramid-load-more');
      more.type = 'button';
      more.onclick = () => {
        visibleCount += PAGE_SIZE;
        renderGrid();
        (panel.querySelector('.pyramid-load-more') ?? panel).focus();
      };
      children.push(more);
    }
    panel.replaceChildren(...children);
  };
  const renderView = view => {
    activeView = view;
    visibleCount = PAGE_SIZE;
    const activeTab = view === 'owned' ? ownedTab : collectionTab;
    tabs.forEach(tab => {
      const selected = tab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', activeTab.id);
    renderGrid();
  };
  ownedTab.onclick = () => renderView('owned');
  collectionTab.onclick = () => renderView('collection');
  tablist.onkeydown = event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  };
  tablist.append(...tabs);
  content.replaceChildren(el('div', 'THE FIVE RANKS', 'eyebrow'), title, intro, tablist, panel);
  const initialView = tier.isTitan || tier.missingForNext === 0 ? 'owned' : 'collection';
  renderView(initialView);
  $('#pyramid-detail').showModal();
  (initialView === 'owned' ? ownedTab : collectionTab).focus();
}

function rareDetailResultCard(item, owned) {
  const card = el('article', undefined, `rare-detail-result-card${owned ? ' is-owned' : ''}`);
  const button = el('button', undefined, 'card-open');
  button.type = 'button';
  button.setAttribute('aria-label', `View ${item.name}${owned ? ', in your collection' : ''}`);
  button.append(art(item));
  button.onclick = () => {
    rareDetailTransition = true;
    $('#rare-detail-dialog').close();
    showDetail(item);
  };
  const copy = el('div', undefined, 'rare-detail-result-copy');
  copy.append(el('h3', item.name), el('p', item.number ? `Titan #${item.number}` : 'Verified Titan', 'muted'));
  if (owned) copy.append(el('span', 'YOUR TITAN', 'owned-badge'));
  card.append(button, copy);
  return card;
}

function showRareDetail(detail, trigger) {
  rareDetailReturnFocus = trigger;
  const content = $('#rare-detail-dialog-content');
  const title = el('h2', detail.value);
  title.id = 'rare-detail-dialog-title';
  const intro = el('p', `${detail.category} · ${detail.bandLabel} · ${detail.collectionCount.toLocaleString()} of 6,500 Titans (${detail.collectionPercentage.toFixed(2)}%).`, 'rare-detail-dialog-intro');
  const tablist = el('div', undefined, 'rare-detail-tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', `${detail.value} trait results`);
  const collectionTab = el('button', `Meet the collection (${detail.collectionCount.toLocaleString()})`);
  const ownedTab = el('button', `Your Titans (${detail.ownedCount.toLocaleString()})`);
  const panel = el('div', undefined, 'rare-detail-results');
  panel.id = 'rare-detail-results';
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = -1;
  const tabs = [collectionTab, ownedTab];
  collectionTab.id = 'rare-detail-collection-tab';
  ownedTab.id = 'rare-detail-owned-tab';
  tabs.forEach(tab => {
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
  });
  const ownedIndexes = new Set(detail.matchingOwnedIndexes);
  let activeView = 'collection';
  let visibleCount = PAGE_SIZE;
  const renderGrid = () => {
    const indexes = activeView === 'collection' ? detail.matchingCollectionIndexes : detail.matchingOwnedIndexes;
    const shown = indexes.slice(0, visibleCount);
    const grid = el('div', undefined, 'rare-detail-dialog-grid');
    for (const index of shown) {
      const item = itemAtAnalyticsIndex(index);
      if (item) grid.append(rareDetailResultCard(item, ownedIndexes.has(index)));
    }
    const summary = el('p', `Showing ${shown.length.toLocaleString()} of ${indexes.length.toLocaleString()} matching ${indexes.length === 1 ? 'Titan' : 'Titans'}.`, 'rare-detail-result-count');
    summary.setAttribute('role', 'status');
    const children = [summary, grid];
    if (shown.length < indexes.length) {
      const more = el('button', `Show ${Math.min(PAGE_SIZE, indexes.length - shown.length).toLocaleString()} more`, 'rare-detail-load-more');
      more.type = 'button';
      more.onclick = () => {
        visibleCount += PAGE_SIZE;
        renderGrid();
        (panel.querySelector('.rare-detail-load-more') ?? panel).focus();
      };
      children.push(more);
    }
    panel.replaceChildren(...children);
  };
  const renderView = view => {
    activeView = view;
    visibleCount = PAGE_SIZE;
    const activeTab = view === 'collection' ? collectionTab : ownedTab;
    tabs.forEach(tab => {
      const selected = tab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', activeTab.id);
    renderGrid();
  };
  collectionTab.onclick = () => renderView('collection');
  ownedTab.onclick = () => renderView('owned');
  tablist.onkeydown = event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  };
  tablist.append(...tabs);
  content.replaceChildren(el('div', 'RARE DETAILS', 'eyebrow'), title, intro, tablist, panel);
  const initialView = detail.owned ? 'owned' : 'collection';
  renderView(initialView);
  $('#rare-detail-dialog').showModal();
  (initialView === 'owned' ? ownedTab : collectionTab).focus();
}

function miniCollectionResultCard(item, owned) {
  const card = el('article', undefined, `mini-collection-result-card${owned ? ' is-owned' : ''}`);
  const button = el('button', undefined, 'card-open');
  button.type = 'button';
  button.setAttribute('aria-label', `View ${item.name}${owned ? ', in your collection' : ''}`);
  button.append(art(item));
  button.onclick = () => {
    miniCollectionTransition = true;
    $('#mini-collection-dialog').close();
    showDetail(item);
  };
  const copy = el('div', undefined, 'mini-collection-result-copy');
  copy.append(el('h3', item.name), el('p', item.number ? `Titan #${item.number}` : 'Verified Titan', 'muted'));
  if (owned) copy.append(el('span', 'YOUR TITAN', 'owned-badge'));
  card.append(button, copy);
  return card;
}

function showMiniCollection(collection, trigger) {
  miniCollectionReturnFocus = trigger;
  const content = $('#mini-collection-dialog-content');
  const title = el('h2', collection.name);
  title.id = 'mini-collection-dialog-title';
  const intro = el('p', `${collection.description} ${collection.total.toLocaleString()} Titans match rule ${collection.ruleVersion}.`, 'mini-collection-dialog-intro');
  const rule = el('p', collection.ruleText, 'mini-collection-dialog-rule');
  const tablist = el('div', undefined, 'mini-collection-tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', `${collection.name} results`);
  const collectionTab = el('button', `Meet the collection (${collection.total.toLocaleString()})`);
  const ownedTab = el('button', `Your Titans (${collection.owned.toLocaleString()})`);
  const panel = el('div', undefined, 'mini-collection-results');
  panel.id = 'mini-collection-results';
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = -1;
  const tabs = [collectionTab, ownedTab];
  collectionTab.id = 'mini-collection-all-tab';
  ownedTab.id = 'mini-collection-owned-tab';
  tabs.forEach(tab => {
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
  });
  const ownedIndexes = new Set(collection.matchingOwnedIndexes);
  let activeView = 'collection';
  let visibleCount = PAGE_SIZE;
  const renderGrid = () => {
    const indexes = activeView === 'collection' ? collection.matchingCollectionIndexes : collection.matchingOwnedIndexes;
    const shown = indexes.slice(0, visibleCount);
    const grid = el('div', undefined, 'mini-collection-dialog-grid');
    for (const index of shown) {
      const item = itemAtAnalyticsIndex(index);
      if (item) grid.append(miniCollectionResultCard(item, ownedIndexes.has(index)));
    }
    const summary = el('p', `Showing ${shown.length.toLocaleString()} of ${indexes.length.toLocaleString()} matching ${indexes.length === 1 ? 'Titan' : 'Titans'}.`, 'mini-collection-result-count');
    summary.setAttribute('role', 'status');
    const children = [summary, grid];
    if (shown.length < indexes.length) {
      const more = el('button', `Show ${Math.min(PAGE_SIZE, indexes.length - shown.length).toLocaleString()} more`, 'mini-collection-load-more');
      more.type = 'button';
      more.onclick = () => {
        visibleCount += PAGE_SIZE;
        renderGrid();
        (panel.querySelector('.mini-collection-load-more') ?? panel).focus();
      };
      children.push(more);
    }
    panel.replaceChildren(...children);
  };
  const renderView = view => {
    activeView = view;
    visibleCount = PAGE_SIZE;
    const activeTab = view === 'collection' ? collectionTab : ownedTab;
    tabs.forEach(tab => {
      const selected = tab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', activeTab.id);
    renderGrid();
  };
  collectionTab.onclick = () => renderView('collection');
  ownedTab.onclick = () => renderView('owned');
  tablist.onkeydown = event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  };
  tablist.append(...tabs);
  content.replaceChildren(el('div', 'A COLLECTION WITHIN THE COLLECTION', 'eyebrow'), title, intro, rule, tablist, panel);
  renderView(collection.owned ? 'owned' : 'collection');
  $('#mini-collection-dialog').showModal();
  (collection.owned ? ownedTab : collectionTab).focus();
}

function saveFavorites() {
  try { localStorage.setItem('titans-saved-v1', JSON.stringify(state.favorites)); } catch { /* Continue in memory. */ }
}

function saveButton(item) {
  const saved = state.favorites.includes(item.id);
  const button = el('button', saved ? '★' : '☆', 'save');
  button.type = 'button';
  button.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${item.name}`);
  button.setAttribute('aria-pressed', String(saved));
  button.onclick = () => {
    state.favorites = saved ? state.favorites.filter(id => id !== item.id) : [...state.favorites, item.id];
    saveFavorites();
    render();
  };
  return button;
}

function renderTable(visible, root) {
  const categories = Object.keys(traitCounts);
  const wrap = el('div', undefined, 'table-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', 'Scrollable collection table');
  const table = el('table');
  const head = el('thead');
  const headingRow = el('tr');
  ['Item', ...categories, 'Saved'].forEach(name => {
    const cell = el('th', name);
    cell.scope = 'col';
    headingRow.append(cell);
  });
  head.append(headingRow);
  const body = el('tbody');
  for (const item of visible) {
    const row = el('tr');
    const nameCell = el('td');
    const button = el('button', item.name, 'text-button');
    button.type = 'button';
    button.onclick = () => showDetail(item);
    nameCell.append(button);
    row.append(nameCell);
    categories.forEach(key => row.append(el('td', item.traits[key] ?? '—')));
    const savedCell = el('td');
    savedCell.append(saveButton(item));
    row.append(savedCell);
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  root.append(wrap);
}

function renderGrid(visible, root) {
  for (const item of visible) {
    const card = el('article', undefined, 'card');
    const button = el('button', undefined, 'card-open');
    button.type = 'button';
    button.setAttribute('aria-label', `View ${item.name}`);
    button.append(art(item));
    button.onclick = () => showDetail(item);
    const info = el('div', undefined, 'card-info');
    info.append(
      el('span', item.number ? `TITAN #${item.number}` : 'VERIFIED TITAN', 'eyebrow'),
      el('h3', item.name),
      el('p', item.traits.Class ?? 'Class unavailable', 'muted'),
    );
    card.append(button, info, saveButton(item));
    root.append(card);
  }
}

function resetExplorer() {
  state.query = '';
  state.traits = {};
  state.favoritesOnly = false;
  state.sort = 'asc';
  state.page = 0;
  $('#search').value = '';
  $('#sort').value = 'asc';
  $('#favorites-only').checked = false;
  document.querySelectorAll('#filters select').forEach(select => { select.value = ''; });
  render();
}

function renderPagination(total, root) {
  if (total <= PAGE_SIZE) return;
  const start = state.page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const wrap = el('div', undefined, 'load-more-wrap');
  const previous = el('button', 'Previous', 'load-more');
  previous.type = 'button';
  previous.disabled = state.page === 0;
  previous.onclick = () => { state.page -= 1; render(); $('#collection-title').scrollIntoView(); };
  const next = el('button', 'Next', 'load-more');
  next.type = 'button';
  next.disabled = end >= total;
  next.onclick = () => { state.page += 1; render(); $('#collection-title').scrollIntoView(); };
  wrap.append(previous, el('span', `${(start + 1).toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`, 'muted'), next);
  root.append(wrap);
}

function render() {
  if (!snapshot) return;
  const visible = explore(items, state);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  if (state.page >= pageCount) state.page = pageCount - 1;
  const start = state.page * PAGE_SIZE;
  const rendered = visible.slice(start, start + PAGE_SIZE);
  const activeFilters = Object.values(state.traits).filter(Boolean).length + Number(Boolean(state.query)) + Number(state.favoritesOnly);
  $('#count').textContent = `${visible.length.toLocaleString()} of ${items.length.toLocaleString()} Titans`;
  $('#active-count').textContent = activeFilters ? `${activeFilters} active` : 'None active';
  const root = $('#items');
  root.replaceChildren();
  root.className = state.view;
  if (!visible.length) {
    const empty = el('div', undefined, 'empty');
    empty.append(el('div', '0', 'empty-number'), el('h3', 'No Titans match'), el('p', 'Try clearing one or more search or trait filters.'));
    const reset = el('button', 'Reset explorer', 'reset-button');
    reset.type = 'button';
    reset.onclick = resetExplorer;
    empty.append(reset);
    root.append(empty);
    return;
  }
  if (state.view === 'table') renderTable(rendered, root);
  else renderGrid(rendered, root);
  renderPagination(visible.length, root);
}

function renderFilters() {
  const root = $('#filters');
  root.replaceChildren();
  for (const [category, counts] of Object.entries(traitCounts)) {
    const label = el('label', category, 'trait');
    const select = el('select');
    select.setAttribute('aria-label', `Filter by ${category}`);
    const all = el('option', `All ${category.toLowerCase()}`);
    all.value = '';
    select.append(all);
    for (const [value, count] of Object.entries(counts)) {
      const option = el('option', `${value} (${count.toLocaleString()})`);
      option.value = value;
      select.append(option);
    }
    select.onchange = () => {
      state.traits[category] = select.value;
      state.page = 0;
      render();
    };
    label.append(select);
    root.append(label);
  }
}

function renderSnapshotState() {
  const age = Date.now() - new Date(snapshot.activatedAt).getTime();
  const partial = snapshot.status === 'partial';
  const stale = age > STALE_AFTER_MS;
  const status = $('#data-status');
  status.className = `data-status ${partial || stale ? 'is-warning' : 'is-current'}`;
  const label = partial ? 'PARTIAL SNAPSHOT' : stale ? 'SNAPSHOT MAY BE STALE' : 'VERIFIED SNAPSHOT';
  const message = partial
    ? `${snapshot.assetCount.toLocaleString()} of ${snapshot.expectedCount.toLocaleString()} Titans are available.`
    : `${snapshot.assetCount.toLocaleString()} Titans · updated ${formatDate(snapshot.activatedAt)}`;
  status.replaceChildren(el('strong', label), el('span', message));
  $('#snapshot-label').textContent = partial ? 'PARTIAL COLLECTION' : 'COMPLETE COLLECTION';
}

function setControlsDisabled(disabled) {
  for (const control of document.querySelectorAll('.toolbar input, .toolbar select, .toolbar button, aside input, aside button')) control.disabled = disabled;
}

function renderUnavailable() {
  const status = $('#data-status');
  status.className = 'data-status is-error';
  const retry = el('button', 'Try again', 'retry-button');
  retry.type = 'button';
  retry.onclick = initialize;
  status.replaceChildren(el('strong', 'COLLECTION UNAVAILABLE'), el('span', 'The last validated snapshot could not be loaded.'), retry);
  $('#count').textContent = 'Collection unavailable';
  const empty = el('div', undefined, 'empty');
  empty.append(el('h3', 'We could not load the Titans'), el('p', 'No partial or unvalidated data has been displayed. Please try again.'));
  $('#items').replaceChildren(empty);
  setControlsDisabled(true);
}

async function initialize() {
  const status = $('#data-status');
  status.className = 'data-status is-loading';
  status.replaceChildren(el('strong', 'LOADING COLLECTION'), el('span', 'Validating the active Titan snapshot…'));
  setControlsDisabled(true);
  try {
    snapshot = await publicCollectionProvider.getSnapshot();
    items = snapshotItems(snapshot);
    itemsById = new Map(items.map(item => [item.id, item]));
    traitCounts = traitOptionCounts(items);
    try {
      analytics = await publicAnalyticsProvider.getSnapshot({ expectedSnapshotId: snapshot.snapshotId });
    } catch {
      analytics = null;
    }
    try {
      const saved = JSON.parse(localStorage.getItem('titans-saved-v1') || '[]');
      if (Array.isArray(saved)) state.favorites = saved.filter(id => items.some(item => item.id === id));
    } catch { /* Storage is optional; the explorer still works in memory. */ }
    renderFilters();
    const summary = collectionSummary(items, snapshot.expectedCount);
    $('#total').textContent = summary.titans.toLocaleString();
    $('#collection-percentage').textContent = summary.percentage;
    $('#class-total').textContent = summary.classes.toLocaleString();
    renderSnapshotState();
    setControlsDisabled(false);
    render();
  } catch {
    snapshot = null;
    renderUnavailable();
  }
}

function activateView() {
  const view = location.hash === '#fortress' ? 'fortress' : 'collection';
  $('#collection-page').hidden = view !== 'collection';
  $('#fortress-page').hidden = view !== 'fortress';
  document.querySelectorAll('[data-view-link]').forEach(link => {
    if (link.dataset.viewLink === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = view === 'fortress' ? 'The Fortress · House of Titans' : 'House of Titans · Collection Insights';
  if (view === 'fortress') renderWallets();
}

function setFortressBusy(busy) {
  for (const control of document.querySelectorAll('#fortress-page button, #fortress-page textarea')) control.disabled = busy;
  $('#fortress-page').classList.toggle('is-busy', busy);
  $('#fortress-page').setAttribute('aria-busy', String(busy));
}

function showFortressStatus(title, message, tone = 'info') {
  const root = $('#fortress-status');
  root.className = `fortress-status is-${tone}`;
  root.replaceChildren(el('strong', title), el('span', message));
  root.hidden = false;
}

function hideFortressStatus() {
  $('#fortress-status').hidden = true;
}

function renderWallets() {
  discoveredWallets = listCip30Wallets();
  const root = $('#wallet-list');
  root.replaceChildren();
  if (!discoveredWallets.length) {
    const empty = el('div', undefined, 'wallet-empty');
    empty.append(el('strong', 'No CIP-30 wallet detected'), el('span', 'Install or unlock a compatible Cardano wallet, then check again.'));
    root.append(empty);
    return;
  }
  for (const wallet of discoveredWallets) {
    const button = el('button', undefined, 'wallet-option');
    button.type = 'button';
    if (wallet.icon) {
      const icon = document.createElement('img');
      icon.src = wallet.icon;
      icon.width = 30;
      icon.height = 30;
      icon.alt = '';
      button.append(icon);
    } else {
      button.append(el('span', wallet.name.slice(0, 1).toUpperCase(), 'wallet-letter'));
    }
    const label = el('span');
    label.append(el('strong', wallet.name), el('small', 'Connect read-only'));
    button.append(label, el('b', '→'));
    button.onclick = () => beginWalletSession(wallet);
    root.append(button);
  }
}

function errorTitle(code) {
  return ({
    invalid_address: 'ADDRESS NOT VALID',
    wrong_network: 'CARDANO MAINNET REQUIRED',
    unsupported_wallet: 'NO SUPPORTED WALLET',
    wallet_access_rejected: 'WALLET ACCESS DECLINED',
    wallet_no_address: 'NO ACCOUNT ADDRESS',
    wallet_unavailable: 'WALLET UNAVAILABLE',
    rate_limited: 'TOO MANY LOOKUPS',
    upstream_timeout: 'PROVIDER TIMED OUT',
    upstream_unavailable: 'HOLDINGS UNAVAILABLE',
    network_error: 'SERVICE UNREACHABLE',
  })[code] || 'PORTFOLIO UNAVAILABLE';
}

function renderPortfolio(session, portfolio) {
  fortressSession = { ...session, portfolio };
  const owner = analytics ? buildOwnerAnalytics(portfolio.assetIds, analytics) : null;
  const canonicalOwned = owner?.summary.titans ?? portfolio.assetIds.filter(assetId => items.some(item => item.id === assetId)).length;
  $('#fortress-title-prefix').textContent = 'Welcome to the';
  $('#portfolio-source').textContent = session.kind === 'wallet' ? `${session.label.toUpperCase()} · CONNECTED WALLET` : 'MANUALLY ENTERED ADDRESS';
  $('#portfolio-count').textContent = canonicalOwned.toLocaleString();
  $('#portfolio-percentage').textContent = owner ? `${owner.summary.collectionPercentage.toFixed(owner.summary.percentagePrecision)}%` : `${((canonicalOwned / 6500) * 100).toFixed(2)}%`;
  $('#portfolio-classes').textContent = owner ? owner.summary.classesRepresented.toLocaleString() : new Set(portfolio.assetIds.flatMap(assetId => {
    const value = items.find(item => item.id === assetId)?.traits.Class;
    return value ? [value] : [];
  })).size.toLocaleString();
  $('#clear-portfolio').textContent = 'Disconnect';
  renderCollectionCharacter(owner);
  renderUnexpectedPairings(owner, portfolio);
  renderTitansPyramid(owner, portfolio);
  renderRareDetails(owner, portfolio);
  renderMiniCollections(owner);
  $('#fortress-entry').hidden = true;
  $('#portfolio-result').hidden = false;
  if (portfolio.status === 'partial') showFortressStatus('PARTIAL RESULT', 'Some holdings were resolved, but the provider could not complete every address batch.', 'warning');
  else hideFortressStatus();
  $('#portfolio-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderMiniCollections(owner) {
  const section = $('#mini-collections');
  const root = $('#mini-collections-content');
  root.replaceChildren();
  section.hidden = false;
  const collections = owner ? Object.values(owner.miniCollections) : [];
  if (!owner || collections.length !== 9) {
    const empty = el('div', undefined, 'mini-collections-empty');
    empty.append(el('strong', 'The nine paths are temporarily unavailable'), el('span', 'The verified holdings are shown above, but the matching curated indexes could not be loaded.'));
    root.append(empty);
    return;
  }
  const grid = el('div', undefined, 'mini-collections-grid');
  for (const collection of collections) {
    const card = el('article', undefined, 'mini-collection-card');
    const composition = el('div', undefined, 'mini-collection-composition');
    collection.representativeIndexes.forEach((index, position) => {
      const item = itemAtAnalyticsIndex(index);
      if (!item) return;
      const frame = el('div', undefined, `mini-collection-frame frame-${position + 1}`);
      frame.append(art(item));
      composition.append(frame);
    });
    const body = el('div', undefined, 'mini-collection-card-body');
    body.append(el('h3', collection.name), el('p', collection.description, 'mini-collection-description'));
    const rule = el('div', undefined, 'mini-collection-rule');
    rule.append(el('strong', 'THE SELECTION'), el('span', collection.ruleText));
    const count = el('p', undefined, 'mini-collection-count');
    count.append(el('strong', collection.owned.toLocaleString()), document.createTextNode(` of ${collection.total.toLocaleString()} Titans`));
    const share = el('p', `${collection.ownerPercentage.toFixed(2)}% of this mini-collection is yours`, 'mini-collection-share');
    const open = el('button', 'Explore this collection', 'mini-collection-open');
    open.type = 'button';
    open.onclick = () => showMiniCollection(collection, open);
    body.append(rule, count, share, open);
    card.append(composition, body);
    grid.append(card);
  }
  root.append(grid);
}

function renderRareDetails(owner, portfolio) {
  const section = $('#rare-details');
  const root = $('#rare-details-content');
  root.replaceChildren();
  section.hidden = false;
  if (!owner) {
    const empty = el('div', undefined, 'rare-details-empty');
    empty.append(el('strong', 'Rare details are temporarily unavailable'), el('span', 'The verified holdings are shown above, but the matching collection analytics could not be loaded.'));
    root.append(empty);
    $('#rare-details-method').textContent = '';
    return;
  }
  const bandOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
  let showAll = false;
  let visibleCount = 36;
  const renderDetails = () => {
    const activeBands = showAll ? bandOrder : bandOrder.slice(0, 3);
    const details = activeBands.flatMap(band => owner.rareDetails.bands[band]?.details ?? []);
    const represented = details.filter(detail => detail.owned).length;
    const controls = el('div', undefined, 'rare-details-controls');
    const legend = el('div', undefined, 'rarity-legend');
    for (const bandId of bandOrder) {
      const band = owner.rareDetails.bands[bandId];
      const pill = el('span', `${band.label} ${band.details.length}`, `rarity-pill is-${band.id}`);
      legend.append(pill);
    }
    const toggle = el('button', showAll ? 'Show rare details' : 'Show all traits', 'rare-details-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(showAll));
    toggle.onclick = () => {
      showAll = !showAll;
      visibleCount = 36;
      renderDetails();
      root.querySelector('.rare-details-toggle')?.focus();
    };
    controls.append(legend, toggle);
    const summary = el('div', undefined, 'rare-details-summary');
    summary.append(
      el('strong', `${represented.toLocaleString()} represented`),
      el('span', `${(details.length - represented).toLocaleString()} still to collect · ${details.length.toLocaleString()} ${showAll ? 'supported traits' : 'traits under 6%'}`),
    );
    const grid = el('div', undefined, 'rare-details-grid');
    for (const detail of details.slice(0, visibleCount)) {
      const representative = itemAtAnalyticsIndex(detail.representativeIndex);
      if (!representative) continue;
      const card = el('article', undefined, `rare-detail-card is-${detail.band}${detail.owned ? ' is-owned' : ' is-missing'}`);
      const visual = el('div', undefined, 'rare-detail-visual');
      visual.append(art(representative));
      const body = el('div', undefined, 'rare-detail-card-body');
      const top = el('div', undefined, 'rare-detail-card-top');
      top.append(el('span', detail.category.toUpperCase(), 'eyebrow'), el('span', detail.bandLabel, `rarity-label is-${detail.band}`));
      body.append(
        top,
        el('h3', detail.value),
        el('p', `${detail.collectionCount.toLocaleString()} of 6,500 · ${detail.collectionPercentage.toFixed(2)}%`, 'rare-detail-frequency'),
        el('strong', detail.owned ? `${detail.ownedCount.toLocaleString()} in your collection · ${detail.ownedPercentage.toFixed(2)}%` : 'Still to collect', `rare-detail-state${detail.owned ? ' is-owned' : ''}`),
      );
      const open = el('button', detail.owned ? 'Explore this detail' : 'Meet matching Titans', 'rare-detail-open');
      open.type = 'button';
      open.onclick = () => showRareDetail(detail, open);
      body.append(open);
      card.append(visual, body);
      grid.append(card);
    }
    const children = [controls, summary, grid];
    if (visibleCount < details.length) {
      const more = el('button', `Show ${Math.min(36, details.length - visibleCount).toLocaleString()} more traits`, 'rare-details-more');
      more.type = 'button';
      more.onclick = () => {
        visibleCount += 36;
        renderDetails();
        (root.querySelector('.rare-details-more') ?? root.querySelector('.rare-details-toggle'))?.focus();
      };
      children.push(more);
    }
    root.replaceChildren(...children);
  };
  renderDetails();
  $('#rare-details-method').textContent = `Bands are descriptive navigation based on full-collection frequency: Legendary under 1%, Epic 1–under 3%, Rare 3–under 6%, Uncommon 6–under 15%, and Common 15% or more. They are not prices, investment guidance, or an official value score. Rule ${owner.rareDetails.ruleVersion}; ${owner.rareDetails.excludedPlaceholderCount} placeholder-like values excluded${portfolio.status === 'partial' ? ' · owner states based on partial holdings' : ''}.`;
}

function renderTitansPyramid(owner, portfolio) {
  const section = $('#titans-pyramid');
  const root = $('#pyramid-content');
  root.replaceChildren();
  section.hidden = false;
  if (!owner) {
    const empty = el('div', undefined, 'pyramid-empty');
    empty.append(el('strong', 'Pyramid progress is temporarily unavailable'), el('span', 'The verified holdings are shown above, but the matching collection analytics could not be loaded.'));
    root.append(empty);
    return;
  }
  const { pyramid } = owner;
  const layout = el('div', undefined, 'pyramid-layout');
  const summary = el('div', undefined, 'pyramid-summary');
  const completed = el('div', undefined, 'pyramid-completed');
  completed.append(el('strong', pyramid.completed.toLocaleString()), el('span', `${pyramid.completed === 1 ? 'complete pyramid' : 'complete pyramids'}`));
  const next = el('div', undefined, 'pyramid-next');
  next.append(
    el('span', `NEXT ATTAINABLE PYRAMID ${pyramid.nextTarget}`, 'eyebrow'),
    el('strong', `${pyramid.totalMissingForNext.toLocaleString()} ${pyramid.totalMissingForNext === 1 ? 'piece' : 'pieces'} remaining`),
  );
  const nextPyramidProgress = pyramid.requiredPerPyramid - pyramid.totalMissingForNext;
  const progress = el('div', undefined, 'pyramid-progress');
  const progressBar = el('span');
  progressBar.style.width = `${Math.max(0, Math.min(100, (nextPyramidProgress / pyramid.requiredPerPyramid) * 100))}%`;
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', `Progress toward Pyramid ${pyramid.nextTarget}`);
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', String(pyramid.requiredPerPyramid));
  progress.setAttribute('aria-valuenow', String(nextPyramidProgress));
  progress.append(progressBar);
  summary.append(completed, next, progress);

  const ranks = el('div', undefined, 'pyramid-ranks');
  pyramid.tiers.forEach((tier, index) => {
    const button = el('button', undefined, 'pyramid-tier');
    button.type = 'button';
    button.style.setProperty('--rank', String(index + 1));
    button.setAttribute('aria-label', `${tier.classValue}: ${tier.owned} owned, ${tier.required} required per pyramid, ${tier.missingForNext} needed for Pyramid ${pyramid.nextTarget}`);
    const mark = el('img', undefined, 'pyramid-tier-mark');
    mark.src = `src/assets/classes/${tier.classValue.toLowerCase()}-white.webp`;
    mark.alt = '';
    mark.setAttribute('aria-hidden', 'true');
    const name = el('span', undefined, 'pyramid-tier-name');
    name.append(el('strong', tier.classValue), el('small', `${tier.required} per pyramid`));
    const owned = el('span', undefined, 'pyramid-tier-owned');
    owned.append(el('strong', tier.owned.toLocaleString()), el('small', 'owned'));
    button.append(mark, name, owned);
    button.onclick = () => showPyramidDetail(tier, button, pyramid.nextTarget);
    ranks.append(button);
  });
  const titanBox = el('button', undefined, 'pyramid-titan-box');
  titanBox.type = 'button';
  titanBox.setAttribute('aria-label', `${pyramid.titanCount} Titan-class NFTs owned; excluded from pyramid completion`);
  const titanTier = {
    isTitan: true,
    classValue: 'Titan',
    owned: pyramid.titanCount,
    matchingOwnedIndexes: pyramid.titanOwnedIndexes,
    matchingCollectionIndexes: pyramid.titanCollectionIndexes,
  };
  const titanMark = el('img', undefined, 'pyramid-titan-mark');
  titanMark.src = 'src/assets/classes/titan-white.webp';
  titanMark.alt = '';
  titanMark.setAttribute('aria-hidden', 'true');
  titanBox.append(titanMark, el('strong', pyramid.titanCount.toLocaleString()), el('span', 'Titan class owned'), el('small', 'Tracked separately · not part of the pyramid'));
  titanBox.onclick = () => showPyramidDetail(titanTier, titanBox, pyramid.nextTarget);
  summary.append(titanBox);
  const right = el('div', undefined, 'pyramid-visual');
  right.append(ranks);
  layout.append(summary, right);
  root.append(layout);
}

function renderUnexpectedPairings(owner, portfolio) {
  const section = $('#unexpected-pairings');
  const root = $('#pairings-content');
  root.replaceChildren();
  section.hidden = false;
  if (!owner) {
    const empty = el('div', undefined, 'pairings-empty');
    empty.append(el('strong', 'Unexpected pairings are temporarily unavailable'), el('span', 'The verified holdings are shown above, but the matching collection analytics could not be loaded.'));
    root.append(empty);
    $('#pairings-method').textContent = '';
    return;
  }
  if (!owner.summary.titans) {
    const empty = el('div', undefined, 'pairings-empty');
    empty.append(el('strong', 'No pairings to meet yet'), el('span', 'This address holds no verified Titans.'));
    root.append(empty);
  } else if (!owner.pairings.highlights.length) {
    const empty = el('div', undefined, 'pairings-empty');
    empty.append(el('strong', 'No unexpected pairings meet the current rules'), el('span', 'Only cross-category combinations with repeat collection support, low collection frequency, and meaningful owner lift are shown.'));
    root.append(empty);
  } else {
    const grid = el('div', undefined, 'pairings-grid');
    for (const pairing of owner.pairings.highlights) {
      const representative = itemAtAnalyticsIndex(pairing.representativeIndex);
      if (!representative) continue;
      const card = el('article', undefined, 'pairing-card');
      const visual = el('div', undefined, 'pairing-visual');
      visual.append(art(representative));
      const body = el('div', undefined, 'pairing-card-body');
      const traits = el('div', undefined, 'pairing-traits');
      traits.append(el('span', pairingTraitLabel(pairing.left)), el('span', pairingTraitLabel(pairing.right)));
      body.append(
        el('h3', representative.name),
        traits,
        el('strong', `${pairing.collectionCount.toLocaleString()} Titans share this pairing`, 'pairing-support'),
        el('p', `${pairing.ownedCount.toLocaleString()} ${pairing.ownedCount === 1 ? 'is' : 'are'} yours · ${pairing.lift.toFixed(2)}× owner lift`, 'muted'),
      );
      const open = el('button', 'Meet the pairing', 'pairing-open');
      open.type = 'button';
      open.onclick = () => showPairingDetail(pairing, open);
      body.append(open);
      card.append(visual, body);
      grid.append(card);
    }
    root.append(grid);
  }
  $('#pairings-method').textContent = `Rules ${owner.pairings.ruleVersion} rank pairings by owner lift and collection scarcity. Eligible pairs occur on 2 or more Titans, cover no more than ${owner.pairings.maximumCollectionPercentage}% of the collection, and have at least ${owner.pairings.minimumLift.toFixed(2)}× lift${portfolio.status === 'partial' ? ' · based on partial holdings' : ''}.`;
}

function renderCollectionCharacter(owner) {
  const section = $('#collection-character');
  const root = $('#character-content');
  root.replaceChildren();
  section.hidden = false;
  if (!owner) {
    const state = el('div', undefined, 'character-empty');
    state.append(el('strong', 'Collection character is temporarily unavailable'), el('span', 'The verified holdings are shown above, but the matching collection analytics could not be loaded.'));
    root.append(state);
    return;
  }
  if (owner.summary.titans === 0) {
    const state = el('div', undefined, 'character-empty');
    state.append(el('strong', 'No collection character yet'), el('span', 'This address holds no verified Titans. The Fortress remains open without an ownership requirement.'));
    root.append(state);
  } else if (owner.character.lowEvidence) {
    const state = el('div', undefined, 'character-empty');
    state.append(
      el('strong', 'A little more evidence is needed'),
      el('span', `This portfolio has ${owner.summary.titans} ${owner.summary.titans === 1 ? 'Titan' : 'Titans'}. At least ${owner.character.minimumWalletSize} are required before repeated traits are presented as collection character.`),
    );
    root.append(state);
  } else if (!owner.character.highlights.length) {
    const state = el('div', undefined, 'character-empty');
    state.append(el('strong', 'No repeated traits meet the current threshold'), el('span', `Highlights require at least ${owner.character.minimumOwnedCount} owned Titans with the same non-placeholder trait and at least 1.10× collection lift.`));
    root.append(state);
  } else {
    const grid = el('div', undefined, 'character-grid');
    for (const highlight of owner.character.highlights) {
      const representative = itemAtAnalyticsIndex(highlight.representativeIndex);
      if (!representative) continue;
      const card = el('article', undefined, 'character-card');
      const visual = el('div', undefined, 'character-visual');
      visual.append(art(representative));
      const body = el('div', undefined, 'character-card-body');
      body.append(
        el('span', highlight.category.toUpperCase(), 'eyebrow'),
        el('h3', highlight.value),
        el('strong', `${highlight.lift.toFixed(2)}× your collection share`, 'character-lift'),
        el('p', `${highlight.ownedCount.toLocaleString()} of your Titans · ${highlight.collectionCount.toLocaleString()} of 6,500`, 'muted'),
      );
      const open = el('button', `View your ${highlight.ownedCount.toLocaleString()} matching ${highlight.ownedCount === 1 ? 'Titan' : 'Titans'}`, 'character-open');
      open.type = 'button';
      open.onclick = () => showCharacterDetail(highlight);
      body.append(open);
      card.append(visual, body);
      grid.append(card);
    }
    root.append(grid);
  }
}

async function resolveFortressSession(session) {
  setFortressBusy(true);
  showFortressStatus('CHECKING HOLDINGS', 'Resolving current House of Titans assets from Cardano…', 'loading');
  try {
    const portfolio = await lookupPortfolio(session.address);
    if (!analytics && snapshot) {
      try { analytics = await publicAnalyticsProvider.getSnapshot({ expectedSnapshotId: snapshot.snapshotId }); } catch { /* The holdings result remains usable. */ }
    }
    renderPortfolio(session, portfolio);
  } catch (error) {
    showFortressStatus(errorTitle(error.code), error.message || 'The portfolio could not be resolved.', 'error');
  } finally {
    setFortressBusy(false);
  }
}

async function beginWalletSession(wallet) {
  setFortressBusy(true);
  showFortressStatus('WAITING FOR WALLET', `Approve read-only address access in ${wallet.name}. No signature or transaction will be requested.`, 'loading');
  try {
    const connection = await connectCip30Wallet(wallet);
    await resolveFortressSession({ kind: 'wallet', address: connection.address, label: connection.walletName, wallet });
  } catch (error) {
    showFortressStatus(errorTitle(error.code), error.message || 'The wallet could not be connected.', 'error');
  } finally {
    setFortressBusy(false);
  }
}

function clearFortressSession() {
  fortressSession = null;
  $('#fortress-title-prefix').textContent = 'Enter the';
  $('#portfolio-result').hidden = true;
  $('#fortress-entry').hidden = false;
  $('#collection-character').hidden = true;
  $('#unexpected-pairings').hidden = true;
  $('#titans-pyramid').hidden = true;
  $('#rare-details').hidden = true;
  $('#mini-collections').hidden = true;
  $('#address-form').reset();
  hideFortressStatus();
  $('#scan-wallets').focus({ preventScroll: true });
}

async function refreshFortressSession() {
  if (!fortressSession) return;
  if (fortressSession.kind === 'wallet') {
    await beginWalletSession(fortressSession.wallet);
    return;
  }
  await resolveFortressSession({ kind: 'address', address: fortressSession.address, label: 'Address' });
}

$('#search').oninput = event => { state.query = event.target.value; state.page = 0; render(); };
$('#sort').onchange = event => { state.sort = event.target.value; state.page = 0; render(); };
$('#favorites-only').onchange = event => { state.favoritesOnly = event.target.checked; state.page = 0; render(); };
$('#reset').onclick = resetExplorer;
for (const view of ['grid', 'table']) {
  $(`#${view}-view`).onclick = () => {
    state.view = view;
    state.page = 0;
    for (const candidate of ['grid', 'table']) $(`#${candidate}-view`).setAttribute('aria-pressed', String(candidate === view));
    render();
  };
}
$('#close-detail').onclick = () => $('#detail').close();
$('#detail').onclick = event => { if (event.target === $('#detail')) $('#detail').close(); };
$('#close-character-detail').onclick = () => $('#character-detail').close();
$('#character-detail').onclick = event => { if (event.target === $('#character-detail')) $('#character-detail').close(); };
$('#close-pairing-detail').onclick = () => $('#pairing-detail').close();
$('#pairing-detail').onclick = event => { if (event.target === $('#pairing-detail')) $('#pairing-detail').close(); };
$('#pairing-detail').addEventListener('close', () => {
  if (pairingDetailTransition) {
    pairingDetailTransition = false;
    pairingReturnFocus = null;
    return;
  }
  pairingReturnFocus?.focus();
  pairingReturnFocus = null;
});
$('#close-pyramid-detail').onclick = () => $('#pyramid-detail').close();
$('#pyramid-detail').onclick = event => { if (event.target === $('#pyramid-detail')) $('#pyramid-detail').close(); };
$('#pyramid-detail').addEventListener('close', () => {
  if (pyramidDetailTransition) {
    pyramidDetailTransition = false;
    pyramidReturnFocus = null;
    return;
  }
  pyramidReturnFocus?.focus();
  pyramidReturnFocus = null;
});
$('#close-rare-detail').onclick = () => $('#rare-detail-dialog').close();
$('#rare-detail-dialog').onclick = event => { if (event.target === $('#rare-detail-dialog')) $('#rare-detail-dialog').close(); };
$('#rare-detail-dialog').addEventListener('close', () => {
  if (rareDetailTransition) {
    rareDetailTransition = false;
    rareDetailReturnFocus = null;
    return;
  }
  rareDetailReturnFocus?.focus();
  rareDetailReturnFocus = null;
});
$('#close-mini-collection').onclick = () => $('#mini-collection-dialog').close();
$('#mini-collection-dialog').onclick = event => { if (event.target === $('#mini-collection-dialog')) $('#mini-collection-dialog').close(); };
$('#mini-collection-dialog').addEventListener('close', () => {
  if (miniCollectionTransition) {
    miniCollectionTransition = false;
    miniCollectionReturnFocus = null;
    return;
  }
  miniCollectionReturnFocus?.focus();
  miniCollectionReturnFocus = null;
});

$('#address-form').onsubmit = async event => {
  event.preventDefault();
  const address = $('#portfolio-address').value.trim();
  if (!address) {
    showFortressStatus('ADDRESS REQUIRED', 'Enter a Cardano mainnet stake or payment address.', 'error');
    $('#portfolio-address').focus();
    return;
  }
  await resolveFortressSession({ kind: 'address', address, label: 'Address' });
};
$('#scan-wallets').onclick = renderWallets;
$('#refresh-portfolio').onclick = refreshFortressSession;
$('#clear-portfolio').onclick = clearFortressSession;
window.addEventListener('hashchange', activateView);

await initialize();
activateView();
