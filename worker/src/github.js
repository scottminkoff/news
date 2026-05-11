const DISPATCH_URL =
  'https://api.github.com/repos/scottminkoff/news/actions/workflows/build.yml/dispatches';

export async function dispatchBuild(env) {
  if (!env.GITHUB_PAT) throw new Error('GITHUB_PAT not configured');
  const res = await fetch(DISPATCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'news-build-trigger',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub dispatch ${res.status}: ${body.slice(0, 200)}`);
  }
}
