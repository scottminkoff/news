window.Bookmarks = (function () {
  const API_BASE = window.Auth.API_BASE;
  const CACHE_KEY = 'news:bookmarks';
  const listeners = new Set();
  let items = [];
  let ids = new Set();

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      items = Array.isArray(arr) ? arr : [];
    } catch {
      items = [];
    }
    ids = new Set(items.map(it => it.id));
  }

  function saveCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  }

  function clearCache() {
    items = [];
    ids = new Set();
    localStorage.removeItem(CACHE_KEY);
    notify();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    for (const fn of listeners) {
      try { fn(); } catch (err) { console.error(err); }
    }
  }

  function isBookmarked(id) { return ids.has(id); }
  function getList() { return items.slice(); }
  function idFor(article) { return article?.link || article?.id || ''; }

  function authHeaders() {
    const s = window.Auth.getSession();
    if (!s) return null;
    return { Authorization: `Bearer ${s.token}` };
  }

  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    ids = new Set(items.map(it => it.id));
    saveCache();
    notify();
  }

  async function loadServer() {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/bookmarks`, { headers });
      if (res.status === 401) {
        window.Auth.signOut();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('bookmarks load failed', err);
    }
  }

  async function add(article) {
    const headers = authHeaders();
    if (!headers) throw new Error('not signed in');
    const id = idFor(article);
    if (!id) return;
    if (ids.has(id)) return;
    const item = {
      id,
      url: article.link || '',
      title: article.title || '',
      source: article.source || '',
      savedAt: Date.now(),
    };
    const prev = items.slice();
    setItems([item, ...items]);
    try {
      const res = await fetch(`${API_BASE}/bookmarks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.status === 409) {
        window.showToast?.('Bookmark limit reached. Remove some saved items first.');
        setItems(prev);
        return;
      }
      if (res.status === 401) {
        window.Auth.signOut();
        setItems(prev);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('bookmark add failed', err);
      loadServer();
    }
  }

  async function remove(id) {
    const headers = authHeaders();
    if (!headers) throw new Error('not signed in');
    if (!ids.has(id)) return;
    const prev = items.slice();
    setItems(items.filter(it => it.id !== id));
    try {
      const res = await fetch(`${API_BASE}/bookmarks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 401) {
        window.Auth.signOut();
        setItems(prev);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('bookmark remove failed', err);
      loadServer();
    }
  }

  async function toggle(article) {
    const id = idFor(article);
    if (!id) return;
    if (ids.has(id)) await remove(id);
    else await add(article);
  }

  loadCache();
  window.Auth.subscribe(() => {
    if (!window.Auth.isSignedIn()) clearCache();
    else loadServer();
  });

  return {
    isBookmarked,
    getList,
    idFor,
    toggle,
    add,
    remove,
    loadServer,
    subscribe,
  };
})();
