import { ref, onUnmounted } from "vue"
import type { Map as LeafletMap } from "leaflet"
import { useFlightsStore, parseAdsbFiAircraft } from "../stores/flights"
import type { AdsbFiAircraft } from "../stores/flights"

const POLL_INTERVAL_MS = 30_000

// In production, VITE_OPENSKY_PROXY_URL points to the Vercel deployment URL.
// In dev, the Vite dev server proxies /api/adsb-fi → https://opendata.adsb.fi/api.
const PROXY_BASE =
    (import.meta.env.VITE_OPENSKY_PROXY_URL as string | undefined)?.replace(
        /\/$/,
        "",
    ) ?? ""

const ADSB_FI_BASE = PROXY_BASE ? `${PROXY_BASE}/api/aircraft` : "/api/adsb-fi"

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

/** Convert a map bounding box to a lat/lon/dist query for the adsb.fi v3 API. */
function bboxToLatLonDist(bbox: BBox): {
    lat: number
    lon: number
    distNm: number
} {
    const lat = (bbox.lamin + bbox.lamax) / 2
    const lon = (bbox.lomin + bbox.lomax) / 2
    // Half-diagonal of bbox in nautical miles (1° lat ≈ 60 NM)
    const dLatNm = ((bbox.lamax - bbox.lamin) / 2) * 60
    const dLonNm =
        ((bbox.lomax - bbox.lomin) / 2) * 60 * Math.cos((lat * Math.PI) / 180)
    const distNm = Math.min(
        Math.ceil(Math.sqrt(dLatNm ** 2 + dLonNm ** 2)),
        250,
    )
    return { lat, lon, distNm }
}

/** Minimum viewport change (degrees) before triggering an early re-fetch */
const BBOX_CHANGE_THRESHOLD = 0.5

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

        const { lat, lon, distNm } = bboxToLatLonDist(bbox)
        // In dev: /api/adsb-fi/v3/lat/.../lon/.../dist/... (Vite proxy)
        // In prod: /api/aircraft?lat=...&lon=...&dist=... (Vercel function)
        const url = PROXY_BASE
            ? `${ADSB_FI_BASE}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&dist=${distNm}`
            : `${ADSB_FI_BASE}/v3/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${distNm}`

        try {
            const res = await fetch(url)

            if (res.status === 429) {
                // adsb.fi doesn't send Retry-After, use fixed backoff
                const retryMs = 60_000
                store.setRateLimit(retryMs)
                backoffMs = retryMs
                scheduleNext()
                return
            }

            if (!res.ok) {
                store.setError(
                    `adsb.fi API error: ${res.status} ${res.statusText}`,
                )
                backoffMs = Math.min(backoffMs * 2, 120_000)
                scheduleNext()
                return
            }

            const json = (await res.json()) as { ac?: AdsbFiAircraft[] }

            store.clearRateLimit()
            store.setError(null)
            backoffMs = POLL_INTERVAL_MS

            store.updateAircraft(
                (json.ac ?? [])
                    .filter((ac) => ac.lat != null && ac.lon != null)
                    .map(parseAdsbFiAircraft),
            )
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

    function onMapMoved() {
        if (!mapInstance) return
        const bbox = bboxFromMap(mapInstance)
        if (bboxChanged(lastBBox, bbox)) {
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
