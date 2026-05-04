import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDS } from '../src/feeds.js';
import { parseFeed } from '../src/parse.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'public', 'data');
const FETCH_TIMEOUT_MS = 20_000;

async function fetchFeed(feed) {
  const overrideKey = `FEED_URL_${feed.id.toUpperCase()}`;
  const url = process.env[overrideKey] || feed.url;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NewsAggregator/1.0 (+https://github.com/scottminkoff/news)' },
      signal: ac.signal,
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
  const items = [];
  const sources = [];
  settled.forEach((r, i) => {
    const feed = feeds[i];
    if (r.status === 'fulfilled') {
      sources.push({ id: feed.id, name: feed.name, ok: true, count: r.value.length });
      items.push(...r.value);
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
