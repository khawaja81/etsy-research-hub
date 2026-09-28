# Etsy Research Hub

An Etsy research website: keyword research, keyword ideas, competitor listing & shop analysis, SEO grading, profit calculator and a seasonal calendar. Live data comes from the **official Etsy Open API v3**, so it works on Railway without scraping or getting blocked.

## Features

| Tool | What it does | Needs Etsy key |
|---|---|---|
| **Keyword Research** | Total active listings (competition), opportunity / demand / competition scores, price distribution and "sweet spot", top competitor tags, title words and 2–3-word phrases, listing age, top shops, categories, materials, a full listings table with CSV export. Filters: price, category, shop location, sort, 100–300 listings | Yes |
| **Keyword Ideas** | Long-tail ideas from Google autocomplete, "etsy …" searches, and Amazon autocomplete. Modes: basic, Etsy buyer modifiers, A–Z, and intent words. One-click Etsy competition check per keyword | Only for the competition check |
| **Compare Keywords** | Up to 5 keywords side by side, with the best value in each row highlighted | Yes |
| **Listing Analyzer** | Any listing's tags, views, favorites, favorite rate, reviews per month, SEO audit, and a **rank checker** that finds where the listing ranks for each of its tags | Yes |
| **Shop Analyzer** | Sales, sales per day, estimated revenue, rating, best sellers inferred from recent reviews, review momentum, tags and prices used across the shop | Yes |
| **Title & Tag Grader** | Live SEO score for title, 13 tags and description. "Get tag ideas" pulls tags from top competitors | Only for tag ideas |
| **Profit Calculator** | Etsy listing, transaction, processing, offsite ads, regulatory and conversion fees; profit, margin, break-even price and the price needed for a target margin | No |
| **Seasonal Calendar** | Upcoming shopping events, a "list by" date for each, and keyword ideas | No |
| **Saved Keywords** | Your shortlist with notes, refresh and CSV export (saved in the browser) | Only for refresh |

> Etsy does not publish search volume or per-listing sales. Demand and opportunity scores are estimates built from real engagement data (favorites, views per day) and listing counts. Best sellers are inferred from recent reviews.

---

## 1) Get an Etsy API key (free)

1. Log in to Etsy, then open **https://www.etsy.com/developers/register** and create an app.
2. Open **https://www.etsy.com/developers/your-apps** and copy the **Keystring** and the **Shared secret**.

## 2) Run locally

```bash
npm install
cp .env.example .env        # on Windows: copy .env.example .env
# paste ETSY_API_KEY and ETSY_SHARED_SECRET into .env
npm start
```

Then open http://localhost:3000.

## 3) Deploy on Railway

**Option A: from GitHub (easiest)**
1. Push this folder to a GitHub repository. `.env` and `node_modules` are already git-ignored.
2. In Railway, choose **New Project → Deploy from GitHub repo** and select the repository.
3. In the service, open **Variables** and add:
   - `ETSY_API_KEY` = your keystring
   - `ETSY_SHARED_SECRET` = your shared secret
   - `APP_PASSWORD` = *(optional)* locks the site behind a password prompt
4. Open **Settings → Networking → Generate Domain** to get a public URL.

**Option B: Railway CLI**
```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway variables --set "ETSY_API_KEY=xxx" --set "ETSY_SHARED_SECRET=yyy"
railway domain
```

Railway detects Node automatically. `railway.json` sets the start command and a `/healthz` health check. The app listens on Railway's `PORT`.

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ETSY_API_KEY` | yes | — | Etsy app keystring. `keystring:secret` in one value also works |
| `ETSY_SHARED_SECRET` | yes | — | Etsy app shared secret. Etsy requires the `keystring:shared_secret` format, which the app builds for you |
| `APP_PASSWORD` | no | — | Password-protects the whole site (HTTP Basic Auth, any username) |
| `ETSY_QPS` | no | `4` | Max Etsy requests per second |
| `CACHE_TTL_MINUTES` | no | `60` | Etsy responses are cached in memory to save your daily quota |

## API usage

Etsy apps have a daily request limit, shown on the **API Setup** page.
- Keyword analysis costs about 2 calls per 100 listings.
- A competition check costs 1 call.
- A shop analysis costs about 4 calls.
- A rank check costs 1–3 calls per keyword.

Repeat searches within the cache window are free.

## Project structure

```
server.js            Express server + REST API (/api/*)
src/etsy.js          Etsy API client (auth, rate limit, retries, cache, usage tracking)
src/analyze.js       Statistics: prices, tags, n-grams, shops, scores, reviews
src/suggest.js       Keyword ideas (Google / "etsy …" / Amazon autocomplete)
src/fx.js            Currency conversion to USD (open.er-api.com, cached 12h)
public/              Front-end (vanilla JS single-page app, no build step)
```

---

### Roman Urdu mein short guide

1. Etsy developer account se **Keystring** aur **Shared secret** lein (upar step 1).
2. Code GitHub pe push karein, phir Railway pe "Deploy from GitHub repo" karein.
3. Railway → Variables mein `ETSY_API_KEY` aur `ETSY_SHARED_SECRET` daalein. Agar site ko private rakhna hai to `APP_PASSWORD` bhi daalein.
4. Settings → Networking → Generate Domain. Aapki website live ho jayegi.
5. Website khol kar **API Setup → Test connection** dabayen. "Connected" aaye to sab tools use karein.
