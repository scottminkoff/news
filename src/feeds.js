// Feed registry. To override a URL at runtime (e.g. paid/token feeds),
// set a Worker secret named FEED_URL_<ID_UPPERCASE>, e.g. FEED_URL_TPM.

export const FEEDS = {
  national: [
    { id: 'nyt_us',       name: 'NYT',          url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml' },
    { id: 'axios',        name: 'Axios',        url: 'https://www.axios.com/feeds/feed.rss' },
    { id: 'politico',     name: 'Politico',     url: 'https://rss.politico.com/playbook.xml' },
    { id: 'atlantic',     name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' },
    { id: 'tpm',          name: 'TPM',          url: 'https://talkingpointsmemo.com/feed' },
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
};
