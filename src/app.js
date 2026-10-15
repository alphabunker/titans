import { sampleCollectionProvider } from './data.js';
import { explore, traitOptions } from './explorer.js';
const $ = selector => document.querySelector(selector);
const items = await sampleCollectionProvider.getItems();
const state = { query: '', traits: {}, favorites: [], favoritesOnly: false, sort: 'asc', view: 'grid' };
try { const saved = JSON.parse(localStorage.getItem('titans-demo-saved') || '[]'); if (Array.isArray(saved)) state.favorites = saved.filter(id => items.some(item => item.id === id)); } catch { /* Storage is optional. */ }
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function art(item) { const node = el('div', undefined, 'art'); node.style.setProperty('--hue', item.hue); node.append(el('span', 'T', 'art-symbol'), el('span', 'PLACEHOLDER ART', 'art-label')); return node; }
function showDetail(item) { const content = $('#detail-content'); content.replaceChildren(art(item), el('div', 'FICTIONAL SAMPLE NFT', 'eyebrow'), el('h2', item.name)); content.querySelector('h2').id = 'detail-title'; for (const [key, value] of Object.entries(item.traits)) content.append(el('p', `${key}: ${value}`)); content.append(el('p', 'Placeholder artwork and metadata. Ownership and collection traits are not verified.', 'muted')); $('#detail').showModal(); }
function saveButton(item) { const saved = state.favorites.includes(item.id); const button = el('button', saved ? '★' : '☆', 'save'); button.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${item.name}`); button.setAttribute('aria-pressed', saved); button.onclick = () => { state.favorites = saved ? state.favorites.filter(id => id !== item.id) : [...state.favorites, item.id]; try { localStorage.setItem('titans-demo-saved', JSON.stringify(state.favorites)); } catch { /* Continue in memory. */ } render(); }; return button; }
function render() {
 const visible = explore(items, state); $('#count').textContent = `${visible.length} of ${items.length} sample items`; const root = $('#items'); root.replaceChildren(); root.className = state.view;
 if (!visible.length) { const empty = el('div', undefined, 'empty'); empty.append(el('h3', 'No Titans found'), el('p', 'Try another search or reset your filters.')); root.append(empty); return; }
 if (state.view === 'table') {
 const wrap = el('div', undefined, 'table-wrap'); const table = el('table'); const head = el('thead'); const row = el('tr'); ['Item', ...Object.keys(traitOptions(items)), 'Saved'].forEach(name => row.append(el('th', name))); head.append(row); const body = el('tbody'); for (const item of visible) { const tr = el('tr'); const td = el('td'); const button = el('button', item.name, 'text-button'); button.onclick = () => showDetail(item); td.append(button); tr.append(td); Object.values(item.traits).forEach(value => tr.append(el('td', value))); const saved = el('td'); saved.append(saveButton(item)); tr.append(saved); body.append(tr); } table.append(head, body); wrap.append(table); root.append(wrap);
 } else for (const item of visible) { const card = el('article', undefined, 'card'); const button = el('button', undefined, 'card-open'); button.setAttribute('aria-label', `View ${item.name}`); button.append(art(item)); button.onclick = () => showDetail(item); const info = el('div', undefined, 'card-info'); info.append(el('span', 'SAMPLE NFT', 'eyebrow'), el('h3', item.name), el('p', Object.values(item.traits).join(' / '), 'muted')); card.append(button, info, saveButton(item)); root.append(card); }
}
for (const [key, values] of Object.entries(traitOptions(items))) { const label = el('label', key, 'trait'); const select = el('select'); const all = el('option', 'All'); all.value = ''; select.append(all); values.forEach(value => { const option = el('option', value); option.value = value; select.append(option); }); select.onchange = () => { state.traits[key] = select.value; render(); }; label.append(select); $('#filters').append(label); }
$('#total').textContent = items.length;
$('#search').oninput = event => { state.query = event.target.value; render(); };
$('#sort').onchange = event => { state.sort = event.target.value; render(); };
$('#favorites-only').onchange = event => { state.favoritesOnly = event.target.checked; render(); };
$('#reset').onclick = () => { state.query = ''; state.traits = {}; state.favoritesOnly = false; state.sort = 'asc'; $('#search').value = ''; $('#sort').value = 'asc'; $('#favorites-only').checked = false; document.querySelectorAll('#filters select').forEach(select => select.value = ''); render(); };
for (const view of ['grid', 'table']) $(`#${view}-view`).onclick = () => { state.view = view; for (const v of ['grid', 'table']) $(`#${v}-view`).setAttribute('aria-pressed', v === view); render(); };
$('#close-detail').onclick = () => $('#detail').close();
render();
