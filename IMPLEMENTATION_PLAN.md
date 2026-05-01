# Flight Tracker — Implementation Plan

## Guiding principles

- One logical concern per commit; no mega-commits
- Each phase leaves the app in a runnable state
- Core features only until all phases are done; stretch goals after
- Bun as package manager throughout
- TypeScript strict mode from day one

---

## Phase 1 — Project scaffold

**What:** Initialise the Vite + Vue 3 + TypeScript project, add all dependencies, configure Tailwind CSS, set up the folder structure from the spec.

**Commit:** `feat: scaffold Vue 3 + Tailwind + Leaflet project`

Tasks:

- `bun create vue@latest` (Vue 3, TypeScript, Pinia, Vue Router)
- Install runtime deps: `leaflet`, `@vue-leaflet/vue-leaflet`, `tailwindcss`, `@tailwindcss/vite`
- Configure Tailwind
- Create empty placeholder files for every module in the spec structure
- Verify `bun run dev` starts without errors

---

## Phase 2 — Full-screen map

**What:** Render a working Leaflet map that fills the viewport, using CartoDB dark tiles.

**Commit:** `feat: add full-screen Leaflet map with dark tiles`

Tasks:

- `MapView.vue` with `<l-map>` that fills `100dvh`
- CartoDB Positron Dark tile layer
- Vue Router wired up with MapView as the only route
- Basic Tailwind reset / body styles

---

## Phase 3 — OpenSky polling + flights store

**What:** Wire up the OpenSky REST API with bounding-box filtering, 10-second polling, and 429 backoff. Store raw state in Pinia.

**Commit:** `feat: add OpenSky polling composable and flights store`

Tasks:

- `stores/flights.ts` — holds `StateVector[]`, selected flight ID, last-fetch timestamp
- `composables/useOpenSky.ts` — polling loop, bbox from map bounds, 429 → exponential backoff, error state
- Expose `start()` / `stop()` so MapView controls the lifecycle
- No rendering yet — verify state updates in Vue DevTools

---

## Phase 4 — Aircraft markers + smooth interpolation

**What:** Render all aircraft as SVG arrows rotated to their true-track heading; interpolate positions between polls so planes glide rather than jump.

**Commit:** `feat: render aircraft markers with heading rotation and smooth interpolation`

Tasks:

- `composables/useInterpolation.ts` — stores previous + next positions per ICAO24, drives a `requestAnimationFrame` loop, exposes interpolated lat/lng per aircraft
- `components/AircraftMarker.vue` — Leaflet `DivIcon` wrapping an inline SVG arrow; rotated via CSS `transform`; `aria-label` with callsign
- Wire markers into MapView; re-render on each animation frame
- On-ground aircraft rendered with lower opacity

---

## Phase 5 — Flight detail panel

**What:** Clicking an aircraft opens a side panel with all available telemetry.

**Commit:** `feat: add flight detail panel with telemetry`

Tasks:

- `components/FlightPanel.vue` — fixed right-side panel; shows callsign, origin country, altitude, velocity, heading, vertical rate, on-ground status
- Click aircraft → `flights.selectFlight(icao24)`; click map background → deselect
- Panel closes on mobile to a bottom-sheet (responsive stub for now; full mobile layout in Phase 8)
- CO₂ field stubbed as "–" until Phase 6

---

## Phase 6 — CO₂ estimator + stats bar

**What:** Implement the simplified CO₂ model and surface it in the stats bar and flight detail panel.

**Commit:** `feat: add CO₂ estimator and stats bar`

Tasks:

- `composables/useCo2.ts` — narrow-body default (8.5 kg/km scaled by velocity), wide-body lookup by ICAO24 prefix, on-ground → 0; clearly typed, no `any`
- `components/StatsBar.vue` — fixed top bar: aircraft count, highest altitude, fastest aircraft, total CO₂ estimate
- Wire CO₂ per-aircraft into `FlightPanel.vue`
- Add "estimate" disclaimer tooltip on all CO₂ values

---

## Phase 7 — Airport overlay

**What:** Bundle a pre-processed subset of OurAirports data and render medium/large airport markers on the map.

**Commit:** `feat: add airport overlay with nearby flight count`

Tasks:

- Download `airports.csv` from OurAirports; filter to `medium_airport` and `large_airport`; extract `id, name, iata_code, latitude_deg, longitude_deg, type`; save as `src/assets/airports.json`
- `stores/airports.ts` — loads the JSON, exposes a function to count aircraft within 150 km of a given airport
- `components/AirportMarker.vue` — small icon marker; on click shows name, IATA code, nearby aircraft count
- No runtime fetch — pure static import

---

## Phase 8 — Polish: responsiveness, accessibility, error handling

**What:** Make the app production-ready: mobile layout, ARIA, graceful API errors.

**Commit:** `feat: responsive layout, accessibility, and error handling`

Tasks:

- Mobile: `FlightPanel` collapses to a bottom sheet (Tailwind breakpoints)
- `StatsBar` wraps to two rows on narrow screens
- All aircraft markers: `aria-label="[callsign] over [country]"`
- Airport markers: `aria-label="[name] airport ([IATA])"`
- API error banner (non-intrusive toast) when OpenSky is unreachable
- 429 backoff already in composable — surface remaining cooldown in the UI

---

## Phase 9 — Production proxy + deploy + README

**What:** Make the app work in production on GitHub Pages (where the Vite dev proxy is not available), deploy, and write a portfolio README.

**Commits:**

- `feat: add Cloudflare Worker CORS proxy for OpenSky`
- `feat: add GitHub Actions deploy workflow`
- `docs: add README with demo link and screenshot`

### 9a — Cloudflare Worker CORS proxy

The Vite dev proxy works only locally. In production (GitHub Pages, static hosting) the browser hits OpenSky directly and gets CORS-blocked. Solution: a tiny Cloudflare Worker that proxies the request server-side and adds the correct `Access-Control-Allow-Origin` header.

Tasks:

- Create `worker/opensky-proxy.js` — a minimal Cloudflare Worker that:
    - Accepts requests to `https://<worker>.workers.dev/api/states/all?…`
    - Forwards them to `https://opensky-network.org/api/states/all?…`
    - Returns the response with `Access-Control-Allow-Origin: *`
- Update `useOpenSky.ts` to use `import.meta.env.VITE_OPENSKY_PROXY_URL` in production and fall back to the Vite proxy path in dev
- Add `VITE_OPENSKY_PROXY_URL` as a GitHub Actions secret / environment variable
- Document manual Cloudflare Worker deploy steps in the README (free tier, no credit card)

### 9b — GitHub Actions deploy workflow

Tasks:

- Add `.github/workflows/deploy.yml` — checkout → `bun install` → `bun run build` → upload `dist/` → deploy to GitHub Pages
- Set `base` in `vite.config.ts` to the repo name (e.g. `/flight-tracker/`)

### 9c — README

Tasks:

- Short description, tech stack table, live demo link (GitHub Pages URL)
- Screenshot (taken after first successful deploy)
- Local dev instructions (`bun install`, `bun run dev`)
- Note on the Cloudflare Worker proxy and how to set it up

---

## Stretch goals (after Phase 9)

Only if all core features are solid:

- Polyline trail (last 5 positions per aircraft)
- Filter by country / altitude band
- Marker clustering when zoomed out
- Heatmap replay mode with localStorage ring buffer and scrubber

---

## Dependency list (for reference)

```
Runtime:
  vue, vue-router, pinia
  leaflet, @vue-leaflet/vue-leaflet
  tailwindcss, @tailwindcss/vite

Dev:
  vite, @vitejs/plugin-vue
  typescript, vue-tsc
  @types/leaflet
```
