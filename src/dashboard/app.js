// ============================================================
// src/dashboard/app.js
// Dashboard frontend — fetches data from /api/items and renders
// a filterable, responsive card grid.
// ============================================================

const API_BASE = '/api';
let allItems   = [];
let activeType = 'all';

const grid    = document.getElementById('items-grid');
const loading = document.getElementById('loading');
const empty   = document.getElementById('empty');

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindEvents();
});

function bindEvents() {
  document.getElementById('btn-refresh').addEventListener('click', () => loadData());

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.type;
      renderItems();
    });
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ── Data fetching ─────────────────────────────────────────────
async function loadData() {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');
  showLoading(true);

  try {
    const [itemsRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/items`),
      fetch(`${API_BASE}/stats`),
    ]);

    if (!itemsRes.ok || !statsRes.ok) throw new Error('Server error');

    allItems = await itemsRes.json();
    const stats = await statsRes.json();
    updateStats(stats);
    renderItems();
  } catch (err) {
    console.error('Failed to load data:', err);
    showError('Failed to load data. Is the server running?');
  } finally {
    btn.classList.remove('spinning');
    showLoading(false);
  }
}

// ── Rendering ─────────────────────────────────────────────────
function renderItems() {
  const filtered = activeType === 'all'
    ? allItems
    : allItems.filter(i => i.type === activeType);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(item => grid.appendChild(buildCard(item)));
}

function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.type = item.type;

  const icon     = typeIcon(item.type);
  const date     = formatDate(item.created_at);
  const tagsHtml = (item.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  const priority = item.priority
    ? `<span class="priority-badge priority-${item.priority}">${item.priority}</span>`
    : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${icon} ${escapeHtml(item.title)}</div>
      <button class="card-delete" data-id="${item.id}" title="Delete">✕</button>
    </div>
    <div class="card-summary">${escapeHtml(item.summary || '')}</div>
    <div class="card-footer">
      <span class="badge badge-${item.type}">${item.type}</span>
      ${priority}
      ${tagsHtml}
      <span class="card-date">${date}</span>
    </div>
  `;

  // Open detail modal on card click (not on delete button)
  card.addEventListener('click', e => {
    if (e.target.classList.contains('card-delete')) return;
    openModal(item);
  });

  card.querySelector('.card-delete').addEventListener('click', e => {
    e.stopPropagation();
    deleteItem(item.id, card);
  });

  return card;
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(item) {
  const icon     = typeIcon(item.type);
  const tagsHtml = (item.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  const priority = item.priority
    ? `<span class="priority-badge priority-${item.priority}">${item.priority} priority</span>`
    : '';

  document.getElementById('modal-content').innerHTML = `
    <h2>${icon} ${escapeHtml(item.title)}</h2>
    <div class="modal-meta">
      <span class="badge badge-${item.type}">${item.type}</span>
      ${priority}
      <span>${formatDate(item.created_at)}</span>
    </div>
    <div class="modal-body">${escapeHtml(item.summary || item.content || '')}</div>
    <div class="modal-tags">${tagsHtml}</div>
  `;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ── Delete ────────────────────────────────────────────────────
async function deleteItem(id, cardEl) {
  if (!confirm('Delete this item?')) return;
  try {
    const res = await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    allItems = allItems.filter(i => i.id !== id);
    cardEl.remove();
    if (grid.children.length === 0) empty.style.display = 'block';
    // Refresh stats
    const statsRes = await fetch(`${API_BASE}/stats`);
    updateStats(await statsRes.json());
  } catch {
    alert('Failed to delete item.');
  }
}

// ── Stats bar ─────────────────────────────────────────────────
function updateStats(stats) {
  document.getElementById('stat-total').textContent   = `${stats.total} items`;
  document.getElementById('stat-meeting').textContent = stats.meeting;
  document.getElementById('stat-task').textContent    = stats.task;
  document.getElementById('stat-note').textContent    = stats.note;
  document.getElementById('stat-idea').textContent    = stats.idea;
}

// ── Helpers ───────────────────────────────────────────────────
function typeIcon(type) {
  return { meeting: '📋', task: '✅', note: '📝', idea: '💡' }[type] || '📌';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showLoading(visible) {
  loading.style.display = visible ? 'block' : 'none';
  if (visible) empty.style.display = 'none';
}

function showError(msg) {
  loading.style.display = 'none';
  empty.innerHTML = `<p>⚠️ ${msg}</p>`;
  empty.style.display = 'block';
}
