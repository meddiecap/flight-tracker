import { ref, onUnmounted } from "vue"
import type { Map as LeafletMap } from "leaflet"
import { useFlightsStore } from "../stores/flights"
import { parseVector } from "../stores/flights"

const POLL_INTERVAL_MS = 10_000
const BASE_URL = "https://opensky-network.org/api/states/all"

/** Minimum viewport change (degrees) before a re-fetch is triggered on pan/zoom */
const BBOX_CHANGE_THRESHOLD = 0.5

interface BBox {
    lamin: number
    lamax: number
    lomin: number
    lomax: number
}

function bboxFromMap(map: LeafletMap): BBox {
    const b = map.getBounds()
    return {
        lamin: b.getSouth(),
        lamax: b.getNorth(),
        lomin: b.getWest(),
        lomax: b.getEast(),
    }
}

function bboxChanged(prev: BBox | null, next: BBox): boolean {
    if (!prev) return true
    return (
        Math.abs(prev.lamin - next.lamin) > BBOX_CHANGE_THRESHOLD ||
        Math.abs(prev.lamax - next.lamax) > BBOX_CHANGE_THRESHOLD ||
        Math.abs(prev.lomin - next.lomin) > BBOX_CHANGE_THRESHOLD ||
        Math.abs(prev.lomax - next.lomax) > BBOX_CHANGE_THRESHOLD
    )
}

export function useOpenSky() {
    const store = useFlightsStore()

    const isFetching = ref(false)
    let timerId: ReturnType<typeof setTimeout> | null = null
    let mapInstance: LeafletMap | null = null
    let lastBBox: BBox | null = null
    let backoffMs = POLL_INTERVAL_MS

    async function fetchStates(bbox: BBox) {
        if (isFetching.value) return
        isFetching.value = true

        const params = new URLSearchParams({
            lamin: String(bbox.lamin),
            lamax: String(bbox.lamax),
            lomin: String(bbox.lomin),
            lomax: String(bbox.lomax),
        })

        try {
            const res = await fetch(`${BASE_URL}?${params.toString()}`)

            if (res.status === 429) {
                const retryAfter = parseInt(
                    res.headers.get("Retry-After") ?? "60",
                    10,
                )
                const retryMs = retryAfter * 1000
                store.setRateLimit(retryMs)
                backoffMs = retryMs
                scheduleNext()
                return
            }

            if (!res.ok) {
                store.setError(
                    `OpenSky API error: ${res.status} ${res.statusText}`,
                )
                backoffMs = Math.min(backoffMs * 2, 120_000) // exponential backoff, cap 2 min
                scheduleNext()
                return
            }

            const json = (await res.json()) as {
                time: number
                states: unknown[] | null
            }

            store.clearRateLimit()
            store.setError(null)
            backoffMs = POLL_INTERVAL_MS

            if (json.states) {
                const vectors = (
                    json.states as Parameters<typeof parseVector>[0][]
                ).map((raw) => parseVector(raw))
                store.updateAircraft(vectors)
            } else {
                store.updateAircraft([])
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Network error"
            store.setError(msg)
            backoffMs = Math.min(backoffMs * 2, 120_000)
        } finally {
            isFetching.value = false
            scheduleNext()
        }
    }

    function scheduleNext() {
        if (timerId !== null) clearTimeout(timerId)
        timerId = setTimeout(() => poll(), backoffMs)
    }

    function poll() {
        if (!mapInstance) return
        const bbox = bboxFromMap(mapInstance)
        lastBBox = bbox
        fetchStates(bbox)
    }

    /** Call this when map pans or zooms to check if a re-fetch is needed. */
    function onMapMoved() {
        if (!mapInstance) return
        const bbox = bboxFromMap(mapInstance)
        if (bboxChanged(lastBBox, bbox)) {
            // Cancel scheduled poll, fetch immediately with new bbox
            if (timerId !== null) clearTimeout(timerId)
            lastBBox = bbox
            fetchStates(bbox)
        }
    }

    function start(map: LeafletMap) {
        mapInstance = map
        poll()
        map.on("moveend", onMapMoved)
    }

    function stop() {
        if (timerId !== null) {
            clearTimeout(timerId)
            timerId = null
        }
        if (mapInstance) {
            mapInstance.off("moveend", onMapMoved)
            mapInstance = null
        }
    }

    onUnmounted(stop)

    return { start, stop, isFetching }
}
