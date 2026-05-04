import { XMLParser } from 'fast-xml-parser';
import { FEEDS } from './feeds.js';

const CACHE_TTL = 900;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: true,
});

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

function parseFeed(xml, feed) {
  const data = parser.parse(xml);
  const channel = data?.rss?.channel;
  const atom = data?.feed;
  const rawItems = channel?.item ?? atom?.entry ?? [];
  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
  return arr.map(item => normalize(item, feed)).filter(i => i.title && i.link);
}

function normalize(item, feed) {
  const title = textOf(item.title);
  const link = linkOf(item);
  const pubRaw = item.pubDate ?? item.published ?? item.updated ?? item['dc:date'];
  let pubDate = null;
  if (pubRaw) {
    const d = new Date(textOf(pubRaw));
    if (!isNaN(d.getTime())) pubDate = d.toISOString();
  }
  const rawDesc = item.description ?? item.summary ?? item['content:encoded'] ?? '';
  const description = stripHtml(textOf(rawDesc)).slice(0, 280);
  const image = extractImage(item);
  return {
    source: feed.name,
    sourceId: feed.id,
    title: cleanText(title),
    link,
    pubDate,
    description,
    image,
  };
}

function textOf(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v['#text'] ?? v['#cdata'] ?? '';
  return String(v);
}

function linkOf(item) {
  const l = item.link;
  if (!l) return textOf(item.guid);
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) {
    const alt = l.find(x => !x['@_rel'] || x['@_rel'] === 'alternate');
    return alt?.['@_href'] || l[0]?.['@_href'] || '';
  }
  return l['@_href'] || textOf(l);
}

function extractImage(item) {
  const media = item['media:content'] ?? item['media:thumbnail'];
  if (media) {
    const m = Array.isArray(media) ? media[0] : media;
    if (m?.['@_url']) return m['@_url'];
  }
  const enc = item.enclosure;
  if (enc) {
    const e = Array.isArray(enc) ? enc[0] : enc;
    if (e?.['@_type']?.startsWith('image/') && e['@_url']) return e['@_url'];
  }
  const html = textOf(item['content:encoded']) || textOf(item.description) || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanText(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    },
  });
}
