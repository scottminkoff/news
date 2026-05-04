import { FEEDS } from './feeds.js';
import { parseFeed } from './parse.js';

const CACHE_TTL = 900;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/(national|state|local)$/);
    if (match) return handleTier(match[1], env);
    return env.ASSETS.fetch(request);
  },
};

async function handleTier(tier, env) {
  const feeds = FEEDS[tier];
  const settled = await Promise.allSettled(feeds.map(f => fetchFeed(f, env)));
  const items = [];
  const sources = [];
  settled.forEach((r, i) => {
    const feed = feeds[i];
    if (r.status === 'fulfilled') {
      sources.push({ id: feed.id, name: feed.name, ok: true, count: r.value.length });
      items.push(...r.value);
    } else {
      sources.push({ id: feed.id, name: feed.name, ok: false, error: String(r.reason).slice(0, 200) });
    }
  });
  items.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  return json({ tier, fetched: new Date().toISOString(), sources, items });
}

async function fetchFeed(feed, env) {
  const overrideKey = `FEED_URL_${feed.id.toUpperCase()}`;
  const url = (env && env[overrideKey]) || feed.url;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NewsAggregator/1.0 (+https://github.com/scottminkoff/news)' },
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml, feed);
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    },
  });
}
