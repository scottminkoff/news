const TIERS = ['national', 'state', 'local'];

async function loadTier(tier) {
  const section = document.querySelector(`[data-tier="${tier}"]`);
  const container = section.querySelector('.feed');
  container.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const res = await fetch(`/api/${tier}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    container.innerHTML = '';
    if (!data.items.length) {
      container.innerHTML = '<div class="empty">No items.</div>';
    } else {
      const frag = document.createDocumentFragment();
      for (const item of data.items) frag.appendChild(renderCard(item));
      container.appendChild(frag);
    }

    const failed = (data.sources || []).filter(s => !s.ok);
    if (failed.length) {
      const status = document.createElement('div');
      status.className = 'feed-status';
      status.innerHTML = `<span class="failed">Failed: ${failed.map(f => escapeHtml(f.name)).join(', ')}</span>`;
      container.appendChild(status);
    }

    return data.fetched;
  } catch (err) {
    container.innerHTML = `<div class="error">Failed to load: ${escapeHtml(err.message)}</div>`;
    return null;
  }
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
  const fetchedTimes = await Promise.all(TIERS.map(loadTier));
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
loadAll();
