const KEYWORDS = ['Budget', 'Charter', 'Districting', 'Hochul', 'Kingston', 'New Paltz', 'Tax', 'Ulster County'];

const SOURCE_COLORS = {
  'NYT':                  { bg: '#544F4F', text: '#FFFFFF' },
  'New Yorker':           { bg: '#FFFFFF', text: '#000000' },
  'Axios':                { bg: '#4F69DB', text: '#FFFFFF' },
  'TPM':                  { bg: '#961515', text: '#FFFFFF' },
  'Capital Confidential': { bg: '#00497e', text: '#FFFFFF' },
  'Politico':             { bg: '#d71920', text: '#FFFFFF' },
  'Times Union':          { bg: '#53bce3', text: '#000000' },
  'Hudson Valley One':    { bg: '#ff6600', text: '#FFFFFF' },
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
const TIERS = ['national', 'state', 'local', 'opinion', 'israel', 'foreign'];
const ALL_TIER = 'all';
const SAVED_TIER = 'saved';
const RENDER_TIERS = [ALL_TIER, SAVED_TIER, ...TIERS];
const FILTER_KEY = 'news.sourceFilter';
const TIME_FILTER_KEY = 'news.timeFilter';
const ACTIVE_TIER_KEY = 'news.activeTier';
const VISITED_KEY = 'news.visited';
const BOOKMARKS_ONLY_KEY = 'news.bookmarksOnly';
const ALL_ONLY_KEY = 'news.allOnly';
const VISITED_LIMIT = 1000;

const state = {
  tiers: {},
  allData: null,
  filter: localStorage.getItem(FILTER_KEY) || '',
  timeFilter: localStorage.getItem(TIME_FILTER_KEY) || '',
  search: '',
  activeTier: RENDER_TIERS.includes(localStorage.getItem(ACTIVE_TIER_KEY)) ? localStorage.getItem(ACTIVE_TIER_KEY) : ALL_TIER,
  visited: loadVisited(),
  bookmarksOnly: localStorage.getItem(BOOKMARKS_ONLY_KEY) === '1',
  allOnly: localStorage.getItem(ALL_ONLY_KEY) === '1',
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
  for (const tier of RENDER_TIERS) {
    const section = document.querySelector(`[data-tier="${tier}"]`);
    if (section) section.classList.toggle('mobile-hidden', tier !== state.activeTier);
  }
  for (const btn of document.querySelectorAll('.tier-tabs button')) {
    btn.classList.toggle('active', btn.dataset.tierTab === state.activeTier);
  }
}

// --- cross-source story clustering (used by the "All" view) ---
const CLUSTER_SIMILARITY = 0.6;
const CLUSTER_TIME_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const CLUSTER_STOPWORDS = new Set(
  ('the a an of in on to for and or but at by with as is are was were be been from ' +
   'that this it its he she his her they their them you your we our us new says said ' +
   'report over after before amid into out about how why what when who will would')
    .split(' '),
);

function titleTokens(title) {
  const set = new Set();
  for (const w of String(title || '')
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')) {
    if (w.length > 2 && !CLUSTER_STOPWORDS.has(w)) set.add(w);
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const t of small) if (large.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function itemTime(item) {
  if (!item.pubDate) return NaN;
  const t = new Date(item.pubDate).getTime();
  return Number.isFinite(t) ? t : NaN;
}

// Greedy clustering: items must be pre-sorted newest-first. Each item joins
// the most similar existing cluster above CLUSTER_SIMILARITY, else starts its
// own. Comparison anchors to each cluster's representative (its newest item)
// to keep merges conservative; an inverted token index keeps lookups cheap.
function clusterItems(items) {
  const tokens = items.map(it => titleTokens(it.title));
  const times = items.map(itemTime);
  const tokenIndex = new Map();   // token -> Set of cluster indices
  const clusters = [];            // { members: [i...], repTokens, repTime }

  for (let i = 0; i < items.length; i++) {
    const tk = tokens[i];
    const candidates = new Set();
    for (const tok of tk) {
      const bucket = tokenIndex.get(tok);
      if (bucket) for (const c of bucket) candidates.add(c);
    }
    let best = -1;
    let bestScore = CLUSTER_SIMILARITY;
    for (const c of candidates) {
      const cl = clusters[c];
      if (Number.isFinite(cl.repTime) && Number.isFinite(times[i]) &&
          cl.repTime - times[i] > CLUSTER_TIME_WINDOW_MS) continue;
      const score = jaccard(tk, cl.repTokens);
      if (score >= bestScore) { bestScore = score; best = c; }
    }
    let cIdx;
    if (best >= 0) {
      clusters[best].members.push(i);
      cIdx = best;
    } else {
      cIdx = clusters.length;
      clusters.push({ members: [i], repTokens: tk, repTime: times[i] });
    }
    for (const tok of tk) {
      let bucket = tokenIndex.get(tok);
      if (!bucket) tokenIndex.set(tok, bucket = new Set());
      bucket.add(cIdx);
    }
  }
  return clusters.map(cl => cl.members.map(i => items[i]));
}

function aggregatedAll() {
  const items = [];
  const sources = [];
  const seen = new Set();
  for (const t of TIERS) {
    const d = state.tiers[t];
    if (!d) continue;
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
  const clustered = clusterItems(items).map(group => {
    const primary = group[0];
    if (group.length === 1) return primary;
    const extra = [];
    const seenSrc = new Set([primary.source]);
    for (let k = 1; k < group.length; k++) {
      const s = group[k].source;
      if (s && !seenSrc.has(s)) { seenSrc.add(s); extra.push(s); }
    }
    return extra.length ? { ...primary, clusterSources: extra } : primary;
  });
  return { items: clustered, sources };
}

function aggregatedSaved() {
  const byId = new Map();
  for (const t of TIERS) {
    for (const it of state.tiers[t]?.items || []) {
      byId.set(window.Bookmarks.idFor(it), it);
    }
  }
  const items = window.Bookmarks.getList().map(b => byId.get(b.id) || {
    title: b.title || '(saved item)',
    link: b.url || '',
    source: b.source || '',
    pubDate: b.savedAt ? new Date(b.savedAt).toISOString() : null,
    description: '',
    image: null,
  });
  return { items, sources: [] };
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

function renderTier(tier) {
  const section = document.querySelector(`[data-tier="${tier}"]`);
  if (!section) return;
  const container = section.querySelector('.feed');
  let data;
  if (tier === ALL_TIER) data = state.allData || aggregatedAll();
  else if (tier === SAVED_TIER) data = aggregatedSaved();
  else data = state.tiers[tier];
  if (!data) return;
  container.innerHTML = '';

  if (data.error && !(data.items && data.items.length)) {
    container.innerHTML = `<div class="error">Failed to load: ${escapeHtml(data.error)}</div>`;
    section.classList.remove('hidden');
    return;
  }

  const items = filterItems(data.items, tier);
  const filtersActive = state.filter || state.timeFilter || state.search;

  if (filtersActive && items.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  if (!items.length) {
    if (tier === SAVED_TIER) {
      container.innerHTML = window.Auth.isSignedIn()
        ? '<div class="empty">No bookmarks yet. Tap the bookmark icon on a card to save it.</div>'
        : '<div class="empty">Sign in to save and view bookmarks.</div>';
    } else {
      container.innerHTML = '<div class="empty">No items.</div>';
    }
  } else {
    const frag = document.createDocumentFragment();
    let lastBucket = null;
    const skipDividers = tier === SAVED_TIER;
    for (const item of items) {
      if (!skipDividers) {
        const bucket = bucketOf(item.pubDate);
        if (bucket !== lastBucket) {
          frag.appendChild(renderDivider(BUCKET_LABELS[bucket]));
          lastBucket = bucket;
        }
      }
      frag.appendChild(renderCard(item));
    }
    container.appendChild(frag);
  }

  if (!filtersActive) {
    const notes = [];
    if (data.error) {
      notes.push(`<span class="failed">Couldn't refresh: ${escapeHtml(data.error)}</span>`);
    }
    const failed = (data.sources || []).filter(s => !s.ok);
    if (failed.length) {
      notes.push(`<span class="failed">Failed: ${failed.map(f => escapeHtml(f.name)).join(', ')}</span>`);
    }
    if (notes.length) {
      const status = document.createElement('div');
      status.className = 'feed-status';
      status.innerHTML = notes.join(' · ');
      container.appendChild(status);
    }
  }
}

function filterItems(items, tier) {
  const skipSourceAndTime = tier === SAVED_TIER;
  const cutoff = !skipSourceAndTime && state.timeFilter
    ? Date.now() - parseInt(state.timeFilter, 10) * 1000
    : null;
  const q = state.search.trim().toLowerCase();
  return items.filter(item => {
    if (!skipSourceAndTime && state.filter &&
        item.source !== state.filter &&
        !(item.clusterSources && item.clusterSources.includes(state.filter))) return false;
    if (cutoff !== null) {
      if (!item.pubDate) return false;
      const t = new Date(item.pubDate).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
    }
    if (q) {
      const hay = `${item.title} ${item.description || ''} ${item.source} ${(item.clusterSources || []).join(' ')}`.toLowerCase();
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
  const extraChips = (item.clusterSources || [])
    .map(s => `<span class="source source-extra"${sourceStyleAttr(s)}>${escapeHtml(s)}</span>`)
    .join('');

  a.innerHTML = `
    <div class="card-body">
      <h3>${escapeHtml(item.title)}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      <div class="card-meta">
        <span class="card-sources">
          <span class="source"${sourceStyleAttr(item.source)}>${escapeHtml(item.source)}</span>
          ${extraChips}
        </span>
        <span class="card-time"${pubAttr}>${ago}</span>
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
  a.appendChild(bm);

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
  select.classList.toggle('has-value', !!state.filter);
}

function applyFilter() {
  for (const tier of RENDER_TIERS) renderTier(tier);
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
  const curated = SOURCE_COLORS[name];
  const bg = curated?.bg || hashSourceColor(name);
  const text = curated?.text || pickTextColor(bg);
  return ` style="background:${bg};color:${text}"`;
}

function hashSourceColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const r = 0x80 + (Math.abs(h)       % 0x60);
  const g = 0x80 + (Math.abs(h >> 8)  % 0x60);
  const b = 0x80 + (Math.abs(h >> 16) % 0x60);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

async function loadAll() {
  const btn = document.getElementById('refresh');
  const updated = document.getElementById('updated');
  btn.disabled = true;
  updated.textContent = 'Updating…';

  for (const tier of RENDER_TIERS) {
    const section = document.querySelector(`[data-tier="${tier}"]`);
    if (section) section.querySelector('.feed').innerHTML = '<div class="loading">Loading…</div>';
  }

  const fetchedTimes = await Promise.all(TIERS.map(loadTier));
  state.allData = aggregatedAll();
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
  timeFilterEl.classList.remove('has-value');
  localStorage.removeItem(TIME_FILTER_KEY);
  state.filter = '';
  sourceFilterEl.value = '';
  sourceFilterEl.classList.remove('has-value');
  localStorage.removeItem(FILTER_KEY);
  document.body.classList.remove('search-open');
  updateChipsActiveState();
  loadAll();
});

const sourceFilterEl = document.getElementById('source-filter');
sourceFilterEl.addEventListener('change', e => {
  state.filter = e.target.value;
  if (state.filter) localStorage.setItem(FILTER_KEY, state.filter);
  else localStorage.removeItem(FILTER_KEY);
  sourceFilterEl.classList.toggle('has-value', !!state.filter);
  applyFilter();
});
sourceFilterEl.classList.toggle('has-value', !!state.filter);

const timeFilterEl = document.getElementById('time-filter');
timeFilterEl.value = state.timeFilter;
timeFilterEl.addEventListener('change', e => {
  state.timeFilter = e.target.value;
  if (state.timeFilter) localStorage.setItem(TIME_FILTER_KEY, state.timeFilter);
  else localStorage.removeItem(TIME_FILTER_KEY);
  timeFilterEl.classList.toggle('has-value', !!state.timeFilter);
  applyFilter();
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
    updateChipsActiveState();
    applyFilter();
  }, 120);
});
searchEl.addEventListener('blur', () => {
  if (!searchEl.value) document.body.classList.remove('search-open');
});
searchEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    searchEl.value = '';
    state.search = '';
    updateChipsActiveState();
    applyFilter();
    document.body.classList.remove('search-open');
    searchEl.blur();
  }
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

// --- auth + bookmarks UI ---

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

const bookmarksViewBtn = document.getElementById('bookmarks-view-toggle');
const allViewBtn = document.getElementById('all-view-toggle');
function applyBookmarksView() {
  document.body.classList.toggle('bookmarks-only', state.bookmarksOnly);
  bookmarksViewBtn.classList.toggle('active', state.bookmarksOnly);
  bookmarksViewBtn.setAttribute('aria-pressed', String(state.bookmarksOnly));
}
function applyAllView() {
  document.body.classList.toggle('all-only', state.allOnly);
  allViewBtn.classList.toggle('active', state.allOnly);
  allViewBtn.setAttribute('aria-pressed', String(state.allOnly));
}
bookmarksViewBtn.addEventListener('click', () => {
  state.bookmarksOnly = !state.bookmarksOnly;
  if (state.bookmarksOnly) {
    localStorage.setItem(BOOKMARKS_ONLY_KEY, '1');
    state.allOnly = false;
    localStorage.removeItem(ALL_ONLY_KEY);
    applyAllView();
  } else {
    localStorage.removeItem(BOOKMARKS_ONLY_KEY);
  }
  applyBookmarksView();
  if (state.bookmarksOnly) renderTier(SAVED_TIER);
});
allViewBtn.addEventListener('click', () => {
  state.allOnly = !state.allOnly;
  if (state.allOnly) {
    localStorage.setItem(ALL_ONLY_KEY, '1');
    state.bookmarksOnly = false;
    localStorage.removeItem(BOOKMARKS_ONLY_KEY);
    applyBookmarksView();
  } else {
    localStorage.removeItem(ALL_ONLY_KEY);
  }
  applyAllView();
  if (state.allOnly) renderTier(ALL_TIER);
});
applyBookmarksView();
applyAllView();

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
  applyFilter();
  if (!signinModal.hidden && window.Auth.isSignedIn()) closeSignIn();
});
window.Bookmarks.subscribe(applyFilter);
renderAuthStatus();

(async () => {
  await window.Auth.init();
  if (window.Auth.isSignedIn()) {
    window.Bookmarks.loadServer();
  }
  loadAll();
})();
