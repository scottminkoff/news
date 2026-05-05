const TIERS = ['national', 'state', 'local'];
const FILTER_KEY = 'news.sourceFilter';
const TIME_FILTER_KEY = 'news.timeFilter';

const state = {
  tiers: {},
  filter: localStorage.getItem(FILTER_KEY) || '',
  timeFilter: localStorage.getItem(TIME_FILTER_KEY) || '',
};

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
  const filtersActive = state.filter || state.timeFilter;

  if (filtersActive && items.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  if (!items.length) {
    container.innerHTML = '<div class="empty">No items.</div>';
  } else {
    const frag = document.createDocumentFragment();
    for (const item of items) frag.appendChild(renderCard(item));
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
  return items.filter(item => {
    if (state.filter && item.source !== state.filter) return false;
    if (cutoff !== null) {
      if (!item.pubDate) return false;
      const t = new Date(item.pubDate).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
    }
    return true;
  });
}

function renderCard(item) {
  const a = document.createElement('a');
  a.className = 'card' + (item.image ? '' : ' no-image');
  a.href = item.link;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  const ago = item.pubDate ? timeAgo(new Date(item.pubDate)) : '';
  const imgHtml = item.image
    ? `<img class="thumb" src="${escapeAttr(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove(); this.parentElement.classList.add('no-image');">`
    : '';

  a.innerHTML = `
    ${imgHtml}
    <div class="card-body">
      <h3>${escapeHtml(item.title)}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      <div class="card-meta">
        <span class="source">${escapeHtml(item.source)}</span>
        <span>${ago}</span>
      </div>
    </div>`;
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
    updated.textContent = `Updated ${timeAgo(latest)}`;
  } else {
    updated.textContent = '';
  }
  btn.disabled = false;
}

document.getElementById('refresh').addEventListener('click', loadAll);
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

loadAll();
