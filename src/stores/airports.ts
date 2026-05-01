import { defineStore } from "pinia"
import { ref, computed } from "vue"
import airportsRaw from "../assets/airports.json"

export interface Airport {
    icao: string
    iata: string
    name: string
    lat: number
    lng: number
}

// Cast the static JSON import
const ALL_AIRPORTS = airportsRaw as Airport[]

/** Haversine distance in km between two lat/lng points */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const useAirportsStore = defineStore("airports", () => {
    // Viewport bounding box — updated by MapView on move/zoom
    const viewBounds = ref<{ lamin: number; lamax: number; lomin: number; lomax: number } | null>(null)

    // Airports visible in current viewport (with small padding so markers near edges show)
    const visibleAirports = computed<Airport[]>(() => {
        const b = viewBounds.value
        if (!b) return []
        const pad = 1
        return ALL_AIRPORTS.filter(
            (a) =>
                a.lat >= b.lamin - pad &&
                a.lat <= b.lamax + pad &&
                a.lng >= b.lomin - pad &&
                a.lng <= b.lomax + pad,
        )
    })

    function setViewBounds(lamin: number, lamax: number, lomin: number, lomax: number) {
        viewBounds.value = { lamin, lamax, lomin, lomax }
    }

    /** Count aircraft within radiusKm of a given airport */
    function nearbyCount(
        airport: Airport,
        aircraft: Map<string, { latitude: number | null; longitude: number | null }>,
        radiusKm = 150,
    ): number {
        let count = 0
        for (const ac of aircraft.values()) {
            if (ac.latitude === null || ac.longitude === null) continue
            if (distanceKm(airport.lat, airport.lng, ac.latitude, ac.longitude) <= radiusKm) {
                count++
            }
        }
        return count
    }

    return { visibleAirports, setViewBounds, nearbyCount }
})
