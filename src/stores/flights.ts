import { defineStore } from "pinia"
import { ref, triggerRef } from "vue"

/**
 * Normalised aircraft state — altitude/geoAltitude in metres, velocity in m/s, verticalRate in m/s.
 * Sourced from the OpenSky Network REST API (https://opensky-network.org/api/states/all).
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
 * Raw positional array (state vector) as returned by the OpenSky REST API.
 * https://openskynetwork.github.io/opensky-api/rest.html#response
 */
export type RawVector = [
    string, // 0  icao24
    string | null, // 1  callsign
    string, // 2  origin_country
    number | null, // 3  time_position
    number, // 4  last_contact
    number | null, // 5  longitude
    number | null, // 6  latitude
    number | null, // 7  baro_altitude  (metres)
    boolean, // 8  on_ground
    number | null, // 9  velocity       (m/s)
    number | null, // 10 true_track     (degrees)
    number | null, // 11 vertical_rate  (m/s)
    number[] | null, // 12 sensors
    number | null, // 13 geo_altitude   (metres)
    string | null, // 14 squawk
    boolean, // 15 spi
    number, // 16 position_source
]

export function parseVector(raw: RawVector): StateVector {
    return {
        icao24: raw[0],
        callsign: raw[1]?.trim() || null,
        originCountry: raw[2],
        timePosition: raw[3],
        lastContact: raw[4],
        longitude: raw[5],
        latitude: raw[6],
        baroAltitude: raw[7],
        onGround: raw[8],
        velocity: raw[9],
        trueTrack: raw[10],
        verticalRate: raw[11],
        sensors: raw[12],
        geoAltitude: raw[13],
        squawk: raw[14],
        spi: raw[15],
        positionSource: raw[16],
        category: null,
        registration: null,
        aircraftType: null,
    }
}

export const useFlightsStore = defineStore("flights", () => {
    const aircraft = ref<Map<string, StateVector>>(new Map())
    const selectedIcao24 = ref<string | null>(null)
    const fetchError = ref<string | null>(null)
    const isRateLimited = ref(false)
    const rateLimitCooldownUntil = ref(0)

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
        updateAircraft,
        selectFlight,
        setError,
        setRateLimit,
        clearRateLimit,
        selectedFlight,
    }
})
