// Feed registry. To override a URL at runtime (e.g. paid/token feeds),
// set a Worker secret named FEED_URL_<ID_UPPERCASE>, e.g. FEED_URL_TPM.

export const FEEDS = {
  national: [
    { id: 'nyt',       name: 'NYT',          url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
    { id: 'axios',     name: 'Axios',        url: 'https://www.axios.com/feeds/feed.rss' },
    { id: 'politico',  name: 'Politico',     url: 'https://rss.politico.com/politics-news.xml' },
    { id: 'atlantic',  name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' },
    { id: 'tpm',       name: 'TPM',          url: 'https://talkingpointsmemo.com/feed' },
    { id: 'newyorker', name: 'New Yorker',   url: 'https://www.newyorker.com/feed/everything' },
  ],
  state: [
    { id: 'tu_state',  name: 'Times Union',           url: 'https://www.timesunion.com/state/feed/' },
    { id: 'capcon',    name: 'Capital Confidential',  url: 'https://capitolconfidential.substack.com/feed' },
    { id: 'cands',     name: 'City & State',          url: 'https://www.cityandstateny.com/rss/all' },
    { id: 'nysop',     name: 'NY State of Politics',  url: 'https://nystateofpolitics.com/state-of-politics/new-york/rss' },
  ],
  local: [
    { id: 'hv1',       name: 'Hudson Valley One',     url: 'https://hudsonvalleyone.com/feed/' },
  ],
};
