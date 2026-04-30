# Yossi's Portfolio Dashboard — Architecture & Operations Guide

> Last updated: 2026-05-01
> Reference document for how everything works, what accounts exist, and how to maintain it.

---

## 1. What Was Built

A personal, cloud-hosted financial dashboard that:
- Shows your live investment portfolio with real-time prices
- Reads holdings from your Google Sheet (the single source of truth)
- Fetches USD stock prices, fundamentals, and news from Finnhub
- Fetches Israeli TASE stock prices via a Cloudflare cloud proxy
- Calculates RSU income estimates, P&L, signals, and market snapshot
- Works on any device (iPhone, laptop, tablet) from anywhere in the world
- Requires no server, no installation, no ongoing management

**Live URL:** `https://yossia257.github.io/portfolio/Yossi_Fin_Portfolio.html`

---

## 2. Architecture Overview

```
Your Browser (any device, anywhere)
        │
        ▼
GitHub Pages ──────────────── serves the dashboard HTML file
        │                      (always on, free, no server to manage)
        │
        ├── Google Sheets (JSONP) ──── portfolio holdings source of truth
        │                              you edit the sheet; dashboard reads it
        │
        ├── Cloudflare Worker ──────── proxies Israeli .TA stock prices
        │   (portfolio-proxy)          runs 24/7 in Cloudflare's cloud
        │                              worker URL: portfolio-proxy.yossia257.workers.dev
        │
        ├── Finnhub API ────────────── US stock prices, news, fundamentals, analyst data
        │                              free tier: 60 requests/minute
        │
        ├── CoinGecko API ──────────── Bitcoin price + 24h change
        │                              free, no account needed
        │
        └── open.er-api.com ────────── USD/NIS live exchange rate
                                       free, no account needed
```

---

## 3. Components & Their Roles

### GitHub Pages
**Role:** Hosts and serves the dashboard to the world.
**How it works:** Your HTML file lives in a public GitHub repository. GitHub serves it at a permanent URL. Every time a change is pushed, the site updates within ~60 seconds.
**Cost:** Free for public repositories.
**Login:** github.com → account `yossia257`

### Google Sheets (Yossi_Portfolio)
**Role:** The single source of truth for your portfolio holdings.
**Sheet ID:** `1iCbyReT-V2_FxTL06GdA_0VL5rWcJvZx3q9d3bWdXpU`
**Range used:** `Sheet1!B4:H33`
**Column structure:**

| Column | Field | Notes |
|---|---|---|
| B | Name | Full stock/fund name |
| C | Stock Number | TASE security number |
| D | Ticker | Trading symbol (e.g. AMZN, BONS.TA) |
| E | Quantity | Number of shares/units |
| F | Currency | `$` for USD, `₪` for NIS |
| G | Buy Price | USD stocks: dollars. NIS stocks: **Agorot** (dashboard divides by 100 automatically) |
| H | Comments | Used as category label in charts |

**Important:** The sheet must be shared as "Anyone with the link can view."
**To add a new holding:** Add a row in the sheet. Extend the range in Settings if beyond row 33.
**Cost:** Free (Google account).

### Cloudflare Worker (`portfolio-proxy`)
**Role:** Fetches Israeli stock prices from Yahoo Finance on behalf of the browser.
**Why needed:** Yahoo Finance does not allow browsers to fetch their data directly (CORS restriction). The Worker is a tiny cloud script (20 lines) that sits in between, fetches from Yahoo Finance server-side, and passes data back to the browser with the required permission headers.
**Worker code location:** Cloudflare dashboard → Workers & Pages → `portfolio-proxy`
**Supported tickers (auto-converted):** BONS.TA, NWMD.TA, KSM-F77.TA, KSM-F74.TA, TCH-F83.TA
**Ticker not supported:** Harel AND AAA (no Yahoo Finance ticker — shows buy price only)
**Cost:** Free tier = 100,000 requests/day. Dashboard uses ~50/day.
**Login:** cloudflare.com

### Finnhub API
**Role:** Live prices for all USD stocks, ETFs, indices (QQQ, SPY, PANW). Also company news, analyst recommendations, and fundamental metrics (PE, beta, 52-week range).
**API key:** `d7msd89r01qngrvp921gd7msd89r01qngrvp9220`
**Free tier limits:** 60 API calls/minute
**What works on free tier:** Quote prices, news, analyst buy/hold/sell consensus, stock metrics
**What requires paid tier:** Price targets, historical candles
**RSI/SMA source:** Historical candles come from Yahoo Finance via Cloudflare Worker (not Finnhub)
**Login:** finnhub.io

### FMP (Financial Modeling Prep)
**Role:** Analyst price targets (mean, high, low) shown in the drill-down below the buy/hold/sell consensus.
**API key:** `QVxsOmoXts9EWyubaf4cCjul95N6ZrIX`
**Free tier limits:** 250 API calls/day — more than sufficient
**Endpoint used:** `GET /api/v3/price-target-consensus/{symbol}`
**Login:** financialmodelingprep.com

### Anthropic Claude API
**Role:** Generates automatic daily investment ideas shown in the 👀 Watchlist tab. Suggests 3–5 diversified ideas (stocks, ETFs, crypto, commodities) with rationale, risk, and sizing — refreshed once per day, cached in localStorage.
**API key:** Stored securely in Cloudflare Worker environment variable `ANTHROPIC_KEY` — never in browser code.
**Model:** `claude-sonnet-4-6`
**Cost:** ~$0.004 per generation (~$1.20/month at daily frequency)
**Endpoint:** Proxied through Cloudflare Worker at `/claude` route — dashboard never calls Anthropic directly
**Login:** console.anthropic.com

### Google Apps Script (Watchlist)
**Role:** Read/write backend for the 👀 Watchlist tab. Stores watched tickers in a "Watchlist" tab of the Google Sheet, syncing across all devices.
**Script URL:** Stored in `localStorage['watchlist_url']` and CONFIG (not hardcoded in GitHub)
**How it works:** JSONP calls (same pattern as portfolio data loading) — no CORS issues, works from any device
**Actions:** `action=list`, `action=add&ticker=X&note=Y`, `action=remove&ticker=X`
**Security:** URL is a long random string; anyone with it can read/modify the watchlist (not portfolio data). Low risk.
**Deploy:** Google Sheet → Extensions → Apps Script → Deploy as Web App (Execute as: Me, Anyone)

### CoinGecko
**Role:** Bitcoin price and 24-hour change percentage.
**No account or API key required.**

### open.er-api.com
**Role:** Live USD/NIS exchange rate.
**No account or API key required.**

---

## 4. The Technology Stack

| Technology | Where used | Purpose |
|---|---|---|
| **HTML** | `Yossi_Fin_Portfolio.html` | Page structure — tabs, tables, buttons |
| **CSS** | Same file (inside `<style>`) | Visual design — dark theme, layout, responsive |
| **JavaScript** | Same file (inside `<script>`) | All logic — API calls, calculations, rendering |
| **Chart.js** | Loaded from CDN | Doughnut/pie charts in Market Snapshot tab |
| **JSONP** | Google Sheets loading | Technique to load cross-origin data via `<script>` tag (bypasses browser restrictions) |

**Why a single HTML file?**
A deliberate choice for simplicity. A professional app would split code into dozens of files with build tools (React, Webpack, npm). For a personal tool maintained by one person, a single file means: no build step, no dependencies to update, editable directly in GitHub's web interface.

---

## 5. Dashboard Tabs & Features

| Tab | What it shows |
|---|---|
| 💼 Portfolio | Live holdings table (Ticker, Daily%, Ext Hrs%, P&L%, Value, Rate, Qty). KPI cards. Sortable columns. |
| 📈 Market | USD/NIS, BTC, QQQ, SPY, PANW. Allocation pie chart. Currency exposure chart. |
| ⚡ Signals | Auto-generated alerts based on P&L thresholds. Hard-coded watch flags for BABA, LGVN. |
| 📰 News | Market news by category (Finnhub). "My Holdings" fetches last 7 days per stock. |
| 🎓 Learn | Rotating daily tips on investing, leverage, tax, strategy. |
| 🤖 Ask Claude | Builds a full portfolio prompt, copies or shares to Claude app. |
| 📋 Planning | RSU vest income estimates (live PANW price), retention bonus, key events timeline. |
| 👀 Watchlist | Track tickers outside portfolio. Syncs to Google Sheet. Auto-generates daily AI investment ideas via Claude API. Add recommendations to watchlist with one tap. |
| ⚙️ Settings | Finnhub key, FMP key, Watchlist Script URL, Google Sheet info. |

**Drill-down panel:** Click any USD ticker to see Technical data (price, 52-week range, beta, PE, EPS) and Analyst sentiment (buy/hold/sell consensus from Finnhub).

---

## 6. Data Flow — How a Page Load Works

```
1. Page loads from GitHub Pages
2. JSONP script tag → Google Sheets → loads holdings array
   (fallback: SEED_DATA hardcoded in the file — April 2026 snapshot, shown with warning banner)
3. fetchPrices() runs for each holding:
   - USD stocks → Finnhub /quote endpoint
   - NIS stocks → Cloudflare Worker → Yahoo Finance (.TA tickers)
   - IL-{number} tickers (Harel fund) → skipped, shows buy price only
4. fetchMarketData() runs in parallel:
   - USD/NIS → open.er-api.com
   - BTC → CoinGecko
   - QQQ, SPY, PANW → Finnhub
5. Auto-refresh every 2 minutes (when browser tab is visible)
```

---

## 7. How to Make Changes

**Edit the dashboard:**
1. Open the project in VS Code (or any editor) on your Mac
2. Edit `/Users/orlyashkenazi/CLAUDE-YA/FINANCE\ ANALYST/Yossi_Fin_Portfolio.html`
3. OR ask Claude Code to make changes — it will edit the file and push to GitHub automatically

**Push to GitHub (publish to live site):**
Claude Code does this automatically after approved changes. The command is:
```bash
cp "/Users/orlyashkenazi/CLAUDE-YA/FINANCE ANALYST/Yossi_Fin_Portfolio.html" ~/portfolio/ && \
git -C ~/portfolio add . && \
git -C ~/portfolio commit -m "describe change" && \
git -C ~/portfolio push
```

**Update portfolio holdings:**
Edit the Google Sheet directly. Changes appear on next dashboard refresh.

**Extend the sheet range (if you add more than 30 holdings):**
In `Yossi_Fin_Portfolio.html`, find:
```javascript
googleSheetRange: 'Sheet1!B4:H33',
```
Change `H33` to `H40` (or however many rows you need).

---

## 8. Free Accounts Inventory

| Service | Account | What's stored | Monthly cost |
|---|---|---|---|
| **GitHub** | `yossia257` @ github.com | `portfolio` repo with dashboard HTML | Free |
| **Cloudflare** | (your email) @ cloudflare.com | `portfolio-proxy` Worker | Free |
| **Finnhub** | (your email) @ finnhub.io | API key `d7msd89r...` | Free |
| **FMP** | (your email) @ financialmodelingprep.com | API key `QVxsOmo...` | Free (250 calls/day) |
| **Anthropic** | (your email) @ console.anthropic.com | API key in Cloudflare Worker env var `ANTHROPIC_KEY` | ~$1.20/month |
| **Google** | (your Google account) | `Yossi_Portfolio` spreadsheet | Free |
| **CoinGecko** | None (no account) | — | Free |
| **open.er-api.com** | None (no account) | — | Free |

**Total cost: $0/month**

---

## 9. Security Assessment

### What is exposed

| Item | Where visible | Risk level | Action |
|---|---|---|---|
| **Finnhub API key** | HTML source code (public GitHub) | 🟡 Low | Someone could make read-only stock data requests using your key. Monitor usage on finnhub.io. |
| **Portfolio holdings** | Anyone with the Google Sheet link can view | 🟡 Low | Tickers, quantities, buy prices are readable. Not financial account access. |
| **Dashboard URL** | Public GitHub Pages URL | 🟡 Low | Anyone with the URL can see your portfolio. Mitigated by PIN protection (see below). |
| **Cloudflare Worker** | Public URL | 🟢 None | Proxies only public stock data. No credentials, no personal data. |

### What is NOT exposed
- No bank account credentials
- No brokerage login details
- No personal identification
- No ability to trade or transact
- No social security / tax ID

### Monitoring checklist (do quarterly)
- [ ] **Finnhub:** Log into finnhub.io → check API call volume. Normal: ~200–500/day. Alert: thousands/day.
- [ ] **Google Sheet:** Open sheet → check "Last viewed" timestamp. If recently viewed without your action, review sharing settings.
- [ ] **GitHub:** Check repository for any commits you didn't make.
- [ ] **Cloudflare:** Check Worker analytics for unusual request volumes.

---

## 10. Known Limitations & Future Roadmap

| Item | Status | Notes |
|---|---|---|
| Harel AND AAA fund price | No live price | No Yahoo Finance ticker found. Shows buy price only. |
| RSI / SMA indicators | Not available | Requires Finnhub paid tier (candles endpoint). |
| Analyst price targets | Not available | Requires Finnhub paid tier. |
| Write-back to Google Sheet | Not implemented | Would require Google OAuth2 login — significant complexity. |
| Table column sorting | Headers styled as clickable, not functional | Future enhancement. |
| Claude API — Ask Claude inline | Planned | Direct Q&A in the Ask Claude tab without copying to clipboard. Anthropic key already set up — just needs wiring. |
| TA-125 index | Manual only | No free API for TASE index. Shows "—" in market ticker. |
