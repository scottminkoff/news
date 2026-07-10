// Lite variant of the reader. Same feeds and data files as the main page,
// but the six tiers are combined into three roomier columns:
//   National        = national + opinion
//   New York State  = state    + local (Hudson Valley)
//   Foreign Affairs = israel   + foreign
// Within each column, items are de-duped by URL and sorted newest-first.
// Source filtering is driven by both the header dropdown and the larger
// pill bar along the bottom, kept in sync.

const GROUPS = [
  { id: 'national', tiers: ['national', 'opinion'] },
  { id: 'nystate',  tiers: ['state', 'local'] },
  { id: 'foreign',  tiers: ['israel', 'foreign'] },
];
// Every underlying tier we need to fetch (order defines default interleave
// before the newest-first sort).
const TIERS = ['national', 'opinion', 'state', 'local', 'israel', 'foreign'];

const SOURCE_COLORS = {
  'NYT':                  { bg: '#544F4F', text: '#FFFFFF' },
  'New Yorker':           { bg: '#FFFFFF', text: '#000000' },
  'Axios':                { bg: '#4F69DB', text: '#FFFFFF' },
  'TPM':                  { bg: '#961515', text: '#FFFFFF' },
  'Capital Confidential': { bg: '#00497e', text: '#FFFFFF' },
  'Politico':             { bg: '#d71920', text: '#FFFFFF' },
  'Times Union':          { bg: '#53bce3', text: '#000000' },
  'Hudson Valley One':    { bg: '#ff6600', text: '#FFFFFF' },
  'Mid Hudson News':      { bg: '#96D982', text: '#000000' },
  'City & State':         { bg: '#005aab', text: '#FFCABA' },
  'NY State of Politics': { bg: '#9C14C9', text: '#FFFFFF' },
  'The Atlantic':         { bg: '#FFFFFF', text: '#e7131a' },
  'Daily Freeman':        { bg: '#fafafa', text: '#000000' },
  'Times of Israel':      { bg: '#0e4f97', text: '#FFFFFF' },
  'The Forward':          { bg: '#da9e0a', text: '#FFFFFF' },
  'NYT World':            { bg: '#544F4F', text: '#FFFFFF' },
  'WSJ World':            { bg: '#FFE6BD', text: '#000000' },
  'Jonah Goldberg':       { bg: '#f4efeb', text: '#d1221f' },
  'Boiling Frogs':        { bg: '#f4efeb', text: '#d1221f' },
  'Jamelle Bouie':        { bg: '#544F4F', text: '#FFFFFF' },
  'David French':         { bg: '#544F4F', text: '#FFFFFF' },
  'NYT Sunday Opinion':   { bg: '#544F4F', text: '#FFFFFF' },
  'The Browser':          { bg: '#FFF1DB', text: '#6B4B07' },
  'Jonathan V. Last':     { bg: '#000000', text: '#d0021b' },
};

function pickTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#000' : '#fff';
}

const FILTER_KEY = 'newslite.sourceFilter';
const TIME_FILTER_KEY = 'newslite.timeFilter';
const VIEW_KEY = 'newslite.view';
const VISITED_KEY = 'news.visited'; // shared with the main page
const VISITED_LIMIT = 1000;

// View modes:
//   'columns' — the three combined columns (default)
//   'all'     — a single combined feed of everything (the "All" button)
//   'saved'   — the columns filtered to bookmarked items (the "Bookmarks" button)
const VIEWS = ['columns', 'all', 'saved'];
const ALL_GROUP = { id: 'all', tiers: TIERS };

const state = {
  tiers: {},
  filter: localStorage.getItem(FILTER_KEY) || '',
  timeFilter: localStorage.getItem(TIME_FILTER_KEY) || '',
  search: '',
  visited: loadVisited(),
  view: VIEWS.includes(localStorage.getItem(VIEW_KEY)) ? localStorage.getItem(VIEW_KEY) : 'columns',
};

// --- combine tiers into a group -------------------------------------------

function aggregateGroup(group) {
  const items = [];
  const sources = [];
  const seen = new Set();
  const errors = [];
  for (const t of group.tiers) {
    const d = state.tiers[t];
    if (!d) continue;
    if (d.error) errors.push(d.error);
    if (Array.isArray(d.sources)) sources.push(...d.sources);
    if (!Array.isArray(d.items)) continue;
    for (const it of d.items) {
      if (it.link) {
        if (seen.has(it.link)) continue;
        seen.add(it.link);
      }
      items.push(it);
    }
  }
  items.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  return { items, sources, error: errors.length ? errors.join('; ') : null };
}

// --- visited (read) tracking ----------------------------------------------

function loadVisited() {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markVisited(link) {
  if (state.visited.has(link)) return;
  state.visited.add(link);
  if (state.visited.size > VISITED_LIMIT) {
    state.visited = new Set([...state.visited].slice(-VISITED_LIMIT));
  }
  localStorage.setItem(VISITED_KEY, JSON.stringify([...state.visited]));
}

// --- data loading ----------------------------------------------------------

async function loadTier(tier) {
  try {
    const res = await fetch(`./data/${tier}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.tiers[tier] = await res.json();
    return state.tiers[tier].fetched;
  } catch (err) {
    const prev = state.tiers[tier];
    state.tiers[tier] = {
      ...(prev || {}),
      items: prev?.items || [],
      sources: prev?.sources || [],
      error: err.message,
    };
    return null;
  }
}

// --- rendering -------------------------------------------------------------

const BUCKET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Earlier this week',
  older: 'Older',
  undated: 'Undated',
};

function bucketOf(pubDate) {
  if (!pubDate) return 'undated';
  const d = new Date(pubDate);
  if (!Number.isFinite(d.getTime())) return 'undated';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= today) return 'today';
  if (t >= today - 86_400_000) return 'yesterday';
  if (t >= today - 7 * 86_400_000) return 'week';
  return 'older';
}

function renderDivider(label) {
  const el = document.createElement('div');
  el.className = 'feed-divider';
  el.textContent = label;
  return el;
}

function filterItems(items) {
  const cutoff = state.timeFilter
    ? Date.now() - parseInt(state.timeFilter, 10) * 1000
    : null;
  const q = state.search.trim().toLowerCase();
  return items.filter(item => {
    if (state.view === 'saved' &&
        !window.Bookmarks.isBookmarked(window.Bookmarks.idFor(item))) return false;
    if (state.filter && item.source !== state.filter) return false;
    if (cutoff !== null) {
      if (!item.pubDate) return false;
      const t = new Date(item.pubDate).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
    }
    if (q) {
      const hay = `${item.title} ${item.description || ''} ${item.source}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderGroup(group) {
  const section = document.querySelector(`[data-tier="${group.id}"]`);
  if (!section) return;
  const container = section.querySelector('.feed');
  const data = aggregateGroup(group);
  container.innerHTML = '';

  if (data.error && !(data.items && data.items.length)) {
    container.innerHTML = `<div class="error">Failed to load: ${escapeHtml(data.error)}</div>`;
    return;
  }

  const items = filterItems(data.items);

  if (!items.length) {
    if (state.view === 'saved') {
      container.innerHTML = window.Auth.isSignedIn()
        ? '<div class="empty">No saved items in this section.</div>'
        : '<div class="empty">Sign in to save and view bookmarks.</div>';
    } else if (state.filter || state.timeFilter || state.search) {
      container.innerHTML = '<div class="empty">No matching items.</div>';
    } else {
      container.innerHTML = '<div class="empty">No items.</div>';
    }
    return;
  }

  const frag = document.createDocumentFragment();
  let lastBucket = null;
  for (const item of items) {
    const bucket = bucketOf(item.pubDate);
    if (bucket !== lastBucket) {
      frag.appendChild(renderDivider(BUCKET_LABELS[bucket]));
      lastBucket = bucket;
    }
    frag.appendChild(renderCard(item));
  }
  container.appendChild(frag);

  const failed = (data.sources || []).filter(s => !s.ok);
  if (failed.length && state.view !== 'saved') {
    const status = document.createElement('div');
    status.className = 'feed-status';
    status.innerHTML = `<span class="failed">Failed: ${failed.map(f => escapeHtml(f.name)).join(', ')}</span>`;
    container.appendChild(status);
  }
}

function renderCard(item) {
  const safeLink = safeUrl(item.link, ['http:', 'https:']);
  const safeImage = safeUrl(item.image, ['http:', 'https:']);
  const bookmarkId = window.Bookmarks.idFor(item);
  const isBookmarked = window.Bookmarks.isBookmarked(bookmarkId);
  const a = document.createElement('a');
  a.className = 'card' + (safeImage ? '' : ' no-image') + (state.visited.has(safeLink) ? ' visited' : '');
  a.href = safeLink || '#';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.addEventListener('click', () => {
    if (!safeLink) return;
    markVisited(safeLink);
    a.classList.add('visited');
  });

  const ago = item.pubDate ? timeAgo(new Date(item.pubDate)) : '';
  const pubAttr = item.pubDate ? ` data-pub="${escapeAttr(item.pubDate)}"` : '';

  a.innerHTML = `
    <div class="card-head"${sourceStyleAttr(item.source)}>${escapeHtml(item.source)}</div>
    <div class="card-main">
      <div class="card-body">
        <h3>${escapeHtml(item.title)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        <div class="card-meta">
          <span class="card-time"${pubAttr}>${ago}</span>
        </div>
      </div>
    </div>`;

  const main = a.querySelector('.card-main');

  if (safeImage) {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = safeImage;
    img.addEventListener('error', () => {
      img.remove();
      a.classList.add('no-image');
    });
    main.prepend(img);
  }

  const bm = document.createElement('button');
  bm.type = 'button';
  bm.className = 'bookmark-btn' + (isBookmarked ? ' active' : '');
  bm.setAttribute('aria-label', isBookmarked ? 'Remove bookmark' : 'Save bookmark');
  bm.setAttribute('aria-pressed', String(isBookmarked));
  bm.innerHTML = '<img src="./bookmark-ui-svgrepo-com.svg" alt="" width="16" height="16">';
  bm.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.Auth.isSignedIn()) {
      openSignIn();
      return;
    }
    window.Bookmarks.toggle(item);
  });
  main.appendChild(bm);

  return a;
}

// --- source filter (dropdown + bottom pills, kept in sync) -----------------

const sourcePillsEl = document.getElementById('source-pills');
const sourceBarEl = document.querySelector('.source-bar');
const sourceFilterEl = document.getElementById('source-filter');

function sourceNames() {
  const names = new Set();
  for (const tier of TIERS) {
    for (const s of state.tiers[tier]?.sources || []) names.add(s.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function populateSources() {
  const sorted = sourceNames();

  sourceFilterEl.innerHTML = '<option value="">All sources</option>' +
    sorted.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');

  sourcePillsEl.innerHTML = sorted.map(n =>
    `<button type="button" class="source-pill" data-source="${escapeAttr(n)}"${pillColorVar(n)}>${escapeHtml(n)}</button>`
  ).join('');

  // Drop a stale filter whose source is no longer present.
  if (state.filter && !sorted.includes(state.filter)) {
    state.filter = '';
    localStorage.removeItem(FILTER_KEY);
  }
  syncSourceControls();
}

function setFilter(name) {
  state.filter = state.filter === name ? '' : name;
  if (state.filter) localStorage.setItem(FILTER_KEY, state.filter);
  else localStorage.removeItem(FILTER_KEY);
  syncSourceControls();
  renderAll();
}

function syncSourceControls() {
  sourceFilterEl.value = state.filter;
  sourceFilterEl.classList.toggle('has-value', !!state.filter);
  sourceBarEl.classList.toggle('filtering', !!state.filter);
  for (const btn of sourcePillsEl.querySelectorAll('.source-pill')) {
    btn.classList.toggle('active', btn.dataset.source === state.filter);
  }
}

sourcePillsEl.addEventListener('click', e => {
  const btn = e.target.closest('.source-pill');
  if (btn) setFilter(btn.dataset.source);
});

sourceFilterEl.addEventListener('change', e => {
  state.filter = e.target.value;
  if (state.filter) localStorage.setItem(FILTER_KEY, state.filter);
  else localStorage.removeItem(FILTER_KEY);
  syncSourceControls();
  renderAll();
});

// --- shared helpers --------------------------------------------------------

function timeAgo(date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

function updateTimestamps() {
  for (const el of document.querySelectorAll('.card-time[data-pub]')) {
    const d = new Date(el.dataset.pub);
    if (Number.isFinite(d.getTime())) el.textContent = timeAgo(d);
  }
}
setInterval(updateTimestamps, 60_000);

const toastEl = document.getElementById('toast');
let toastTimer = null;
window.showToast = function (msg, { duration = 4000 } = {}) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, duration);
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function safeUrl(url, allowedProtocols) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return allowedProtocols.includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

function sourceStyleAttr(name) {
  if (!name) return '';
  const bg = brandColor(name, HEAD_LIGHTEN);
  // Auto-pick black/white text so the softened banner stays legible.
  return ` style="background:${bg};color:${pickTextColor(bg)}"`;
}

// Source pills carry the brand color only as a small dot (see .source-pill
// in lite.css), so they expose the color as a CSS var rather than a fill.
function pillColorVar(name) {
  if (!name) return '';
  return ` style="--pill-color:${brandColor(name)}"`;
}

// Lighten each publication's brand color toward white so it reads softer.
// The card-header banners are muted more than the small pill dots.
const BRAND_LIGHTEN = 0.15;  // pill dots
const HEAD_LIGHTEN = 0.30;   // card-header banners

function brandColor(name, amt = BRAND_LIGHTEN) {
  return lightenHex(SOURCE_COLORS[name]?.bg || hashSourceColor(name), amt);
}

function lightenHex(hex, amt) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = c => Math.round(c + (255 - c) * amt);
  return '#' + [mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hashSourceColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const r = 0x80 + (Math.abs(h)       % 0x60);
  const g = 0x80 + (Math.abs(h >> 8)  % 0x60);
  const b = 0x80 + (Math.abs(h >> 16) % 0x60);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// --- render + load ---------------------------------------------------------

function renderAll() {
  document.body.classList.toggle('view-all', state.view === 'all');
  if (state.view === 'all') {
    renderGroup(ALL_GROUP);
  } else {
    for (const group of GROUPS) renderGroup(group);
  }
}

async function loadAll() {
  const btn = document.getElementById('refresh');
  const updated = document.getElementById('updated');
  btn.disabled = true;
  updated.textContent = 'Updating…';

  for (const group of GROUPS) {
    const section = document.querySelector(`[data-tier="${group.id}"]`);
    if (section) section.querySelector('.feed').innerHTML = '<div class="loading">Loading…</div>';
  }

  const fetchedTimes = await Promise.all(TIERS.map(loadTier));
  populateSources();
  renderAll();

  const ok = fetchedTimes.filter(Boolean);
  if (ok.length) {
    const latest = new Date(Math.max(...ok.map(t => new Date(t).getTime())));
    const date = latest.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const time = latest.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    updated.textContent = `Last fetched ${date} · ${time}`;
    updated.title = latest.toLocaleString();
  } else {
    updated.textContent = '';
    updated.title = '';
  }
  btn.disabled = false;
}

// --- header controls -------------------------------------------------------

const logoEl = document.querySelector('.logo');
if (logoEl) {
  logoEl.addEventListener('click', () => document.getElementById('refresh').click());
  logoEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById('refresh').click();
    }
  });
}

document.getElementById('refresh').addEventListener('click', () => {
  clearTimeout(searchTimer);
  state.search = '';
  searchEl.value = '';
  state.timeFilter = '';
  timeFilterEl.value = '';
  timeFilterEl.classList.remove('has-value');
  localStorage.removeItem(TIME_FILTER_KEY);
  state.filter = '';
  localStorage.removeItem(FILTER_KEY);
  syncSourceControls();
  document.body.classList.remove('search-open');
  loadAll();
});

const timeFilterEl = document.getElementById('time-filter');
timeFilterEl.value = state.timeFilter;
timeFilterEl.addEventListener('change', e => {
  state.timeFilter = e.target.value;
  if (state.timeFilter) localStorage.setItem(TIME_FILTER_KEY, state.timeFilter);
  else localStorage.removeItem(TIME_FILTER_KEY);
  timeFilterEl.classList.toggle('has-value', !!state.timeFilter);
  renderAll();
});
timeFilterEl.classList.toggle('has-value', !!state.timeFilter);

const searchToggleEl = document.getElementById('search-toggle');
searchToggleEl.addEventListener('click', () => {
  document.body.classList.add('search-open');
  searchEl.focus();
});

const searchEl = document.getElementById('search');
let searchTimer = null;
searchEl.addEventListener('input', e => {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => {
    state.search = v;
    renderAll();
  }, 120);
});
searchEl.addEventListener('blur', () => {
  if (!searchEl.value) document.body.classList.remove('search-open');
});
searchEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    searchEl.value = '';
    state.search = '';
    renderAll();
    document.body.classList.remove('search-open');
    searchEl.blur();
  }
});

// All / Bookmarks toggle between three views (see VIEWS above): the default
// three columns, a single combined "All" feed, or the columns filtered to
// saved items. Clicking the active button returns to the default columns.
const bookmarksViewBtn = document.getElementById('bookmarks-view-toggle');
const allViewBtn = document.getElementById('all-view-toggle');

function applyViewToggle() {
  allViewBtn.classList.toggle('active', state.view === 'all');
  allViewBtn.setAttribute('aria-pressed', String(state.view === 'all'));
  bookmarksViewBtn.classList.toggle('active', state.view === 'saved');
  bookmarksViewBtn.setAttribute('aria-pressed', String(state.view === 'saved'));
}

function setView(view) {
  state.view = state.view === view ? 'columns' : view;
  if (state.view === 'columns') localStorage.removeItem(VIEW_KEY);
  else localStorage.setItem(VIEW_KEY, state.view);
  applyViewToggle();
  renderAll();
}

allViewBtn.addEventListener('click', () => setView('all'));
bookmarksViewBtn.addEventListener('click', () => setView('saved'));
applyViewToggle();

// --- auth + bookmarks UI ---------------------------------------------------

const signinModal = document.getElementById('signin-modal');
const signinForm = document.getElementById('signin-form');
const signinEmail = document.getElementById('signin-email');
const signinSubmit = document.getElementById('signin-submit');
const signinMessage = document.getElementById('signin-message');

function openSignIn() {
  signinMessage.hidden = true;
  signinMessage.textContent = '';
  signinForm.hidden = false;
  signinModal.hidden = false;
  setTimeout(() => signinEmail.focus(), 0);
}

function closeSignIn() {
  signinModal.hidden = true;
}

signinModal.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) closeSignIn();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !signinModal.hidden) closeSignIn();
});

document.getElementById('signin-open').addEventListener('click', openSignIn);
document.getElementById('signout').addEventListener('click', () => {
  window.Auth.signOut();
});

signinForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = signinEmail.value.trim();
  if (!email) return;
  signinSubmit.disabled = true;
  signinMessage.hidden = true;
  try {
    await window.Auth.requestLink(email);
    signinForm.hidden = true;
    signinMessage.hidden = false;
    signinMessage.textContent = `Check ${email} for a sign-in link. It expires in 10 minutes.`;
  } catch (err) {
    signinMessage.hidden = false;
    signinMessage.textContent = `Couldn't send link: ${err.message}`;
  } finally {
    setTimeout(() => { signinSubmit.disabled = false; }, 30_000);
  }
});

function renderAuthStatus() {
  const signedIn = window.Auth.isSignedIn();
  const session = window.Auth.getSession();
  document.getElementById('signin-open').hidden = signedIn;
  const wrap = document.querySelector('.auth-signed-in');
  wrap.hidden = !signedIn;
  document.getElementById('auth-email').textContent = session?.email || '';
}

window.Auth.subscribe(() => {
  renderAuthStatus();
  renderAll();
  if (!signinModal.hidden && window.Auth.isSignedIn()) closeSignIn();
});
window.Bookmarks.subscribe(renderAll);
renderAuthStatus();

(async () => {
  await window.Auth.init();
  if (window.Auth.isSignedIn()) {
    window.Bookmarks.loadServer();
  }
  loadAll();
})();
