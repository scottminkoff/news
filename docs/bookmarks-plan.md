# Bookmarks (saved articles) — implementation plan

Cross-device personal bookmark store for the news site, with magic-link
auth so a single user (me) can sign in on any device without juggling
tokens. This document is the spec — implement when explicitly asked.

## Goal

- Tap a bookmark icon on any article card → it's saved.
- Open the site on a different device → same bookmarks appear.
- Auth: enter email, click link in inbox, you're signed in for ~90 days.
- Single user (allowlist of 1 email). No registration flow, no UI for
  managing other users.

## Architecture

```
Browser (public/app.js) ──fetch──▶ Cloudflare Worker ──▶ Workers KV
                                          │
                                          └──▶ Resend API (email)
```

- **Frontend**: existing static site on whatever host it's on now
  (GitHub Pages / Netlify / wherever `public/` is served from). No
  framework added.
- **Backend**: one Cloudflare Worker at e.g.
  `news-api.<subdomain>.workers.dev` (custom domain optional).
- **Storage**: one Workers KV namespace, three key prefixes:
  - `bookmarks:<email>` → JSON `{ items: [{id, url, title, source,
    savedAt}, ...] }`
  - `session:<token>` → JSON `{ email, expiresAt }`, TTL ~90 days
  - `magic:<token>` → JSON `{ email, expiresAt }`, TTL 10 minutes,
    deleted on use
- **Email**: Resend (free tier — 3k/mo, plenty). API key stored as a
  Worker secret.

## Repo layout (new)

```
worker/
  package.json          # wrangler as devDependency
  wrangler.toml         # bindings: KV namespace, secrets
  src/
    index.js            # router
    auth.js             # request-link, verify, session check
    bookmarks.js        # GET / POST / DELETE handlers
    email.js            # Resend wrapper
    crypto.js           # token generation, constant-time compare
  README.md             # setup walkthrough
```

Worker is its own npm project so `wrangler` doesn't pollute the root
`package.json` (which is currently feed-build only).

## Worker endpoints

All JSON. CORS allowed only from the production site origin (read from
an env var) plus `http://localhost:*` for dev.

### `POST /auth/request`
Body: `{ email }`.
- 204 always (don't leak whether email is allowlisted).
- If `email` is in `ALLOWED_EMAILS` (comma-separated env var, length 1
  for now), generate a 32-byte random token, store in KV under
  `magic:<token>` with 10-min TTL, send email via Resend with link
  `https://<site>/?magic=<token>`.
- Rate-limit: max 5 requests / email / hour (KV counter w/ TTL).

### `GET /auth/verify?token=...`
- Look up `magic:<token>`. If missing/expired → 400.
- Delete the magic entry (single-use).
- Generate a 32-byte session token, store `session:<token>` w/ 90-day
  TTL, return `{ token, email, expiresAt }`.

### `GET /bookmarks`
Header: `Authorization: Bearer <session-token>`.
- Validate session → load `bookmarks:<email>` → return `{ items }`.

### `POST /bookmarks`
Body: `{ id, url, title, source }`.
- Validate session → append to items if not already present (dedupe by
  `id` or `url`) → set `savedAt = now` → write back → return `{ items }`.

### `DELETE /bookmarks/:id`
- Validate session → remove matching entry → write back → return
  `{ items }`.

Bookmarks list capped at, say, 1000 entries (pruning isn't a problem to
solve until it is — just reject writes past the cap).

## Frontend changes (`public/`)

### New module: `public/auth.js`
- Reads `?magic=...` from URL on load — if present, POSTs to
  `/auth/verify`, stores `{ token, email, expiresAt }` in localStorage
  under key `news:session`, strips `?magic` from URL via
  `history.replaceState`.
- Exports `getSession()`, `signOut()`, `isSignedIn()`.

### New module: `public/bookmarks.js`
- `loadBookmarks()` → fetch `/bookmarks`, cache in memory + localStorage
  (`news:bookmarks` for offline display).
- `toggleBookmark(article)` → optimistic update + POST/DELETE.
- Set of bookmarked IDs exposed for the renderer.

### `public/app.js`
- After rendering each article card, render a bookmark button. Filled
  if id is in the bookmarked set.
- Add a "Saved" filter chip / view that shows only bookmarked articles
  (read from cached bookmarks; works offline).
- Add a small header element: when signed out, "Sign in" link; when
  signed in, the email + "Sign out".

### New: `public/signin.html` (or modal in `index.html`)
Single email input, "Send link" button, "Check your email" success
state. Posts to `/auth/request`. Resends rate-limited on the server,
button disables for 30s after click.

### `public/styles.css`
- Bookmark icon styles (outline vs filled).
- Sign-in panel.
- Saved-articles empty state.

## Magic-link UX details

- Email subject: "Sign in to news".
- Body: plain-text + minimal HTML, single button/link, mention the link
  expires in 10 minutes.
- Link target is the production site with `?magic=<token>`. The site's
  `auth.js` handles the exchange — keeps the Worker out of HTML
  rendering.
- After verification, redirect to `/` so the URL is clean.

## Security notes

- Session tokens: 32 random bytes, base64url. Stored as Bearer header,
  not cookies (avoids CSRF surface; the site is purely static + JSON
  API).
- Magic tokens: same, single-use, 10-min TTL.
- `ALLOWED_EMAILS` env var is the auth boundary. Anything not in it
  silently gets the same 204 from `/auth/request` so the endpoint can't
  be used to enumerate.
- All KV writes per-email; no cross-user reads possible because session
  → email is the only mapping.
- CORS: explicit origin allowlist, not `*`. `Access-Control-Allow-
  Credentials` not needed (Bearer header).
- Constant-time compare for token lookups (KV get is already
  effectively this; just don't add a manual `===` on user-supplied
  strings beyond the KV lookup).

## Setup steps (for the README)

1. `cd worker && npm install`
2. `npx wrangler login`
3. `npx wrangler kv:namespace create NEWS_KV` → paste id into
   `wrangler.toml`.
4. Sign up at resend.com, verify a sending domain (or use their test
   domain for dev), get API key.
5. `npx wrangler secret put RESEND_API_KEY`
6. `npx wrangler secret put ALLOWED_EMAILS` (value: my email).
7. `npx wrangler deploy` → note the workers.dev URL.
8. Set `API_BASE` constant in `public/auth.js` + `public/bookmarks.js`
   to that URL.
9. (Optional) Add custom domain in Cloudflare dashboard.

## What's explicitly out of scope

- Multi-user / sharing / public profiles.
- Server-rendered pages.
- Tags, folders, notes on bookmarks (just a flat list for now).
- Mobile app / PWA install prompts.
- Sync conflict resolution beyond last-write-wins (single user, rare
  concurrent writes).

## Rough effort estimate

- Worker (auth + bookmarks + Resend wrapper + tests): ~250 LOC.
- Frontend (auth.js, bookmarks.js, UI hooks, sign-in page): ~200 LOC +
  CSS.
- Setup walkthrough + first deploy: ~30 minutes once Cloudflare and
  Resend accounts exist.

## Open questions to confirm before starting

1. Production site origin (for CORS allowlist + magic-link redirect
   target)?
2. Custom domain for the Worker, or fine with `*.workers.dev`?
3. Resend sending domain, or use their shared test domain initially?
4. Bookmark icon: existing icon font/SVG in repo, or pick a new one?
5. Should the "Saved" view be a filter chip alongside existing filters,
   or a separate route/page?
