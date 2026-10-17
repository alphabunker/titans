import { publicCollectionProvider, snapshotItems } from './data.js';
import { collectionSummary, explore, traitOptionCounts } from './explorer.js';
import { createTitanImage, readMediaConfig, resolveIpfsImageUrl } from './media.js';

const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 48;
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const mediaConfig = readMediaConfig();
let items = [];
let snapshot = null;
let traitCounts = {};
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
    traitCounts = traitOptionCounts(items);
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

await initialize();
