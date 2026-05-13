// Feed registry. To override a URL at runtime (e.g. paid/token feeds),
// set a Worker secret named FEED_URL_<ID_UPPERCASE>, e.g. FEED_URL_TPM.
// Optional `include` field: case-insensitive substring; only items whose
// title, description, or content body contains it are kept (used to
// subset a firehose feed down to a particular column or topic).

export const FEEDS = {
  national: [
    { id: 'nyt_us',       name: 'NYT',          url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml' },
    { id: 'axios',        name: 'Axios',        url: 'https://www.axios.com/feeds/feed.rss' },
    { id: 'politico',     name: 'Politico',     url: 'https://rss.politico.com/playbook.xml' },
    { id: 'atlantic_politics', name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/channel/politics/' },
    { id: 'tpm',          name: 'TPM',          url: 'https://talkingpointsmemo.com/news/atom/3d6ab582-e5e8-45ac-9040-d7bc43abf7bd' },
    { id: 'newyorker',    name: 'New Yorker',   url: 'https://www.newyorker.com/feed/everything' },
  ],
  state: [
    { id: 'tu_state',     name: 'Times Union',           url: 'https://news.google.com/rss/search?q=site%3Atimesunion.com+%22New+York%22+%28Assembly+OR+%22State+Senate%22+OR+Legislature+OR+Governor+OR+%22New+York+Government%22%29&hl=en-US&gl=US&ceid=US%3Aen' },
    { id: 'tu_clark',     name: 'Times Union',           url: 'https://news.google.com/rss/search?q=site%3Atimesunion.com+%22Dan+Clark%22&hl=en-US&gl=US&ceid=US%3Aen' },
    { id: 'capcon',       name: 'Capital Confidential',  url: 'https://capitolconfidential.substack.com/feed' },
    { id: 'cands',        name: 'City & State',          url: 'https://www.cityandstateny.com/rss/all/' },
    { id: 'nysop',        name: 'NY State of Politics',  url: 'https://spectrumlocalnews.com/services/contentfeed.state-of-politics%7cnew-york%7cposts.landing.rss' },
  ],
  local: [
    { id: 'hv1',          name: 'Hudson Valley One',     url: 'https://hudsonvalleyone.com/feed/' },
    { id: 'tu_hv',        name: 'Times Union',           url: 'https://news.google.com/rss/search?q=site%3Atimesunion.com+%22Hudson+Valley%22&hl=en-US&gl=US&ceid=US%3Aen' },
    { id: 'df_kingston',  name: 'Daily Freeman',         url: 'https://news.google.com/rss/search?q=site%3Adailyfreeman.com+%28Kingston+OR+%22Ulster+County%22+OR+%22New+Paltz%22+OR+Saugerties+OR+Woodstock+OR+Rosendale+OR+Hurley+OR+Marbletown%29+%28Mayor+OR+Council+OR+Legislature+OR+Legislator+OR+Sheriff+OR+Charter+OR+Budget+OR+Government+OR+Election+OR+Police+OR+SUNY+OR+Democrat+OR+Republican+OR+Representative+OR+Assembly+OR+Senate+OR+Senator%29&hl=en-US&gl=US&ceid=US%3Aen' },
  ],
  opinion: [
    { id: 'goldberg',     name: 'Jonah Goldberg',        url: 'https://thedispatch.com/feed/?newsletter-brands=gfile' },
    { id: 'boilingfrogs', name: 'Boiling Frogs',         url: 'https://thedispatch.com/feed/?newsletter-brands=boilingfrogs' },
    { id: 'bouie',        name: 'Jamelle Bouie',         url: 'https://www.nytimes.com/svc/collections/v1/publish/www.nytimes.com/column/jamelle-bouie/rss.xml' },
    { id: 'french',       name: 'David French',          url: 'https://www.nytimes.com/svc/collections/v1/publish/www.nytimes.com/column/david-french/rss.xml' },
    { id: 'marshall',     name: 'TPM',                   url: 'https://talkingpointsmemo.com/edblog/atom/3d6ab582-e5e8-45ac-9040-d7bc43abf7bd' },
    { id: 'nyt_sunday',   name: 'NYT Sunday Opinion',    url: 'https://rss.nytimes.com/services/xml/rss/nyt/sunday-review.xml' },
    { id: 'browser',      name: 'The Browser',           url: 'https://kill-the-newsletter.com/feeds/blszn8836cs0kblerzr3.xml' },
    { id: 'atlantic_ideas', name: 'The Atlantic',        url: 'https://www.theatlantic.com/feed/channel/ideas/' },
    { id: 'bulwark_triad',  name: 'Jonathan V. Last',    url: 'https://www.thebulwark.com/feed', include: 'The Triad' },
  ],
  israel: [
    { id: 'toi',          name: 'Times of Israel',       url: 'https://www.timesofisrael.com/israel-and-the-region/feed/' },
    { id: 'forward',      name: 'The Forward',           url: 'https://forward.com/feed/' },
  ],
  foreign: [
    { id: 'nyt_world',    name: 'NYT World',             url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
    { id: 'wsj_world',    name: 'WSJ World',             url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews' },
    { id: 'atlantic_international', name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/channel/international/' },
  ],
};
