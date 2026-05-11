# news-api worker

Cloudflare Worker backing the bookmarks feature: magic-link auth, session
storage, and per-email bookmark CRUD. KV is the only storage. Resend
sends magic-link emails.

## One-time setup (in the Cloudflare dashboard)

1. **Create the KV namespace.**
   Workers & Pages → KV → Create namespace → name it `news`.
   Copy the resulting id and paste it into both `id` and `preview_id`
   in `wrangler.toml`. Commit that change.

   (CLI equivalent, if you ever install Wrangler locally:
   `npx wrangler kv:namespace create news`.)

2. **GitHub repo secrets** (already done; here for reference):
   - `CLOUDFLARE_API_TOKEN` — Edit Cloudflare Workers template token.
   - `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard sidebar.
   - `RESEND_API_KEY` — from Resend dashboard.

3. **Worker secrets** (set via Cloudflare dashboard → news-api → Settings
   → Variables and Secrets, or `npx wrangler secret put <NAME>`):
   - `RESEND_API_KEY` — also pushed in by the deploy workflow.
   - `GITHUB_PAT` — fine-grained PAT with **Actions: write** on this repo
     only. Used by the scheduled handler to dispatch the build workflow.
     See `docs/cron-cloudflare-trigger.md`.

## Deploy

Pushes to `main` that touch `worker/**` trigger
`.github/workflows/deploy-worker.yml`, which:

1. Runs `npm test` inside `worker/`.
2. Runs `npx wrangler deploy`.
3. Pipes `RESEND_API_KEY` through `wrangler secret put` so it lives in
   the Worker, not in `wrangler.toml`.

After the first deploy, the Worker URL is
`https://news-api.<your-subdomain>.workers.dev` (printed in the Actions
log). The frontend already points at
`https://news-api.sminkoff.workers.dev`; if the subdomain differs,
update `API_BASE` in `public/auth.js` and the CSP `connect-src` in
`public/index.html`.

## Endpoints

All JSON. CORS allows the configured `ALLOWED_ORIGIN` plus
`http://localhost:*` for dev.

- `POST /auth/request` — body `{ email }`. Always 204. If the email is
  on the allowlist and not rate-limited, sends a magic link.
- `GET /auth/verify?token=...` — exchanges a single-use magic token for
  a 90-day session token. Returns `{ token, email, expiresAt }`.
- `GET /bookmarks` — `Authorization: Bearer <session>`. Returns
  `{ items: [...] }`.
- `POST /bookmarks` — body `{ id, url, title, source }`. Dedupes by id
  or url. Returns 409 at the 1000-item cap.
- `DELETE /bookmarks/:id` — removes the matching item.

## KV layout

- `magic:<token>` — `{ email, createdAt }`, TTL 10 min, deleted on use.
- `session:<token>` — `{ email, expiresAt }`, TTL 90 days.
- `bookmarks:<email>` — `{ items: [{ id, url, title, source, savedAt }] }`.
- `ratelimit:request:<email>` — counter, TTL 1 hour, max 5.

## Tests

`npm test` runs unit tests against the handlers using an in-memory KV
stub. No Wrangler needed locally — these are plain `node --test` files.

## Security notes

- Magic and session tokens are 32 random bytes (Web Crypto), base64url.
- Magic tokens are single-use and 10-min TTL.
- Sessions are Bearer-only (no cookies → no CSRF surface).
- `/auth/request` always returns 204 and is rate-limited per email, so
  it can't enumerate or be flooded.
- KV reads are scoped per email; there's no cross-user lookup path.
