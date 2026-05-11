import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDS } from '../src/feeds.js';
import { parseFeed } from '../src/parse.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'public', 'data');
const FETCH_TIMEOUT_MS = 20_000;
const MAX_ITEM_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isWithinMaxAge(item, cutoff) {
  if (!item.pubDate) return true;
  const t = new Date(item.pubDate).getTime();
  return !Number.isFinite(t) || t >= cutoff;
}

async function fetchFeed(feed) {
  const overrideKey = `FEED_URL_${feed.id.toUpperCase()}`;
  const url = process.env[overrideKey] || feed.url;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: ac.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, feed);
  } finally {
    clearTimeout(timer);
  }
}

async function buildTier(tier, feeds) {
  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const cutoff = Date.now() - MAX_ITEM_AGE_MS;
  const items = [];
  const sources = [];
  settled.forEach((r, i) => {
    const feed = feeds[i];
    if (r.status === 'fulfilled') {
      const fresh = r.value.filter(item => isWithinMaxAge(item, cutoff));
      const count = fresh.length;
      sources.push({ id: feed.id, name: feed.name, ok: true, count });
      items.push(...fresh);
      if (count === 0) console.warn(`[${tier}] ${feed.id}: 0 items parsed`);
    } else {
      const err = String(r.reason).slice(0, 200);
      sources.push({ id: feed.id, name: feed.name, ok: false, error: err });
      console.error(`[${tier}] ${feed.id}: ${err}`);
    }
  });
  items.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  return { tier, fetched: new Date().toISOString(), sources, items };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const [tier, feeds] of Object.entries(FEEDS)) {
    const data = await buildTier(tier, feeds);
    const path = join(OUT_DIR, `${tier}.json`);
    await writeFile(path, JSON.stringify(data));
    const ok = data.sources.filter(s => s.ok).length;
    console.log(`✓ ${tier}: ${data.items.length} items, ${ok}/${data.sources.length} sources`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
