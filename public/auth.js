window.Auth = (function () {
  const API_BASE = 'https://news-api.sminkoff.workers.dev';
  const SESSION_KEY = 'news:session';
  const listeners = new Set();

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.expiresAt && s.expiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }

  function setSession(s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    notify();
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    notify();
  }

  function isSignedIn() {
    return !!getSession();
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

  async function requestLink(email) {
    const res = await fetch(`${API_BASE}/auth/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`HTTP ${res.status}`);
    }
  }

  async function verifyMagic(token) {
    const res = await fetch(`${API_BASE}/auth/verify?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setSession(data);
    return data;
  }

  async function init() {
    const url = new URL(window.location.href);
    const magic = url.searchParams.get('magic');
    if (!magic) return;
    url.searchParams.delete('magic');
    const cleanSearch = url.searchParams.toString();
    const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '') + url.hash;
    history.replaceState({}, '', cleanUrl);
    try {
      await verifyMagic(magic);
    } catch (err) {
      console.error('magic-link verify failed', err);
    }
  }

  return { API_BASE, getSession, signOut, isSignedIn, subscribe, requestLink, verifyMagic, init };
})();
