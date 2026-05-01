/**
 * Manages airport markers directly via the Leaflet API — same pattern as useAircraftLayer.
 * Avoids vue-leaflet async addLayer() promises that crash on rapid viewport changes.
 *
 * Tooltip strategy: one shared standalone L.Tooltip, manually shown/hidden via DOM
 * mouseenter/mouseleave. This prevents Leaflet's internal tooltip state machine from
 * drifting when markers are rapidly added/removed (pan, zoom, polls).
 */
import L from "leaflet"
import type { Map as LeafletMap, Marker, Tooltip } from "leaflet"
import type { Airport } from "../stores/airports"

function buildIcon(hasFlights: boolean): L.DivIcon {
    const color = hasFlights ? "#fbbf24" : "#94a3b8"
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>
        <text x="11" y="15" text-anchor="middle" font-size="10" font-family="monospace" fill="${color}" font-weight="bold">◆</text>
    </svg>`
    return L.divIcon({
        html: svg,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    })
}

function buildTooltip(ap: Airport, nearbyCount: number): string {
    const meta = [
        ap.iata ? `IATA: ${ap.iata}` : "",
        ap.icao ? `ICAO: ${ap.icao}` : "",
    ]
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
    // Latest tooltip HTML per airport — updated without reopening the tooltip
    const tooltipHtml = new Map<string, string>()
    let leafletMap: LeafletMap | null = null
    // Singleton tooltip: only one airport tooltip can ever be visible at a time
    let sharedTooltip: Tooltip | null = null
    let hoveredIcao: string | null = null

    function mount(map: LeafletMap) {
        leafletMap = map
        // Put airport markers below the default markerPane (z-index 600) so aircraft
        // markers are always the top-most event target when they overlap an airport.
        if (!map.getPane("airportPane")) {
            const pane = map.createPane("airportPane")
            pane.style.zIndex = "500"
            pane.style.pointerEvents = "none"
        }
        sharedTooltip = L.tooltip({
            direction: "top",
            offset: [0, -8],
            opacity: 0.95,
            className: "leaflet-airport-tooltip",
        })
    }

    function attachHoverHandlers(icao: string, marker: Marker) {
        const el = marker.getElement()
        if (!el) return
        el.addEventListener("mouseenter", () => {
            if (!leafletMap || !sharedTooltip) return
            hoveredIcao = icao
            const html = tooltipHtml.get(icao) ?? ""
            sharedTooltip.setContent(html)
            sharedTooltip.setLatLng(marker.getLatLng())
            sharedTooltip.addTo(leafletMap)
        })
        el.addEventListener("mouseleave", () => {
            hoveredIcao = null
            sharedTooltip?.remove()
        })
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
                // Update colour and tooltip content only when nearby count changes.
                // Mutate SVG DOM directly — avoids marker.setIcon() which calls
                // Leaflet's _initIcon() (DOM detach → reattach).
                if (prevCount !== count) {
                    const el = existing.getElement()
                    const color = count > 0 ? "#fbbf24" : "#94a3b8"
                    const circle = el?.querySelector<SVGCircleElement>("circle")
                    const text = el?.querySelector<SVGTextElement>("text")
                    if (circle) {
                        circle.setAttribute("stroke", color)
                        circle.setAttribute("fill", color)
                    }
                    if (text) text.setAttribute("fill", color)
                    const html = buildTooltip(ap, count)
                    tooltipHtml.set(ap.icao, html)
                    // If this airport is currently being hovered, update the live tooltip
                    if (hoveredIcao === ap.icao) sharedTooltip?.setContent(html)
                    nearbyCounts.set(ap.icao, count)
                }
            } else {
                // New marker — no bindTooltip; tooltip is managed via the shared singleton
                const html = buildTooltip(ap, count)
                tooltipHtml.set(ap.icao, html)
                const marker = L.marker([ap.lat, ap.lng], {
                    icon: buildIcon(count > 0),
                    keyboard: false,
                    alt: `${ap.name} (${ap.iata || ap.icao})`,
                    pane: "airportPane",
                })
                marker.addTo(leafletMap)
                const el = marker.getElement()
                if (el) {
                    el.setAttribute(
                        "aria-label",
                        `${ap.name} airport (${ap.iata || ap.icao})`,
                    )
                    el.setAttribute("role", "img")
                }
                attachHoverHandlers(ap.icao, marker)
                markers.set(ap.icao, marker)
                nearbyCounts.set(ap.icao, count)
            }
        }

        // Remove markers that left the viewport. Collect first to avoid mutating
        // the Map while iterating it.
        const toRemove: string[] = []
        for (const icao of markers.keys()) {
            if (!incoming.has(icao)) toRemove.push(icao)
        }
        for (const icao of toRemove) {
            // Close the shared tooltip if this was the hovered airport
            if (hoveredIcao === icao) {
                sharedTooltip?.remove()
                hoveredIcao = null
            }
            markers.get(icao)!.remove()
            markers.delete(icao)
            nearbyCounts.delete(icao)
            tooltipHtml.delete(icao)
        }
    }

    function unmount() {
        sharedTooltip?.remove()
        for (const marker of markers.values()) marker.remove()
        markers.clear()
        nearbyCounts.clear()
        tooltipHtml.clear()
        nearbyCounts.clear()
    }

    return { mount, setVisible, unmount }
}
