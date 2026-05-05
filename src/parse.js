import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', mdash: '—', ndash: '–',
  copy: '©', reg: '®', trade: '™',
};

function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function parseFeed(xml, feed) {
  const data = parser.parse(xml);
  const channel = data?.rss?.channel;
  const atom = data?.feed;
  const rawItems = channel?.item ?? atom?.entry ?? [];
  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
  return arr.map(item => normalize(item, feed)).filter(i => i.title && i.link);
}

export function normalize(item, feed) {
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
    title: stripSourceSuffix(cleanText(title), feed.name),
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
  const noTags = String(s).replace(/<[^>]+>/g, ' ');
  return decodeEntities(noTags).replace(/\s+/g, ' ').trim();
}

function cleanText(s) {
  return decodeEntities(String(s)).replace(/\s+/g, ' ').trim();
}

function stripSourceSuffix(title, sourceName) {
  const suffix = ` - ${sourceName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trimEnd() : title;
}
