# ✈ Flight Tracker

A live flight tracker built with Vue 3, TypeScript, and Leaflet. Streams real aircraft positions from [adsb.fi](https://adsb.fi/) and renders them on a full-screen dark map with smooth interpolation.

**[Live demo →](https://meddiecap.github.io/flight-tracker/)**

![Screenshot](docs/screenshot.png)

---

## Features

- Live aircraft positions updated every 30 seconds via the adsb.fi open data API
- SVG arrow markers rotated to true-track heading, with 15 fps rAF interpolation so planes glide instead of jump
- Click any aircraft to open a detail panel: callsign, registration, aircraft type, altitude, speed, heading, vertical rate, CO₂ estimate
- Airport overlay (5 277 medium + large airports) showing nearby flight count, zoom-gated at level 7
- Stats bar: aircraft count, max altitude, max speed, total CO₂ estimate
- CO₂ estimate model with formula tooltip (rough heuristic — for illustration only)
- Responsive layout: side panel on desktop, bottom sheet on mobile
- Error banner for API errors and 429 rate-limit cooldown with live countdown

---

## Tech stack

| Layer           | Library                                                            |
| --------------- | ------------------------------------------------------------------ |
| Framework       | Vue 3 + `<script setup>` + TypeScript strict                       |
| State           | Pinia                                                              |
| Map             | Leaflet (imperative markers, no vue-leaflet for aircraft/airports) |
| Styling         | Tailwind CSS v4                                                    |
| Build           | Vite + `@vitejs/plugin-vue`                                        |
| Package manager | Bun                                                                |
| Deploy          | GitHub Pages via GitHub Actions                                    |
| CORS proxy      | Vercel serverless function (free tier)                             |

---

## Local development

```bash
bun install
bun run dev
```

The Vite dev server proxies requests to the adsb.fi API (`/api/adsb-fi → https://opendata.adsb.fi/api`), so no CORS issues locally. No API key or account required.

---

## Production deploy

### 1. Vercel (CORS proxy)

adsb.fi does not send `Access-Control-Allow-Origin` headers for browser requests. A small Vercel serverless function in `api/aircraft.js` forwards requests server-side and adds the correct CORS headers.

1. Import the repository at [vercel.com](https://vercel.com) — framework preset: **Other**
2. Go to **Settings → Deployment Protection** and set to **"Only Preview Deployments"** so the production URL is publicly accessible
3. Note your deployment URL, e.g. `https://flight-tracker-xxx.vercel.app`

### 2. GitHub repository secrets

In your repo go to **Settings → Secrets and variables → Actions** and add:

| Secret                   | Value                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| `VITE_OPENSKY_PROXY_URL` | Your Vercel deployment URL, e.g. `https://flight-tracker-xxx.vercel.app` |

### 3. Enable GitHub Pages

Go to **Settings → Pages** and set the source to **GitHub Actions**.

Push to `main` — the workflow in `.github/workflows/deploy.yml` will build and deploy automatically.

---

## Project structure

```
src/
  assets/         airports.json (5 277 medium + large airports)
  components/     FlightPanel, StatsBar, ErrorBanner
  composables/    useOpenSky, useAircraftLayer, useAirportLayer, useCo2
  stores/         flights (Pinia), airports (Pinia)
  views/          MapView
api/
  aircraft.js     Vercel serverless CORS proxy → adsb.fi
.github/
  workflows/
    deploy.yml    GitHub Actions → GitHub Pages
```

---

## Data sources

- **Aircraft positions**: [adsb.fi](https://adsb.fi/) open data API — [terms of use](https://adsb.fi/) (personal, non-commercial use)
- **Airport data**: [OurAirports](https://ourairports.com/data/) — filtered to medium + large airports, public domain
- **Map tiles**: [CartoDB Dark Matter](https://carto.com/basemaps/) — © OpenStreetMap contributors, © CARTO
