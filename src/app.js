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
let traitCounts = {};
let fortressSession = null;
let discoveredWallets = [];
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
  return items.find(item => item.id === assetId) ?? null;
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
  $('#portfolio-source').textContent = session.kind === 'wallet' ? `${session.label.toUpperCase()} / CONNECTED WALLET` : 'MANUALLY ENTERED ADDRESS';
  $('#portfolio-result-title').textContent = canonicalOwned ? 'Your gate is open' : 'The gate is open';
  $('#portfolio-count').textContent = canonicalOwned.toLocaleString();
  $('#portfolio-percentage').textContent = owner ? `${owner.summary.collectionPercentage.toFixed(owner.summary.percentagePrecision)}%` : `${((canonicalOwned / 6500) * 100).toFixed(2)}%`;
  $('#portfolio-classes').textContent = owner ? owner.summary.classesRepresented.toLocaleString() : new Set(portfolio.assetIds.flatMap(assetId => {
    const value = items.find(item => item.id === assetId)?.traits.Class;
    return value ? [value] : [];
  })).size.toLocaleString();
  $('#portfolio-state').textContent = portfolio.status === 'partial' ? 'Partial result' : 'Complete result';
  $('#portfolio-checked').textContent = formatDate(portfolio.retrievedAt);
  $('#clear-portfolio').textContent = session.kind === 'wallet' ? 'Disconnect' : 'Clear';
  const message = $('#portfolio-message');
  message.className = `portfolio-message ${portfolio.status === 'partial' ? 'is-partial' : canonicalOwned ? 'has-titans' : 'is-empty'}`;
  message.replaceChildren(
    el('strong', portfolio.status === 'partial' ? 'Partial holdings returned' : canonicalOwned ? `${canonicalOwned.toLocaleString()} verified ${canonicalOwned === 1 ? 'Titan' : 'Titans'} found` : 'No Titans found'),
    el('span', portfolio.status === 'partial'
      ? 'Some account addresses could not be checked. Refresh before relying on this count.'
      : canonicalOwned
        ? 'The verified asset IDs are ready for the owner insights that follow in The Fortress.'
        : 'This address has no current holdings under the verified House of Titans policy.'),
  );
  renderCollectionCharacter(owner, portfolio);
  $('#portfolio-result').hidden = false;
  if (portfolio.status === 'partial') showFortressStatus('PARTIAL RESULT', 'Some holdings were resolved, but the provider could not complete every address batch.', 'warning');
  else hideFortressStatus();
  $('#portfolio-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCollectionCharacter(owner, portfolio) {
  const section = $('#collection-character');
  const root = $('#character-content');
  root.replaceChildren();
  section.hidden = false;
  if (!owner) {
    const state = el('div', undefined, 'character-empty');
    state.append(el('strong', 'Collection character is temporarily unavailable'), el('span', 'The verified holdings are shown above, but the matching collection analytics could not be loaded.'));
    root.append(state);
    $('#character-method').textContent = '';
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
  $('#character-method').textContent = `Lift compares this portfolio’s trait share with the full collection. Rules ${owner.character.ruleVersion} · minimum ${owner.character.minimumOwnedCount} matching Titans · minimum 1.10× lift${portfolio.status === 'partial' ? ' · based on partial holdings' : ''}.`;
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
  $('#portfolio-result').hidden = true;
  $('#collection-character').hidden = true;
  $('#address-form').reset();
  hideFortressStatus();
  $('#fortress-entry-title').focus({ preventScroll: true });
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
