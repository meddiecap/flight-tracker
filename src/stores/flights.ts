import { defineStore } from "pinia"
import { ref, triggerRef } from "vue"

/**
 * Normalised aircraft state — altitude/geoAltitude in metres, velocity in m/s, verticalRate in m/s.
 * Sourced from the adsb.fi open data API (https://opendata.adsb.fi/api/).
 */
export interface StateVector {
    icao24: string
    callsign: string | null
    originCountry: string
    timePosition: number | null
    lastContact: number
    longitude: number | null
    latitude: number | null
    baroAltitude: number | null // metres
    onGround: boolean
    velocity: number | null // m/s
    trueTrack: number | null // degrees
    verticalRate: number | null // m/s
    sensors: number[] | null
    geoAltitude: number | null // metres
    squawk: string | null
    spi: boolean
    positionSource: number
    category: string | null
    registration: string | null
    aircraftType: string | null
}

/**
 * Aircraft object as returned by the adsb.fi v3 REST API.
 * Fields use ADSBexchange v2 naming convention.
 */
export interface AdsbFiAircraft {
    hex: string
    type?: string
    flight?: string // callsign, space-padded
    r?: string // registration
    t?: string // ICAO type code (e.g. "B738")
    desc?: string // human-readable type description
    alt_baro?: number | "ground" // barometric alt in feet, or "ground"
    alt_geom?: number // geometric alt in feet
    gs?: number // ground speed in knots
    track?: number // true track in degrees
    baro_rate?: number // vertical rate in ft/min
    lat?: number
    lon?: number
    squawk?: string
    spi?: number // 0 or 1
    category?: string // "A0"–"C7"
    seen?: number // seconds since last message
    seen_pos?: number // seconds since last position
    emergency?: string
}

const FT_TO_M = 0.3048
const KT_TO_MS = 0.514444
const FPM_TO_MS = 0.00508

export function parseAdsbFiAircraft(ac: AdsbFiAircraft): StateVector {
    const onGround = ac.alt_baro === "ground"
    const baroFt = typeof ac.alt_baro === "number" ? ac.alt_baro : null

    // positionSource: 0 = ADS-B, 2 = MLAT
    const positionSource = ac.type?.startsWith("mlat") ? 2 : 0

    return {
        icao24: ac.hex.toLowerCase(),
        callsign: ac.flight?.trim() || null,
        originCountry: "",
        timePosition:
            ac.seen_pos != null ? Date.now() / 1000 - ac.seen_pos : null,
        lastContact:
            ac.seen != null ? Date.now() / 1000 - ac.seen : Date.now() / 1000,
        longitude: ac.lon ?? null,
        latitude: ac.lat ?? null,
        baroAltitude: onGround ? 0 : baroFt != null ? baroFt * FT_TO_M : null,
        onGround,
        velocity: ac.gs != null ? ac.gs * KT_TO_MS : null,
        trueTrack: ac.track ?? null,
        verticalRate: ac.baro_rate != null ? ac.baro_rate * FPM_TO_MS : null,
        sensors: null,
        geoAltitude: ac.alt_geom != null ? ac.alt_geom * FT_TO_M : null,
        squawk: ac.squawk ?? null,
        spi: ac.spi === 1,
        positionSource,
        category: ac.category ?? null,
        registration: ac.r ?? null,
        aircraftType: ac.t ?? null,
    }
}

export const useFlightsStore = defineStore("flights", () => {
    const aircraft = ref<Map<string, StateVector>>(new Map())
    const selectedIcao24 = ref<string | null>(null)
    const fetchError = ref<string | null>(null)
    const isRateLimited = ref(false)
    const rateLimitCooldownUntil = ref(0)
    const pollVersion = ref(0)

    function updateAircraft(vectors: StateVector[]) {
        const map = aircraft.value
        const incoming = new Set<string>()
        for (const v of vectors) {
            incoming.add(v.icao24)
            map.set(v.icao24, v)
        }
        // Remove aircraft no longer in the response
        for (const key of map.keys()) {
            if (!incoming.has(key)) map.delete(key)
        }
        // Manually trigger reactivity — ref does not track Map mutations
        triggerRef(aircraft)
        pollVersion.value++
    }

    function selectFlight(icao24: string | null) {
        selectedIcao24.value = icao24
    }

    function setError(msg: string | null) {
        fetchError.value = msg
    }

    function setRateLimit(retryAfterMs: number) {
        isRateLimited.value = true
        rateLimitCooldownUntil.value = Date.now() + retryAfterMs
    }

    function clearRateLimit() {
        isRateLimited.value = false
        rateLimitCooldownUntil.value = 0
    }

    const selectedFlight = () =>
        selectedIcao24.value
            ? (aircraft.value.get(selectedIcao24.value) ?? null)
            : null

    return {
        aircraft,
        selectedIcao24,
        fetchError,
        isRateLimited,
        rateLimitCooldownUntil,
        pollVersion,
        updateAircraft,
        selectFlight,
        setError,
        setRateLimit,
        clearRateLimit,
        selectedFlight,
    }
})
