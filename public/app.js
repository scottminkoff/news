const KEYWORDS = ['Budget', 'Charter', 'Districting', 'Hochul', 'Kingston', 'New Paltz', 'Ulster County'];

const SOURCE_COLORS = {
  'NYT':                  '#586994',
  'New Yorker':           '#7D869C',
  'Axios':                '#A2ABAB',
  'TPM':                  '#B4C4AE',
  'Capital Confidential': '#E5E8B6',
  'Politico':             '#967D69',
  'Times Union':          '#92B9BD',
  'Hudson Valley One':    '#A8D4AD',
  'City & State':         '#F2F79E',
  'NY State of Politics': '#7ADFBB',
  'The Atlantic':         '#BEB0A7',
  'Daily Freeman':        '#C8A8C0',
  'Times of Israel':      '#D4B896',
  'The Forward':          '#9FB5C3',
  'NYT World':            '#6B7BA8',
  'WSJ World':            '#C9B6A8',
  'Jonah Goldberg':       '#BFA890',
  'Boiling Frogs':        '#9DB58E',
  'Jamelle Bouie':        '#9D90BC',
  'Josh Marshall':        '#8FA8C2',
  'NYT Sunday Opinion':   '#7E8FB5',
};

function pickTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#000' : '#fff';
}
const TIERS = ['national', 'state', 'local', 'opinion', 'israel', 'foreign'];
const FILTER_KEY = 'news.sourceFilter';
const TIME_FILTER_KEY = 'news.timeFilter';
const ACTIVE_TIER_KEY = 'news.activeTier';
const VISITED_KEY = 'news.visited';
const VISITED_LIMIT = 1000;

const state = {
  tiers: {},
  filter: localStorage.getItem(FILTER_KEY) || '',
  timeFilter: localStorage.getItem(TIME_FILTER_KEY) || '',
  search: '',
  activeTier: TIERS.includes(localStorage.getItem(ACTIVE_TIER_KEY)) ? localStorage.getItem(ACTIVE_TIER_KEY) : 'national',
  visited: loadVisited(),
};

function renderKeywordChips() {
  const container = document.querySelector('.keyword-chips');
  container.innerHTML = KEYWORDS
    .map(k => `<button type="button" data-keyword="${escapeAttr(k)}">${escapeHtml(k)}</button>`)
    .join('');
  for (const btn of container.querySelectorAll('button')) {
    btn.addEventListener('click', () => {
      const kw = btn.dataset.keyword;
      const isActive = state.search.toLowerCase() === kw.toLowerCase();
      state.search = isActive ? '' : kw;
      searchEl.value = state.search;
      updateChipsActiveState();
      applyFilter();
    });
  }
}

function updateChipsActiveState() {
  const cur = state.search.toLowerCase();
  for (const btn of document.querySelectorAll('.keyword-chips button')) {
    btn.classList.toggle('active', btn.dataset.keyword.toLowerCase() === cur);
  }
}

function applyActiveTier() {
  for (const tier of TIERS) {
    const section = document.querySelector(`[data-tier="${tier}"]`);
    section.classList.toggle('mobile-hidden', tier !== state.activeTier);
  }
  for (const btn of document.querySelectorAll('.tier-tabs button')) {
    btn.classList.toggle('active', btn.dataset.tierTab === state.activeTier);
  }
}

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

async function loadTier(tier) {
  try {
    const res = await fetch(`./data/${tier}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.tiers[tier] = await res.json();
    return state.tiers[tier].fetched;
  } catch (err) {
    state.tiers[tier] = { error: err.message, items: [], sources: [] };
    return null;
  }
}

function renderTier(tier) {
  const section = document.querySelector(`[data-tier="${tier}"]`);
  const container = section.querySelector('.feed');
  const data = state.tiers[tier];
  container.innerHTML = '';

  if (data.error) {
    container.innerHTML = `<div class="error">Failed to load: ${escapeHtml(data.error)}</div>`;
    section.classList.remove('hidden');
    return;
  }

  const items = filterItems(data.items);
  const filtersActive = state.filter || state.timeFilter || state.search;

  if (filtersActive && items.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  if (!items.length) {
    container.innerHTML = '<div class="empty">No items.</div>';
  } else {
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
  }

  if (!filtersActive) {
    const failed = (data.sources || []).filter(s => !s.ok);
    if (failed.length) {
      const status = document.createElement('div');
      status.className = 'feed-status';
      status.innerHTML = `<span class="failed">Failed: ${failed.map(f => escapeHtml(f.name)).join(', ')}</span>`;
      container.appendChild(status);
    }
  }
}

function filterItems(items) {
  const cutoff = state.timeFilter
    ? Date.now() - parseInt(state.timeFilter, 10) * 1000
    : null;
  const q = state.search.trim().toLowerCase();
  return items.filter(item => {
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

function renderCard(item) {
  const safeLink = safeUrl(item.link, ['http:', 'https:']);
  const safeImage = safeUrl(item.image, ['http:', 'https:']);
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

  a.innerHTML = `
    <div class="card-body">
      <h3>${escapeHtml(item.title)}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      <div class="card-meta">
        <span class="source"${sourceStyleAttr(item.source)}>${escapeHtml(item.source)}</span>
        <span>${ago}</span>
      </div>
    </div>`;

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
    a.prepend(img);
  }
  return a;
}

function populateFilter() {
  const select = document.getElementById('source-filter');
  const names = new Set();
  for (const tier of TIERS) {
    for (const s of state.tiers[tier]?.sources || []) names.add(s.name);
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="">All sources</option>' +
    sorted.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');
  if (state.filter && sorted.includes(state.filter)) {
    select.value = state.filter;
  } else if (state.filter) {
    state.filter = '';
    localStorage.removeItem(FILTER_KEY);
  }
}

function applyFilter() {
  for (const tier of TIERS) renderTier(tier);
}

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
  const bg = SOURCE_COLORS[name];
  if (!bg) return '';
  return ` style="background:${bg};color:${pickTextColor(bg)}"`;
}

async function loadAll() {
  const btn = document.getElementById('refresh');
  const updated = document.getElementById('updated');
  btn.disabled = true;
  updated.textContent = 'Updating…';

  for (const tier of TIERS) {
    const section = document.querySelector(`[data-tier="${tier}"]`);
    section.querySelector('.feed').innerHTML = '<div class="loading">Loading…</div>';
  }

  const fetchedTimes = await Promise.all(TIERS.map(loadTier));
  populateFilter();
  applyFilter();

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

document.getElementById('refresh').addEventListener('click', () => {
  clearTimeout(searchTimer);
  state.search = '';
  searchEl.value = '';
  state.timeFilter = '';
  timeFilterEl.value = '';
  localStorage.removeItem(TIME_FILTER_KEY);
  state.filter = '';
  document.getElementById('source-filter').value = '';
  localStorage.removeItem(FILTER_KEY);
  updateChipsActiveState();
  loadAll();
});

document.getElementById('source-filter').addEventListener('change', e => {
  state.filter = e.target.value;
  if (state.filter) localStorage.setItem(FILTER_KEY, state.filter);
  else localStorage.removeItem(FILTER_KEY);
  applyFilter();
});

const timeFilterEl = document.getElementById('time-filter');
timeFilterEl.value = state.timeFilter;
timeFilterEl.addEventListener('change', e => {
  state.timeFilter = e.target.value;
  if (state.timeFilter) localStorage.setItem(TIME_FILTER_KEY, state.timeFilter);
  else localStorage.removeItem(TIME_FILTER_KEY);
  applyFilter();
});

const searchEl = document.getElementById('search');
let searchTimer = null;
searchEl.addEventListener('input', e => {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => {
    state.search = v;
    updateChipsActiveState();
    applyFilter();
  }, 120);
});

renderKeywordChips();
updateChipsActiveState();

for (const btn of document.querySelectorAll('.tier-tabs button')) {
  btn.addEventListener('click', () => {
    state.activeTier = btn.dataset.tierTab;
    localStorage.setItem(ACTIVE_TIER_KEY, state.activeTier);
    applyActiveTier();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
applyActiveTier();

loadAll();
