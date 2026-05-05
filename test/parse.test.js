import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/parse.js';

const FEED = { id: 'fixture', name: 'Fixture' };

test('RSS 2.0 with media:content', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>Example</title>
        <item>
          <title>First headline</title>
          <link>https://example.com/a</link>
          <description>A short summary.</description>
          <pubDate>Mon, 04 May 2026 12:00:00 GMT</pubDate>
          <media:content url="https://img.example.com/a.jpg" />
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'First headline');
  assert.equal(items[0].link, 'https://example.com/a');
  assert.equal(items[0].description, 'A short summary.');
  assert.equal(items[0].image, 'https://img.example.com/a.jpg');
  assert.equal(items[0].source, 'Fixture');
  assert.match(items[0].pubDate, /^2026-05-04T12:00:00/);
});

test('RSS 2.0 with enclosure image', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Enclosure item</title>
          <link>https://example.com/b</link>
          <enclosure url="https://img.example.com/b.png" type="image/png" length="12345"/>
          <pubDate>Tue, 05 May 2026 09:30:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items[0].image, 'https://img.example.com/b.png');
});

test('RSS with image extracted from content:encoded HTML', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Inline image</title>
          <link>https://example.com/c</link>
          <description><![CDATA[<p>Some <b>HTML</b> here.</p>]]></description>
          <content:encoded><![CDATA[<p><img src="https://img.example.com/c.jpg" alt=""/>Body text.</p>]]></content:encoded>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items[0].image, 'https://img.example.com/c.jpg');
  assert.equal(items[0].description, 'Some HTML here.');
});

test('Atom feed', () => {
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Example</title>
      <entry>
        <title>Atom headline</title>
        <link href="https://example.com/atom-1" rel="alternate"/>
        <link href="https://example.com/self" rel="self"/>
        <summary>Atom summary text.</summary>
        <published>2026-05-03T08:00:00Z</published>
      </entry>
    </feed>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Atom headline');
  assert.equal(items[0].link, 'https://example.com/atom-1');
  assert.equal(items[0].description, 'Atom summary text.');
  assert.match(items[0].pubDate, /^2026-05-03T08:00:00/);
});

test('Multiple items sorted as parsed', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item><title>One</title><link>https://example.com/1</link><pubDate>Mon, 04 May 2026 12:00:00 GMT</pubDate></item>
        <item><title>Two</title><link>https://example.com/2</link><pubDate>Mon, 04 May 2026 11:00:00 GMT</pubDate></item>
        <item><title>Three</title><link>https://example.com/3</link><pubDate>Mon, 04 May 2026 10:00:00 GMT</pubDate></item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(i => i.title), ['One', 'Two', 'Three']);
});

test('Items without title or link are filtered out', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item><title>Has both</title><link>https://example.com/x</link></item>
        <item><title>No link</title></item>
        <item><link>https://example.com/y</link></item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Has both');
});

test('CDATA-wrapped title and description', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title><![CDATA[Headline with <em>HTML</em> &amp; symbols]]></title>
          <link>https://example.com/cdata</link>
          <description><![CDATA[<p>Paragraph with&nbsp;nbsp.</p>]]></description>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.match(items[0].title, /Headline/);
  assert.equal(items[0].description, 'Paragraph with nbsp.');
});

test('Description is truncated to 280 chars', () => {
  const long = 'x'.repeat(500);
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Long</title>
          <link>https://example.com/long</link>
          <description>${long}</description>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items[0].description.length, 280);
});

test('Numeric and named HTML entities are decoded in title and description', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Sheriff&#8217;s Office &amp; K-9 Unit</title>
          <link>https://example.com/ent</link>
          <description>Q&amp;A &mdash; &ldquo;quoted&rdquo;&hellip;</description>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items[0].title, 'Sheriff’s Office & K-9 Unit');
  assert.equal(items[0].description, 'Q&A — “quoted”…');
});

test('Feed with many entities does not throw expansion-limit error', () => {
  const items = Array.from({ length: 60 }, (_, i) => `
    <item>
      <title>Item &#8217;${i}&#8217; with &amp; &#x2014; &#8220;quotes&#8221; &amp; more &amp; more &amp; more &amp; more &amp; more</title>
      <link>https://example.com/${i}</link>
      <description>Body &amp; ${i} &mdash; &#8217;text&#8217; &amp; entities &amp; more &amp; more &amp; more</description>
    </item>`).join('');
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
  const parsed = parseFeed(xml, FEED);
  assert.equal(parsed.length, 60);
  assert.match(parsed[0].title, /Item ’0’ with & — “quotes”/);
});

test('Title trailing " - <source>" suffix is stripped (Google News bridge)', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Big story breaks today - Times Union</title>
          <link>https://news.google.com/articles/abc</link>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, { id: 'tu_state', name: 'Times Union' });
  assert.equal(items[0].title, 'Big story breaks today');
});

test('Google News-style description with escaped HTML is cleaned, not shown raw', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Epstein survivors testify at NY Capitol - Times Union</title>
          <link>https://news.google.com/articles/abc</link>
          <description>&lt;a href="https://news.google.com/rss/articles/CBMxxx"&gt;Epstein survivors testify at NY Capitol&lt;/a&gt;&amp;nbsp;&amp;nbsp;Times Union</description>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, { id: 'tu_state', name: 'Times Union' });
  assert.equal(items[0].title, 'Epstein survivors testify at NY Capitol');
  assert.equal(items[0].description, '');
});

test('Description identical to title is suppressed', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Same headline</title>
          <link>https://example.com/dup</link>
          <description>Same headline</description>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items[0].description, '');
});

test('Real article description is preserved', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Headline</title>
          <link>https://example.com/real</link>
          <description>This is a longer summary that explains the article in more detail than the headline does.</description>
        </item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.match(items[0].description, /longer summary/);
});

test('Index/archive pages with " - Page N" titles are filtered out', () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item><title>Real article headline</title><link>https://example.com/a</link></item>
        <item><title>New York - Page 5</title><link>https://example.com/p5</link></item>
        <item><title>New York Government - Page 3</title><link>https://example.com/p3</link></item>
        <item><title>Another real story</title><link>https://example.com/b</link></item>
      </channel>
    </rss>`;
  const items = parseFeed(xml, FEED);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(i => i.title), ['Real article headline', 'Another real story']);
});

test('Empty channel returns empty array', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
  const items = parseFeed(xml, FEED);
  assert.deepEqual(items, []);
});
