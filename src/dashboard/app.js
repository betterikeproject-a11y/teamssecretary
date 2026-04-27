// ============================================================
// src/dashboard/app.js
// Dashboard frontend — fetches data from API and renders
// bot notes and timesheet views.
// ============================================================

const API_BASE = '/api';
let allItems   = [];
let activeType = 'all';
let userEmail  = localStorage.getItem('haa_email') || '';

let allTimesheetEntries  = [];
let activeTimesheetFilter = null; // null = all, or { month, year }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginError = document.getElementById('login-error');
const userEmailDisplay = document.getElementById('user-email-display');
const btnLogout = document.getElementById('btn-logout');

const navNotes = document.getElementById('nav-notes');
const navTimesheet = document.getElementById('nav-timesheet');
const viewNotes = document.getElementById('view-notes');
const viewTimesheet = document.getElementById('view-timesheet');

const grid    = document.getElementById('items-grid');
const loading = document.getElementById('loading');
const empty   = document.getElementById('empty');

const tsForm = document.getElementById('timesheet-form');
const tsTbody = document.getElementById('timesheet-tbody');
const tsEmpty = document.getElementById('ts-empty');

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!userEmail) {
    loginOverlay.style.display = 'flex';
  } else {
    loginOverlay.style.display = 'none';
    userEmailDisplay.textContent = userEmail;
    btnLogout.style.display = 'inline-block';
    loadData();
    loadTimesheetData();
  }
  bindEvents();
});

// Helper for authenticated API calls
async function apiFetch(url, options = {}) {
  const headers = { 
    ...options.headers, 
    'X-User-Email': userEmail 
  };
  return fetch(url, { ...options, headers });
}

function bindEvents() {
  // Auth
  loginForm.addEventListener('submit', handleLogin);
  btnLogout.addEventListener('click', handleLogout);

  // Nav
  navNotes.addEventListener('click', () => switchTab('notes'));
  navTimesheet.addEventListener('click', () => switchTab('timesheet'));

  // Bot Notes
  document.getElementById('btn-refresh').addEventListener('click', () => {
    loadData();
    loadTimesheetData();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.type;
      renderItems();
    });
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Timesheet
  tsForm.addEventListener('submit', handleTimesheetSubmit);

  // Assistant
  document.getElementById('nav-assistant').addEventListener('click', () => switchTab('assistant'));
  document.getElementById('chat-send-btn').addEventListener('click', handleChatSend);
  document.getElementById('chat-file-input').addEventListener('change', handleFileStage);
  document.getElementById('chat-file-remove').addEventListener('click', clearStagedFile);
  document.getElementById('chat-textarea').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  });
  document.getElementById('chat-textarea').addEventListener('input', autoResizeChatTextarea);
}

// ── Auth ──────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmail.value.trim();
  loginError.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (res.ok) {
      userEmail = email;
      localStorage.setItem('haa_email', email);
      loginOverlay.style.display = 'none';
      userEmailDisplay.textContent = email;
      btnLogout.style.display = 'inline-block';
      loadData();
      loadTimesheetData();
    } else {
      loginError.style.display = 'block';
    }
  } catch (err) {
    loginError.textContent = 'Network error. Please try again.';
    loginError.style.display = 'block';
  }
}

function handleLogout() {
  userEmail = '';
  localStorage.removeItem('haa_email');
  userEmailDisplay.textContent = '';
  btnLogout.style.display = 'none';
  loginOverlay.style.display = 'flex';
  // Clear data
  grid.innerHTML = '';
  tsTbody.innerHTML = '';
}

// ── Navigation ────────────────────────────────────────────────
function switchTab(tab) {
  const navAssistant  = document.getElementById('nav-assistant');
  const viewAssistant = document.getElementById('view-assistant');

  navNotes.classList.toggle('active',     tab === 'notes');
  navTimesheet.classList.toggle('active', tab === 'timesheet');
  navAssistant.classList.toggle('active', tab === 'assistant');

  viewNotes.style.display     = tab === 'notes'     ? 'block' : 'none';
  viewTimesheet.style.display = tab === 'timesheet' ? 'block' : 'none';
  viewAssistant.style.display = tab === 'assistant' ? 'block' : 'none';
}

// ── Bot Notes ─────────────────────────────────────────────────
async function loadData() {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');
  showLoading(true);

  try {
    const [itemsRes, statsRes] = await Promise.all([
      apiFetch(`${API_BASE}/items`),
      apiFetch(`${API_BASE}/stats`),
    ]);

    if (itemsRes.status === 403 || statsRes.status === 403) return handleLogout();
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

async function deleteItem(id, cardEl) {
  if (!confirm('Delete this item?')) return;
  try {
    const res = await apiFetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    allItems = allItems.filter(i => i.id !== id);
    cardEl.remove();
    if (grid.children.length === 0) empty.style.display = 'block';
    // Refresh stats
    const statsRes = await apiFetch(`${API_BASE}/stats`);
    updateStats(await statsRes.json());
  } catch {
    alert('Failed to delete item.');
  }
}

// ── Timesheet ─────────────────────────────────────────────────
async function loadTimesheetData() {
  try {
    const res = await apiFetch(`${API_BASE}/timesheet`);
    if (res.status === 403) return;
    if (!res.ok) throw new Error('Failed to load timesheet');
    allTimesheetEntries = await res.json();

    // If the active filter month no longer has entries (e.g. after deleting), reset to all
    if (activeTimesheetFilter) {
      const still = allTimesheetEntries.some(e => {
        const dm = getEntryDisplayMonth(e.date);
        return dm.month === activeTimesheetFilter.month && dm.year === activeTimesheetFilter.year;
      });
      if (!still) activeTimesheetFilter = null;
    }

    renderTimesheetFilter();
    applyTimesheetFilter();
  } catch (err) {
    console.error('Failed to load timesheet:', err);
  }
}

function renderTimesheet(entries) {
  tsTbody.innerHTML = '';
  
  if (entries.length === 0) {
    tsEmpty.style.display = 'block';
    return;
  }
  tsEmpty.style.display = 'none';

  entries.forEach(entry => {
    const tr = document.createElement('tr');
    
    // Calculate total hours
    const dDate = new Date(entry.date);
    const dateStr = dDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    
    let totalStr = '-';
    if (entry.time_in && entry.time_out) {
      const tIn = new Date(`1970-01-01T${entry.time_in}`);
      const tOut = new Date(`1970-01-01T${entry.time_out}`);
      let diffMs = tOut - tIn;
      if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // handle overnight
      const diffHrs = diffMs / (1000 * 60 * 60);
      totalStr = `${diffHrs.toFixed(2)}h`;
    }

    const tInStr = entry.time_in ? entry.time_in.substring(0, 5) : '';
    const tOutStr = entry.time_out ? entry.time_out.substring(0, 5) : '';

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${entry.week_number || '-'}</td>
      <td>${escapeHtml(entry.schedule || '')}</td>
      <td>${escapeHtml(entry.billable_to || '')}</td>
      <td>${escapeHtml(entry.project_task || '')}</td>
      <td>${tInStr}</td>
      <td>${tOutStr}</td>
      <td><strong>${totalStr}</strong></td>
      <td>${escapeHtml(entry.notes || '')}</td>
      <td class="actions">
        <button class="btn-delete" data-id="${entry.id}">Delete</button>
      </td>
    `;

    tr.querySelector('.btn-delete').addEventListener('click', () => deleteTimesheetEntry(entry.id));
    tsTbody.appendChild(tr);
  });
}

function getWeekNumber(d) {
  // Sun-Sat week number calculation
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

async function handleTimesheetSubmit(e) {
  e.preventDefault();
  
  const dateVal = document.getElementById('ts-date').value;
  const weekNum = getWeekNumber(dateVal);

  const payload = {
    date: dateVal,
    week_number: weekNum,
    schedule: document.getElementById('ts-schedule').value,
    billable_to: document.getElementById('ts-billable').value,
    project_task: document.getElementById('ts-project').value,
    time_in: document.getElementById('ts-timein').value,
    time_out: document.getElementById('ts-timeout').value,
    notes: document.getElementById('ts-notes').value
  };

  try {
    const res = await apiFetch(`${API_BASE}/timesheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save');
    
    tsForm.reset();
    document.getElementById('ts-date').focus();
    loadTimesheetData(); // refresh list
  } catch (err) {
    alert('Error saving timesheet entry.');
  }
}

async function deleteTimesheetEntry(id) {
  if (!confirm('Delete this entry?')) return;
  try {
    const res = await apiFetch(`${API_BASE}/timesheet/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    loadTimesheetData(); // refresh list
  } catch (err) {
    alert('Failed to delete entry.');
  }
}


// ── Timesheet Filtering ───────────────────────────────────────

// Custom month: 26th of prev calendar month → 25th of this month.
// Parse the date string directly so timezone offsets never shift the day.
function getEntryDisplayMonth(dateStr) {
  const [year, month, day] = dateStr.substring(0, 10).split('-').map(Number);
  if (day >= 26) {
    return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
  }
  return { month, year };
}

function renderTimesheetFilter() {
  const bar = document.getElementById('ts-filter-bar');

  // Collect unique display-months that have at least one entry
  const monthMap = new Map();
  allTimesheetEntries.forEach(e => {
    const dm = getEntryDisplayMonth(e.date);
    const key = `${dm.year}-${String(dm.month).padStart(2, '0')}`;
    if (!monthMap.has(key)) monthMap.set(key, dm);
  });

  const months = [...monthMap.values()].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );

  bar.innerHTML = '';
  if (months.length === 0) return;

  const makeBtn = (label, tooltip, isActive, onClick) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    btn.textContent = label;
    if (tooltip) btn.title = tooltip;
    btn.addEventListener('click', onClick);
    return btn;
  };

  bar.appendChild(makeBtn('All', '', !activeTimesheetFilter, () => {
    activeTimesheetFilter = null;
    applyTimesheetFilter();
    renderTimesheetFilter();
  }));

  const currentYear = new Date().getFullYear();
  months.forEach(({ month, year }) => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const label   = year !== currentYear
      ? `${MONTH_SHORT[month - 1]} '${String(year).slice(-2)}`
      : MONTH_SHORT[month - 1];
    const tooltip = `${MONTH_SHORT[prevMonth - 1]} 26 – ${MONTH_SHORT[month - 1]} 25, ${year}`;
    const isActive = activeTimesheetFilter?.month === month && activeTimesheetFilter?.year === year;

    bar.appendChild(makeBtn(label, tooltip, isActive, () => {
      activeTimesheetFilter = { month, year };
      applyTimesheetFilter();
      renderTimesheetFilter();
    }));
  });
}

function applyTimesheetFilter() {
  const heading  = document.getElementById('ts-list-heading');
  const subtitle = document.getElementById('ts-list-subtitle');

  let filtered;
  if (!activeTimesheetFilter) {
    heading.textContent  = 'All Entries';
    subtitle.textContent = '';
    filtered = allTimesheetEntries;
  } else {
    const { month, year } = activeTimesheetFilter;
    const prevMonth = month === 1 ? 12 : month - 1;
    heading.textContent  = `${MONTH_NAMES[month - 1]} ${year}`;
    subtitle.textContent = `${MONTH_SHORT[prevMonth - 1]} 26 – ${MONTH_SHORT[month - 1]} 25`;
    filtered = allTimesheetEntries.filter(e => {
      const dm = getEntryDisplayMonth(e.date);
      return dm.month === month && dm.year === year;
    });
  }

  renderTimesheetSummary(filtered);
  renderTimesheet(filtered);
}

function renderTimesheetSummary(entries) {
  const card = document.getElementById('ts-summary-card');

  // Group total hours worked per calendar date (handles multiple entries on same day)
  const dayTotals = new Map();
  entries.forEach(entry => {
    if (!entry.time_in || !entry.time_out) return;
    const tIn  = new Date(`1970-01-01T${entry.time_in}`);
    const tOut = new Date(`1970-01-01T${entry.time_out}`);
    let diffMs = tOut - tIn;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // overnight shift
    const hours = diffMs / (1000 * 60 * 60);
    const key = entry.date.substring(0, 10);
    dayTotals.set(key, (dayTotals.get(key) || 0) + hours);
  });

  if (dayTotals.size === 0) {
    card.style.display = 'none';
    return;
  }

  let totalHours = 0, regularHours = 0, extraHours = 0;
  dayTotals.forEach(dayHours => {
    totalHours   += dayHours;
    regularHours += Math.min(dayHours, 8);
    extraHours   += Math.max(0, dayHours - 8);
  });

  const fmt = h => {
    const hrs  = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  };

  document.getElementById('ts-total-hours').textContent   = fmt(totalHours);
  document.getElementById('ts-regular-hours').textContent = fmt(regularHours);
  document.getElementById('ts-extra-hours').textContent   = fmt(extraHours);

  card.style.display = 'flex';
}

// ── Utilities ─────────────────────────────────────────────────
function openModal(item) {
  // ... existing code
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

function updateStats(stats) {
  document.getElementById('stat-total').textContent   = `${stats.total} items`;
  document.getElementById('stat-meeting').textContent = stats.meeting;
  document.getElementById('stat-task').textContent    = stats.task;
  document.getElementById('stat-note').textContent    = stats.note;
  document.getElementById('stat-idea').textContent    = stats.idea;
}

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

// ── Assistant Chat ─────────────────────────────────────────────

let conversationHistory = [];
let stagedFile          = null;
let chatIsLoading       = false;
let typingCounter       = 0;

function handleFileStage(e) {
  const file = e.target.files[0];
  if (!file) return;
  stagedFile = { file, name: file.name };
  document.getElementById('chat-file-name').textContent = file.name;
  document.getElementById('chat-file-strip').style.display = 'flex';
  e.target.value = ''; // allow re-selecting the same file
}

function clearStagedFile() {
  stagedFile = null;
  document.getElementById('chat-file-strip').style.display = 'none';
  document.getElementById('chat-file-name').textContent = '';
}

async function handleChatSend() {
  if (chatIsLoading) return;
  const textarea = document.getElementById('chat-textarea');
  const message  = textarea.value.trim();
  if (!message && !stagedFile) return;

  chatIsLoading = true;
  document.getElementById('chat-send-btn').disabled = true;

  const displayText = stagedFile
    ? (message ? `${message}  📎 ${stagedFile.name}` : `📎 ${stagedFile.name}`)
    : message;
  appendChatBubble('user', displayText);

  textarea.value = '';
  autoResizeChatTextarea();

  const typingId   = appendTypingIndicator();
  const fileToSend = stagedFile ? stagedFile.file : null;
  clearStagedFile();

  try {
    const data = fileToSend
      ? await sendChatWithFile(message, fileToSend)
      : await sendChatMessage(message);

    removeTypingIndicator(typingId);
    appendChatBubble('assistant', data.reply);

    // Keep history capped at 30 entries (15 turns) to avoid huge payloads
    conversationHistory.push({ role: 'user',      content: message || `[file: ${data.fileName || ''}]` });
    conversationHistory.push({ role: 'assistant', content: data.reply });
    if (conversationHistory.length > 30) conversationHistory = conversationHistory.slice(-30);

    if (data.savedItem) {
      showChatSavedBanner(data.savedItem);
      loadData(); // refresh Bot Notes tab in background
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    appendChatBubble('assistant', 'Sorry, something went wrong. Please try again.', true);
    console.error('Chat error:', err);
  } finally {
    chatIsLoading = false;
    document.getElementById('chat-send-btn').disabled = false;
    textarea.focus();
  }
}

async function sendChatMessage(message) {
  const res = await apiFetch(`${API_BASE}/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message, conversationHistory }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sendChatWithFile(message, file) {
  const formData = new FormData();
  formData.append('file', file);
  if (message) formData.append('message', message);
  formData.append('conversationHistory', JSON.stringify(conversationHistory));
  // Do NOT set Content-Type — browser sets it with the multipart boundary
  const res = await apiFetch(`${API_BASE}/chat/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function appendChatBubble(role, text, isError = false) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-bubble chat-bubble-${role}${isError ? ' chat-bubble-error' : ''}`;
  // Render **bold** and line breaks; escape everything else
  div.innerHTML = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function appendTypingIndicator() {
  const id = `typing-${++typingCounter}`;
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.id = id;
  div.className = 'chat-bubble chat-bubble-assistant chat-typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  document.getElementById(id)?.remove();
}

function showChatSavedBanner(savedItem) {
  const banner = document.getElementById('chat-saved-banner');
  document.getElementById('chat-saved-text').textContent =
    `✅ Saved ${savedItem.type}: "${savedItem.title}"`;
  banner.style.display = 'flex';
  setTimeout(() => { banner.style.display = 'none'; }, 4000);
}

function autoResizeChatTextarea() {
  const ta = document.getElementById('chat-textarea');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
}
