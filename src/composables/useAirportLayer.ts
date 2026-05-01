/**
 * Manages airport markers directly via the Leaflet API — same pattern as useAircraftLayer.
 * Avoids vue-leaflet async addLayer() promises that crash on rapid viewport changes.
 */
import L from "leaflet"
import type { Map as LeafletMap, Marker } from "leaflet"
import type { Airport } from "../stores/airports"

function buildIcon(hasFlights: boolean): L.DivIcon {
    const color = hasFlights ? "#fbbf24" : "#94a3b8"
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>
        <text x="11" y="15" text-anchor="middle" font-size="10" font-family="monospace" fill="${color}" font-weight="bold">◆</text>
    </svg>`
    return L.divIcon({ html: svg, className: "", iconSize: [22, 22], iconAnchor: [11, 11] })
}

function buildTooltip(ap: Airport, nearbyCount: number): string {
    const meta = [ap.iata ? `IATA: ${ap.iata}` : "", ap.icao ? `ICAO: ${ap.icao}` : ""]
        .filter(Boolean)
        .join(" · ")
    const flights =
        nearbyCount > 0
            ? `<div style="color:#fbbf24;margin-top:2px">${nearbyCount} aircraft within 150 km</div>`
            : ""
    return `<div style="font-size:12px;line-height:1.4">
        <div style="font-weight:600">${ap.name}</div>
        <div style="color:#94a3b8">${meta}</div>
        ${flights}
    </div>`
}

export function useAirportLayer() {
    const markers = new Map<string, Marker>()
    const nearbyCounts = new Map<string, number>()
    let leafletMap: LeafletMap | null = null

    function mount(map: LeafletMap) {
        leafletMap = map
    }

    /** Called when the visible airports set changes (viewport/zoom change). */
    function setVisible(airports: Airport[], countMap: Map<string, number>) {
        if (!leafletMap) return

        const incoming = new Set<string>()

        for (const ap of airports) {
            incoming.add(ap.icao)
            const count = countMap.get(ap.icao) ?? 0
            const prevCount = nearbyCounts.get(ap.icao)
            const existing = markers.get(ap.icao)

            if (existing) {
                // Update icon and tooltip only when nearby count changes
                if (prevCount !== count) {
                    existing.setIcon(buildIcon(count > 0))
                    existing.setTooltipContent(buildTooltip(ap, count))
                    nearbyCounts.set(ap.icao, count)
                }
            } else {
                // New marker
                const marker = L.marker([ap.lat, ap.lng], {
                    icon: buildIcon(count > 0),
                    keyboard: false,
                    alt: `${ap.name} (${ap.iata || ap.icao})`,
                })
                marker.bindTooltip(buildTooltip(ap, count), {
                    direction: "top",
                    offset: [0, -8],
                    opacity: 0.95,
                    className: "leaflet-airport-tooltip",
                })
                marker.addTo(leafletMap)
                markers.set(ap.icao, marker)
                nearbyCounts.set(ap.icao, count)
            }
        }

        // Remove markers that left the viewport
        for (const icao of markers.keys()) {
            if (!incoming.has(icao)) {
                markers.get(icao)!.remove()
                markers.delete(icao)
                nearbyCounts.delete(icao)
            }
        }
    }

    function unmount() {
        for (const marker of markers.values()) marker.remove()
        markers.clear()
        nearbyCounts.clear()
    }

    return { mount, setVisible, unmount }
}
