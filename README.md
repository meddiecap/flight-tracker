# ✈ Flight Tracker

A live flight tracker built with Vue 3, TypeScript, and Leaflet. Streams real aircraft positions from the [OpenSky Network](https://opensky-network.org/) and renders them on a full-screen dark map with smooth interpolation.

**[Live demo →](https://your-username.github.io/flight-tracker/)**  
*(Replace with your actual GitHub Pages URL after the first deploy)*

![Screenshot](docs/screenshot.png)

---

## Features

- Live aircraft positions updated every 30 seconds via the OpenSky REST API
- SVG arrow markers rotated to true-track heading, with 15 fps rAF interpolation so planes glide instead of jump
- Click any aircraft to open a detail panel: callsign, altitude, speed, heading, vertical rate, CO₂ estimate
- Airport overlay (5 277 medium + large airports) showing nearby flight count, zoom-gated at level 7
- Stats bar: aircraft count, max altitude, max speed, total CO₂ estimate
- CO₂ estimate model with formula tooltip (rough heuristic — for illustration only)
- Responsive layout: side panel on desktop, bottom sheet on mobile
- Error banner for API errors and 429 rate-limit cooldown with live countdown

---

## Tech stack

| Layer | Library |
|---|---|
| Framework | Vue 3 + `<script setup>` + TypeScript strict |
| State | Pinia |
| Map | Leaflet (imperative markers, no vue-leaflet for aircraft/airports) |
| Styling | Tailwind CSS v4 |
| Build | Vite + `@vitejs/plugin-vue` |
| Package manager | Bun |
| Deploy | GitHub Pages via GitHub Actions |
| CORS proxy | Cloudflare Worker (free tier) |

---

## Local development

```bash
bun install
bun run dev
```

The Vite dev server proxies both the OpenSky states endpoint and the OAuth2 token endpoint, so no CORS issues locally.

### Optional: OpenSky credentials

Anonymous access is limited to 400 API credits/day. To get 4 000 credits/day:

1. Register at https://opensky-network.org/
2. Create `.env.local` (already gitignored):

```env
VITE_OPENSKY_CLIENT_ID=your_client_id
VITE_OPENSKY_CLIENT_SECRET=your_client_secret
```

---

## Production deploy

### 1. Cloudflare Worker (CORS proxy)

The Vite dev proxy is not available in production. A tiny Cloudflare Worker forwards requests to OpenSky and adds the correct CORS headers.

```bash
npx wrangler login
npx wrangler deploy worker/opensky-proxy.js \
  --name opensky-proxy \
  --compatibility-date 2024-01-01
```

This deploys to `https://opensky-proxy.<your-subdomain>.workers.dev` on the free tier (no credit card required).

### 2. GitHub repository secrets

In your repo go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `VITE_OPENSKY_PROXY_URL` | Your Worker URL, e.g. `https://opensky-proxy.xxx.workers.dev` |
| `VITE_OPENSKY_CLIENT_ID` | Your OpenSky client ID |
| `VITE_OPENSKY_CLIENT_SECRET` | Your OpenSky client secret |

### 3. Enable GitHub Pages

Go to **Settings → Pages** and set the source to **GitHub Actions**.

Push to `master` — the workflow in `.github/workflows/deploy.yml` will build and deploy automatically.

---

## Project structure

```
src/
  assets/         airports.json (5 277 medium + large airports)
  components/     FlightPanel, StatsBar, ErrorBanner
  composables/    useOpenSky, useAircraftLayer, useAirportLayer, useCo2
  stores/         flights (Pinia), airports (Pinia)
  views/          MapView
worker/
  opensky-proxy.js   Cloudflare Worker CORS proxy
.github/
  workflows/
    deploy.yml     GitHub Actions → GitHub Pages
```

---

## Data sources

- **Aircraft positions**: [OpenSky Network](https://opensky-network.org/) REST API — [terms of use](https://opensky-network.org/about/terms-of-use)
- **Airport data**: [OurAirports](https://ourairports.com/data/) — filtered to medium + large airports, public domain
- **Map tiles**: [CartoDB Dark Matter](https://carto.com/basemaps/) — © OpenStreetMap contributors, © CARTO
.
