import { sampleCollectionProvider } from './data.js';
import { collectionSummary, explore } from './explorer.js';
import { createTitanImage, readMediaConfig, resolveIpfsImageUrl } from './media.js';
import { filterTraitCatalog } from './trait-catalog.js';

const $ = selector => document.querySelector(selector);
const items = await sampleCollectionProvider.getItems();
const mediaConfig = readMediaConfig();
const state = {
  query: '', traits: {}, favorites: [], favoritesOnly: false, sort: 'asc', view: 'grid',
};

try {
  const saved = JSON.parse(localStorage.getItem('titans-demo-saved') || '[]');
  if (Array.isArray(saved)) state.favorites = saved.filter(id => items.some(item => item.id === id));
} catch {
  // Storage is optional; the explorer still works in memory.
}

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function art(item) {
  if (item.imageUri || item.imageCid) return createTitanImage(item, mediaConfig);
  const node = el('div', undefined, 'art');
  node.style.setProperty('--hue', item.hue);
  node.append(el('span', 'T', 'art-symbol'), el('span', 'SYNTHETIC PREVIEW', 'art-label'));
  return node;
}

function mediaProvenance(item) {
  if (!item.imageUri && !item.imageCid) return null;
  try {
    const identity = resolveIpfsImageUrl(item, mediaConfig);
    const root = el('p', undefined, 'media-provenance');
    root.append(el('span', 'ON-CHAIN IMAGE'));
    const link = el('a', `CID ${identity.cid} ↗`);
    link.href = identity.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const uri = el('code', identity.imageUri);
    root.append(link, uri);
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
  const children = [
    art(item),
    el('div', 'SYNTHETIC SAMPLE NFT', 'eyebrow'),
    title,
    el('p', 'Verified vocabulary, fictional assignment', 'detail-provenance'),
    traits,
    el('p', 'This combination and artwork are placeholders. Ownership is not verified.', 'muted'),
  ];
  const provenance = mediaProvenance(item);
  if (provenance) children.push(provenance);
  content.replaceChildren(...children);
  $('#detail').showModal();
  $('#close-detail').focus();
}

function saveButton(item) {
  const saved = state.favorites.includes(item.id);
  const button = el('button', saved ? '★' : '☆', 'save');
  button.type = 'button';
  button.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${item.name}`);
  button.setAttribute('aria-pressed', String(saved));
  button.onclick = () => {
    state.favorites = saved ? state.favorites.filter(id => id !== item.id) : [...state.favorites, item.id];
    try { localStorage.setItem('titans-demo-saved', JSON.stringify(state.favorites)); } catch { /* Continue in memory. */ }
    render();
  };
  return button;
}

function renderTable(visible, root) {
  const wrap = el('div', undefined, 'table-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', 'Scrollable collection table');
  const table = el('table');
  const head = el('thead');
  const headingRow = el('tr');
  ['Item', ...Object.keys(filterTraitCatalog), 'Saved'].forEach(name => {
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
    Object.keys(filterTraitCatalog).forEach(key => row.append(el('td', item.traits[key])));
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
    info.append(el('span', 'SYNTHETIC NFT', 'eyebrow'), el('h3', item.name), el('p', `${item.traits.House} / ${item.traits.Class}`, 'muted'));
    card.append(button, info, saveButton(item));
    root.append(card);
  }
}

function resetExplorer() {
  state.query = '';
  state.traits = {};
  state.favoritesOnly = false;
  state.sort = 'asc';
  $('#search').value = '';
  $('#sort').value = 'asc';
  $('#favorites-only').checked = false;
  document.querySelectorAll('#filters select').forEach(select => { select.value = ''; });
  render();
}

function render() {
  const visible = explore(items, state);
  const activeFilters = Object.values(state.traits).filter(Boolean).length + Number(Boolean(state.query)) + Number(state.favoritesOnly);
  $('#count').textContent = `${visible.length} of ${items.length} synthetic items`;
  $('#active-count').textContent = activeFilters ? `${activeFilters} active` : 'None active';
  const root = $('#items');
  root.replaceChildren();
  root.className = state.view;
  if (!visible.length) {
    const empty = el('div', undefined, 'empty');
    empty.append(el('div', '0', 'empty-number'), el('h3', 'No sample Titans match'), el('p', 'The verified taxonomy is much larger than this 24-item synthetic preview.'));
    const reset = el('button', 'Reset explorer', 'reset-button');
    reset.type = 'button';
    reset.onclick = resetExplorer;
    empty.append(reset);
    root.append(empty);
    return;
  }
  if (state.view === 'table') renderTable(visible, root);
  else renderGrid(visible, root);
}

for (const [key, values] of Object.entries(filterTraitCatalog)) {
  const label = el('label', key, 'trait');
  const select = el('select');
  select.setAttribute('aria-label', `Filter by ${key}`);
  const all = el('option', `All ${key.toLowerCase()}`);
  all.value = '';
  select.append(all);
  values.forEach(value => {
    const option = el('option', value);
    option.value = value;
    select.append(option);
  });
  select.onchange = () => { state.traits[key] = select.value; render(); };
  label.append(select);
  $('#filters').append(label);
}

const summary = collectionSummary(items);
$('#total').textContent = summary.titans;
$('#collection-percentage').textContent = summary.percentage;
$('#class-total').textContent = summary.classes;
$('#search').oninput = event => { state.query = event.target.value; render(); };
$('#sort').onchange = event => { state.sort = event.target.value; render(); };
$('#favorites-only').onchange = event => { state.favoritesOnly = event.target.checked; render(); };
$('#reset').onclick = resetExplorer;
for (const view of ['grid', 'table']) {
  $(`#${view}-view`).onclick = () => {
    state.view = view;
    for (const candidate of ['grid', 'table']) $(`#${candidate}-view`).setAttribute('aria-pressed', String(candidate === view));
    render();
  };
}
$('#close-detail').onclick = () => $('#detail').close();
$('#detail').onclick = event => { if (event.target === $('#detail')) $('#detail').close(); };
render();
