# Reliable build trigger via Cloudflare Worker cron

## Goal
Replace GitHub Actions' unreliable scheduled cron with a Cloudflare Worker
scheduled trigger that fires `workflow_dispatch` on the build workflow. The
build still runs on GitHub Actions — only the trigger moves.

GitHub's `schedule:` events are queued on shared infrastructure and routinely
slip by 15–60 minutes during the day (sometimes skipped entirely).
Cloudflare's Worker cron is reliable to the minute. The Worker just pokes
GitHub on schedule; GitHub still does the work.

---

## Scott's part — do this first, once

1. **Create a fine-grained Personal Access Token** at
   https://github.com/settings/personal-access-tokens
   - Resource owner: your account
   - Repository access: **Only select repositories → scottminkoff/news**
   - Repository permissions: **Actions → Read and write** (everything else stays "No access")
   - Expiration: 90 days (or whatever you're comfortable rotating)
   - Click **Generate token**, copy it immediately — it's only shown once

2. **Push the token as a Worker secret**. From the repo root:
   ```
   cd worker
   npx wrangler secret put GITHUB_PAT
   ```
   Paste the token when prompted. Requires wrangler authenticated to your
   Cloudflare account (which it already is — the bookmarks worker is live).

3. **Ping me** to do the code part. Confirm by saying something like
   "PAT is in" and I'll pick up from the Claude part below.

Total time on your end: ~5 minutes.

---

## Claude's part — do this after Scott confirms the secret is in

### Code changes (one PR)

1. **`worker/wrangler.toml`** — add a cron trigger:
   ```toml
   [triggers]
   crons = ["*/5 * * * *"]
   ```

2. **`worker/src/github.js`** (new) — small module exporting
   `dispatchBuild(env)` that POSTs to
   `https://api.github.com/repos/scottminkoff/news/actions/workflows/build.yml/dispatches`
   with body `{"ref": "main"}` and headers:
   - `Authorization: Bearer ${env.GITHUB_PAT}`
   - `Accept: application/vnd.github+json`
   - `User-Agent: news-build-trigger`

   Surface failures via `throw new Error(...)` so the scheduled handler's
   `console.error` records them in Cloudflare's tail.

3. **`worker/src/index.js`** — add a `scheduled` export alongside the
   existing `fetch`:
   ```js
   export default {
     async fetch(req, env) { /* existing */ },
     async scheduled(event, env, ctx) {
       ctx.waitUntil(dispatchBuild(env).catch(err => console.error('dispatch failed', err)));
     },
   };
   ```

4. **`.github/workflows/build.yml`** — remove the `schedule:` block. Keep
   `workflow_dispatch:` and `push: branches: [main]`. The Worker handles
   scheduling now; on-push and manual dispatch stay as redundant triggers.

5. **`worker/test/github.test.js`** (new) — stub `globalThis.fetch`,
   assert `dispatchBuild` calls the right URL with the Bearer header.
   Mirror the existing auth/bookmarks test pattern.

6. **`worker/README.md`** — list `GITHUB_PAT` alongside `RESEND_API_KEY`
   so future-Scott (or future-me) knows it exists.

### Sanity check after deploy

- `cd worker && node --test test/*.test.js` — all green locally
- Push to main → `Deploy worker` workflow runs and ships the new Worker
- Cloudflare dashboard → Workers → news-api → Logs → watch for a
  `scheduled` invocation within 5 minutes. Should see a successful
  GitHub API response (204).
- GitHub Actions tab → Build and deploy feeds → should see new runs
  arriving on the 5-minute marks, on time.

### Rollback (if it misbehaves)

- Restore the `schedule:` block in `build.yml`.
- Remove `[triggers]` from `wrangler.toml` and redeploy the worker
  (`npx wrangler deploy`).
- PAT can stay revoked or left alone; it's harmless if unused.

---

## Cost / risk

- Cloudflare Workers free tier: 288 cron invocations/day. Limit is
  100k/day. Nowhere close.
- GitHub workflow_dispatch API: no rate-limit concern at 5-minute cadence.
- If the PAT expires, the scheduled handler will log a 401 and the
  workflow stops auto-firing. The on-push trigger keeps working; manual
  "Run workflow" still works too. Failure mode is "stops refreshing
  silently" — worth checking the Actions tab if data feels stale.

## Notes

- Worker `scheduled` invocations don't touch the public `fetch` path,
  so CORS / auth / rate limits in `index.js` are irrelevant here.
- The `dispatchBuild` call is the entire scheduled handler. If you want
  to do other periodic work later (cache warming, KV cleanup), this
  is the place.
