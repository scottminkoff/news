# Things to do outside of Claude before "implement the bookmarks plan"

This is the human-only checklist — accounts to create, tokens to copy
into GitHub. **No Node or Wrangler install needed on your laptop.**
Deploys run from GitHub Actions.

When you're done, come back and say "implement the bookmarks plan" and
share the values from the **Bring back to Claude** section.

Estimated time: 20–30 minutes, mostly clicking through dashboards.

---

## 1. Cloudflare account + API token (10 min)

### 1a. Sign up
1. Sign up / log in at https://dash.cloudflare.com.
2. From the left sidebar pick **Workers & Pages**. Cloudflare may ask
   you to choose a `workers.dev` subdomain — pick anything (e.g.
   `minkoff`). Your Worker will end up at
   `news-api.<your-subdomain>.workers.dev`.

### 1b. Find your Account ID
- Dashboard right sidebar (or **Workers & Pages** overview) →
  **Account ID**. Long hex string. Copy it.

### 1c. Create a deploy API token
- Top-right profile menu → **My Profile** → **API Tokens** →
  **Create Token**.
- Pick the **Edit Cloudflare Workers** template (it pre-fills the
  right permissions: Workers Scripts edit, Workers KV edit, Account
  Settings read).
- Account Resources: include your account. Zone Resources: "All
  zones" is fine.
- Create → copy the token immediately (only shown once).

You now have two values: **Account ID** and **API Token**. Both go
into GitHub repo secrets in step 4.

## 2. Resend account (10 min + DNS wait if you go custom)

1. Sign up at https://resend.com (free tier: 3,000 emails/month).
2. **Sending domain** — pick one:
   - **Easy / dev mode**: skip domain setup, send from
     `onboarding@resend.dev`. Works immediately. The catch: emails
     only deliverable to the address you signed up with. Fine for
     single-user.
   - **Proper**: dashboard → **Domains** → **Add Domain**, enter a
     domain you own. Resend gives you 3–4 DNS records (SPF, DKIM,
     optional DMARC). Add them at your DNS provider. Verifies in
     5–30 min.
   - Recommendation: start with `onboarding@resend.dev`, switch
     later if you want.
3. **API key**. Dashboard → **API Keys** → **Create API Key** →
   "Sending access". Copy it (only shown once). Looks like
   `re_xxxxxxxxxxxx`.

## 3. Decide a couple of things (2 min)

- **Your email address** — the one allowlisted to sign in.
- **Production site origin** — what URL is the static site served
  from? (e.g. `https://news.example.com`, GitHub Pages URL, etc.)
  This is the CORS allowlist and the magic-link redirect target.
- **From-address** for magic-link emails — either
  `onboarding@resend.dev` or something at your verified Resend
  domain.

## 4. Add secrets to the GitHub repo (3 min)

Repo on GitHub → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**. Add these three:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | from step 1c |
| `CLOUDFLARE_ACCOUNT_ID` | from step 1b |
| `RESEND_API_KEY` | from step 2 |

That's it for secrets. The deploy workflow (which I'll add when you
say "implement") reads these and uses Wrangler to push them through
to the Worker.

## 5. (Optional) Custom domain for the Worker

Skip unless you want `api.news.example.com` instead of
`news-api.<sub>.workers.dev`.

The domain has to already be on Cloudflare DNS. After the first
deploy, in the Cloudflare dashboard go to the Worker → **Triggers** →
**Custom Domains** → add the subdomain. DNS record auto-created.

Easier to do this *after* the first deploy.

---

## Bring back to Claude when you're ready

Paste these into chat (the API keys themselves are already in
GitHub secrets — don't paste those):

- [ ] Cloudflare `workers.dev` subdomain: `__________`
- [ ] All three GitHub repo secrets added (yes / no)
- [ ] From-address: `__________`
- [ ] Allowlisted email: `__________`
- [ ] Production site origin: `__________`
- [ ] (Optional) Custom Worker domain: `__________` or "skip"

Once those are in hand, I'll scaffold `worker/`, write the frontend
bookmarks UI, and add a `.github/workflows/deploy-worker.yml` that
runs on pushes to `main` (or whichever branch you prefer).

## What you do NOT need

- Node, npm, or Wrangler installed on your laptop.
- A terminal. All steps above are dashboard clicks.
- To paste any API keys or tokens into Claude. They live in GitHub
  secrets only.

## Tradeoff to remember

While I'm building this, every Worker code change has to go through
commit → push → CI build → deploy (~30–60s). It's slower than local
`wrangler dev` but acceptable for a one-time build. Frontend changes
(`public/`) are unaffected — those iterate at normal browser-refresh
speed.
