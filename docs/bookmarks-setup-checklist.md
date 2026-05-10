# Things to do outside of Claude before "implement the bookmarks plan"

This is the human-only checklist — accounts to create, DNS to point,
secrets to copy. Do these whenever you're ready; none require Claude.
When you're done (or stuck), come back and say "implement the bookmarks
plan" and share the values from the **Bring back to Claude** section.

Estimated time end-to-end: 30–45 minutes, mostly waiting on DNS.

---

## 1. Cloudflare account (5 min)

1. Sign up / log in at https://dash.cloudflare.com.
2. From the left sidebar pick **Workers & Pages**. Cloudflare may ask
   you to choose a `workers.dev` subdomain — pick anything (e.g.
   `minkoff`). Your Worker will end up at
   `news-api.<your-subdomain>.workers.dev`.
3. (Optional, can do later) If you want a prettier API URL like
   `api.news.example.com`, the domain has to be on Cloudflare DNS.
   Skip this for now — `*.workers.dev` is fine.

**No Worker to create yet** — `wrangler deploy` will create it from
your laptop.

## 2. Install Node + Wrangler login (5 min)

You need Node 18+ on the machine you'll deploy from.

1. Check: `node --version`. If missing or <18, install from
   https://nodejs.org or via your package manager.
2. You don't need to install Wrangler globally — the `worker/`
   directory I'll add will pin it as a devDependency. All you'll do
   later is `cd worker && npm install && npx wrangler login`. The
   `login` step pops a browser window to authorize against your
   Cloudflare account.

Nothing to do right now beyond "have Node installed and know your
Cloudflare login works."

## 3. Resend account for sending email (10 min + DNS wait)

1. Sign up at https://resend.com (free tier — 3,000 emails/month, way
   more than we need).
2. **Sending domain**. Two options:
   - **Easy / dev mode**: skip domain setup, use Resend's
     `onboarding@resend.dev` as the From address. Works immediately.
     The catch: emails will only be deliverable to the email you
     signed up with. Fine for single-user.
   - **Proper**: in Resend dashboard → **Domains** → **Add Domain**,
     enter a domain you own (e.g. `news.example.com` or just
     `example.com`). Resend will give you 3–4 DNS records (SPF,
     DKIM, optional DMARC). Add them at your DNS provider.
     Verification usually takes 5–30 min.
   - Recommendation: start with `onboarding@resend.dev`, switch later
     if it bugs you.
3. **API key**. Dashboard → **API Keys** → **Create API Key** →
   "Full access" or "Sending access". Copy it immediately, it's only
   shown once. Looks like `re_xxxxxxxxxxxx`. Save in a password
   manager.

## 4. Decide a couple of things (2 min)

Have answers ready for these — they go into the Worker config.

- **Your email address** (the one allowlisted to sign in). Just one.
- **Production site origin** — what URL is the static site served
  from? (e.g. `https://news.example.com`, or a Pages/Netlify URL.)
  This is the CORS allowlist and the magic-link redirect target.
- **From-address** for magic-link emails — either
  `onboarding@resend.dev` or something at your verified domain like
  `news@news.example.com`.

## 5. (Optional) Custom domain for the Worker (15 min + DNS wait)

Skip unless you want `api.news.example.com` instead of
`news-api.minkoff.workers.dev`.

1. The domain must already be on Cloudflare DNS (move nameservers if
   not — that's a separate, longer process).
2. After the Worker exists, in the Cloudflare dashboard go to the
   Worker → **Triggers** → **Custom Domains** → add the subdomain.
   Cloudflare creates the DNS record automatically.

Easier to do this *after* the first deploy, so the Worker exists to
attach to.

---

## Bring back to Claude when you're ready

Paste these into the chat (or just have them handy — I'll ask):

- [ ] Cloudflare account exists, `workers.dev` subdomain is: `__________`
- [ ] Node 18+ confirmed on the laptop
- [ ] Resend API key saved (don't paste it in chat — store as a Worker
      secret yourself when prompted; just confirm "have it")
- [ ] From-address: `__________`
- [ ] Allowlisted email: `__________`
- [ ] Production site origin: `__________`
- [ ] (Optional) Custom Worker domain: `__________` or "skip"

That's everything. Once those are in hand, I'll scaffold the `worker/`
directory, write the frontend modules, and walk you through the four
or five `npx wrangler` commands needed to deploy.

## What I will NOT need from you

- Your Cloudflare password / 2FA code.
- The Resend API key value (you paste it directly into
  `npx wrangler secret put RESEND_API_KEY` — it never goes through me
  or git).
- Any session/magic tokens.
