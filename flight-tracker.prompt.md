---
mode: agent
description: Bootstrap a live flight tracker as a portfolio project
---

Build a browser-based live flight tracker as a portfolio project. The app shows real aircraft moving across an interactive map, fed by a free public WebSocket/REST data source.

## Tech stack

- **Frontend:** Vue 3 + TypeScript + Pinia + Vue Router
- **Styling:** Tailwind CSS
- **Map:** Leaflet.js (`leaflet` + `@vue-leaflet/vue-leaflet`) — lightweight, no API key required
- **Real-time data:** OpenSky Network REST API (polling every 10s, free, no auth for anonymous use) — `https://opensky-network.org/api/states/all`
- **Smooth movement:** Interpolate aircraft positions between poll intervals using `requestAnimationFrame`
- **Airport data:** OurAirports free CSV dataset (`airports.csv` from [ourairports.com/data](https://ourairports.com/data/)) — bundled as a static asset, no API key
- **CO₂ estimation:** Own calculation based on aircraft velocity, altitude, and a static ICAO24 hex → aircraft category lookup table
- **Persistence:** None required — purely live state

## Why OpenSky instead of a WebSocket

OpenSky's anonymous tier is REST-only (10s polling). This is fine — interpolation makes movement look continuous. Do not use a paid ADS-B API. Keep it free and deployable without secrets.

## Core features

1. **Live aircraft map**
   Render all aircraft returned by the OpenSky API as SVG markers rotated to their true track heading. Update positions every 10 seconds, interpolate between updates so planes glide smoothly rather than jump.

2. **Flight detail panel**
   Click any aircraft to open a side panel showing: callsign, origin country, altitude (m), velocity (m/s), heading, vertical rate, and on-ground status. Panel closes when clicking elsewhere on the map.

3. **Bounding box filter**
   Only fetch aircraft within the current map viewport (use `lamin`, `lamax`, `lomin`, `lomax` query params). Re-fetch when the user pans or zooms significantly. This keeps response sizes small and avoids rate limiting.

4. **Stats bar**
   Fixed bar at the top: total aircraft visible, highest altitude in view, fastest aircraft in view, and live CO₂ total for all aircraft in view (see feature 6). Updates on each poll.

5. **Airport overlay**
   Parse and bundle `airports.csv` from OurAirports as a static JSON asset at build time. Render airport markers (medium and large airports only) on the map. On click, show airport name, IATA code, and a live count of aircraft within 150 km. Do not fetch this at runtime — import it as a static asset bundled with the app.

6. **Live CO₂ estimator**
   For each airborne aircraft in view, estimate CO₂ output in kg/hour using this simplified model:
    - Narrow-body (default): 8.5 kg CO₂/km at cruise, scaled by `velocity / 250 m/s`
    - Wide-body (if ICAO24 prefix matches known heavy categories): 15 kg CO₂/km
    - On-ground aircraft: 0
      Sum all estimates for a "total CO₂ in view" figure displayed in the stats bar and in the flight detail panel per aircraft. Clearly label all values as **estimates** with a disclaimer tooltip. Do not present these numbers as scientifically accurate.

## Project structure

```
src/
  composables/
    useOpenSky.ts         # polling loop, bbox logic, rate limit handling
    useInterpolation.ts   # smooth position interpolation between polls
    useCo2.ts             # CO₂ estimation logic per aircraft
  stores/
    flights.ts            # live aircraft state, selected flight
    airports.ts           # parsed OurAirports data, nearby airport lookups
  views/
    MapView.vue           # full-screen map layout
  components/
    AircraftMarker.vue    # SVG marker rotated to heading
    AirportMarker.vue     # airport icon with nearby flight count
    FlightPanel.vue       # side panel with flight details + CO₂ estimate
    StatsBar.vue          # top stats bar including CO₂ total
  assets/
    airports.json         # pre-processed OurAirports CSV (medium + large only)
```

## Quality requirements

- TypeScript strict mode, no `any`
- All polling and state in Pinia + composables — no logic in components
- Graceful handling of API errors and rate limit responses (429 → backoff)
- No API keys or secrets anywhere — must deploy to GitHub Pages as a static site
- Responsive: panel collapses to a bottom sheet on mobile
- Accessible aircraft markers: `aria-label` with callsign

## What NOT to build

- No flight history or route playback
- No airline/airport database lookups
- No 3D rendering (keep it 2D map)
- No authentication or user accounts

## Stretch goals (only after core is working)

- Fading polyline trail behind each aircraft (last 5 positions)
- Filter by country of origin or altitude band
- Cluster markers when zoomed out far
- Dark/light map tile toggle (use CartoDB dark tiles by default)
- **Heatmap replay mode** — accumulate all polled positions during the session in a ring buffer stored in localStorage (cap at ~2 hours of data, evict oldest entries when the buffer is full). Add a replay toggle in the UI: when active, pause live updates and play back the session history as a heatmap using `leaflet.heat`. Areas with dense traffic glow brighter; busy flight corridors become visible over time. Include a scrubber to jump to any point in the recorded session. Store positions as `[lat, lng, intensity]` tuples where intensity is derived from vertical rate (climbing/descending aircraft weighted lower than cruising ones).

## Deliverables for the portfolio

- Deployed to GitHub Pages
- README with a short description, tech stack, live demo link, and a screenshot
- Clean git history with meaningful commits
