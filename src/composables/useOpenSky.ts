import { ref, onUnmounted } from "vue"
import type { Map as LeafletMap } from "leaflet"
import { useFlightsStore, parseVector } from "../stores/flights"
import type { RawVector } from "../stores/flights"

const POLL_INTERVAL_MS = 30_000

// In production, VITE_OPENSKY_PROXY_URL points to the Cloudflare Worker
// (e.g. https://opensky-proxy.<subdomain>.workers.dev).
// In dev, fall back to the Vite dev-server proxy path.
const PROXY_BASE =
    (import.meta.env.VITE_OPENSKY_PROXY_URL as string | undefined)?.replace(
        /\/$/,
        "",
    ) ?? ""
const STATES_URL = PROXY_BASE
    ? `${PROXY_BASE}/api/states/all`
    : "/api/opensky/api/states/all"

// OAuth2 token endpoint.
// In dev: proxied via Vite to avoid CORS on localhost.
// In production: the auth server allows cross-origin POST directly.
const TOKEN_URL = PROXY_BASE
    ? "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
    : "/api/opensky-auth/auth/realms/opensky-network/protocol/openid-connect/token"

// --- Module-level token cache (one token shared across all composable instances) ---
let cachedToken: string | null = null
let tokenExpiresAt = 0 // Unix ms
const TOKEN_REFRESH_MARGIN_MS = 60_000

async function getToken(): Promise<string | null> {
    const clientId = import.meta.env.VITE_OPENSKY_CLIENT_ID as
        | string
        | undefined
    const clientSecret = import.meta.env.VITE_OPENSKY_CLIENT_SECRET as
        | string
        | undefined

    if (!clientId || !clientSecret) return null // anonymous fallback

    if (cachedToken && Date.now() < tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
        return cachedToken
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
    })

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    })

    if (!res.ok) {
        console.warn(
            "[OpenSky] Token fetch failed:",
            res.status,
            res.statusText,
        )
        return null
    }

    const data = (await res.json()) as {
        access_token: string
        expires_in: number
    }
    cachedToken = data.access_token
    tokenExpiresAt = Date.now() + data.expires_in * 1000
    return cachedToken
}

/** Minimum viewport change (degrees) before triggering an early re-fetch */
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
            const token = await getToken()
            const headers: Record<string, string> = {}
            if (token) headers["Authorization"] = `Bearer ${token}`

            const res = await fetch(`${STATES_URL}?${params.toString()}`, {
                headers,
            })

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
                backoffMs = Math.min(backoffMs * 2, 120_000)
                scheduleNext()
                return
            }

            const json = (await res.json()) as {
                time: number
                states: RawVector[] | null
            }

            store.clearRateLimit()
            store.setError(null)
            backoffMs = POLL_INTERVAL_MS

            if (json.states) {
                store.updateAircraft(json.states.map(parseVector))
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
