/**
 * Manages aircraft markers directly via the Leaflet API — no vue-leaflet involved.
 *
 * Why not <AircraftMarker> / vue-leaflet LMarker?
 * vue-leaflet wraps addLayer() in async promises. Rapid updates (rAF + polls) can
 * resolve those promises on already-unmounted components → "Uncaught (in promise) undefined".
 * Managing markers imperatively sidesteps this entirely.
 */
import L from "leaflet"
import type { Map as LeafletMap, Marker } from "leaflet"
import type { StateVector } from "../stores/flights"

interface Snapshot {
    lat: number
    lng: number
    trueTrack: number
    onGround: boolean
    timestamp: number
}

function lerpAngle(a: number, b: number, t: number): number {
    const diff = ((b - a + 540) % 360) - 180
    return (a + diff * t + 360) % 360
}

function buildIcon(onGround: boolean): L.DivIcon {
    const color = onGround ? "#94a3b8" : "#38bdf8"
    const opacity = onGround ? 0.45 : 1
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
        style="display:block;opacity:${opacity}">
        <path fill="${color}" d="M12 2 L15 10 L22 11 L15 13 L16 20 L12 18 L8 20 L9 13 L2 11 L9 10 Z"/>
    </svg>`
    return L.divIcon({
        html: svg,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    })
}

export function useAircraftLayer() {
    const markers = new Map<string, Marker>()
    const snapshots = new Map<string, { prev: Snapshot; next: Snapshot }>()

    let leafletMap: LeafletMap | null = null
    let onClickCb: ((icao24: string) => void) | null = null
    let rafId: number | null = null

    const POLL_MS = 30_000
    const TARGET_FPS = 15
    const FRAME_MS = 1000 / TARGET_FPS
    let lastFrame = 0

    function tick(timestamp: number) {
        rafId = requestAnimationFrame(tick)
        if (timestamp - lastFrame < FRAME_MS) return
        lastFrame = timestamp

        const now = Date.now()
        for (const [icao24, { prev, next }] of snapshots) {
            const marker = markers.get(icao24)
            if (!marker) continue

            const t = Math.min((now - next.timestamp) / POLL_MS, 1)
            const lat = prev.lat + (next.lat - prev.lat) * t
            const lng = prev.lng + (next.lng - prev.lng) * t
            const trueTrack = lerpAngle(prev.trueTrack, next.trueTrack, t)

            marker.setLatLng([lat, lng])

            // Rotate by mutating the SVG element directly — no new Icon object needed
            const el = marker.getElement()
            const svg = el?.querySelector("svg") as SVGElement | null
            if (svg) svg.style.transform = `rotate(${trueTrack}deg)`
        }
    }

    function mount(map: LeafletMap, onClick: (icao24: string) => void) {
        leafletMap = map
        onClickCb = onClick
        rafId = requestAnimationFrame(tick)
    }

    /** Called after each OpenSky poll with the latest aircraft state. */
    function update(aircraft: Map<string, StateVector>) {
        if (!leafletMap) return

        const now = Date.now()
        const incoming = new Set<string>()

        for (const [icao24, sv] of aircraft) {
            if (sv.latitude == null || sv.longitude == null) continue
            incoming.add(icao24)

            const newSnap: Snapshot = {
                lat: sv.latitude,
                lng: sv.longitude,
                trueTrack: sv.trueTrack ?? 0,
                onGround: sv.onGround,
                timestamp: now,
            }

            const existingSnap = snapshots.get(icao24)
            const existingMarker = markers.get(icao24)

            if (existingSnap && existingMarker) {
                snapshots.set(icao24, {
                    prev: existingSnap.next,
                    next: newSnap,
                })
                // Rebuild icon only when on-ground status changes (rare)
                if (existingSnap.next.onGround !== sv.onGround) {
                    existingMarker.setIcon(buildIcon(sv.onGround))
                }
            } else {
                // New aircraft — create marker and add directly to the Leaflet map
                snapshots.set(icao24, { prev: newSnap, next: newSnap })
                const marker = L.marker([sv.latitude, sv.longitude], {
                    icon: buildIcon(sv.onGround),
                    keyboard: false,
                    alt: sv.callsign ?? icao24,
                })
                const id = icao24
                marker.on("click", () => onClickCb?.(id))
                marker.addTo(leafletMap)
                const el = marker.getElement()
                if (el) {
                    const label = sv.callsign
                        ? `${sv.callsign} over ${sv.originCountry}`
                        : `${icao24.toUpperCase()} over ${sv.originCountry}`
                    el.setAttribute("aria-label", label)
                    el.setAttribute("role", "button")
                    el.setAttribute("tabindex", "0")
                }
                markers.set(icao24, marker)
            }
        }

        // Remove markers for aircraft no longer in the response
        for (const [icao24, marker] of markers) {
            if (!incoming.has(icao24)) {
                marker.remove()
                markers.delete(icao24)
                snapshots.delete(icao24)
            }
        }
    }

    function unmount() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
        for (const marker of markers.values()) marker.remove()
        markers.clear()
        snapshots.clear()
    }

    return { mount, update, unmount }
}
