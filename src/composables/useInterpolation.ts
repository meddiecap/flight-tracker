import { shallowRef, reactive, onUnmounted } from "vue"
import type { StateVector } from "../stores/flights"

export interface InterpolatedPosition {
    icao24: string
    lat: number
    lng: number
    trueTrack: number
    onGround: boolean
}

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

export function useInterpolation() {
    const snapshots = new Map<string, { prev: Snapshot; next: Snapshot }>()

    /**
     * Each aircraft gets its own reactive() object.
     * The rAF tick mutates individual objects → only THAT aircraft's LMarker re-renders.
     * The array itself only changes when aircraft are added/removed (every 30s poll).
     */
    const positionMap = new Map<string, InterpolatedPosition>()
    const positions = shallowRef<InterpolatedPosition[]>([])

    let rafId: number | null = null
    const POLL_INTERVAL_MS = 30_000
    const TARGET_FPS = 15
    const FRAME_MS = 1000 / TARGET_FPS
    let lastFrameTime = 0

    function tick(timestamp: number) {
        rafId = requestAnimationFrame(tick)
        if (timestamp - lastFrameTime < FRAME_MS) return
        lastFrameTime = timestamp

        const now = Date.now()
        for (const [icao24, { prev, next: snap }] of snapshots) {
            const pos = positionMap.get(icao24)
            if (!pos) continue
            const t = Math.min((now - snap.timestamp) / POLL_INTERVAL_MS, 1)
            // Direct property mutation on reactive() object — only this marker re-renders
            pos.lat = prev.lat + (snap.lat - prev.lat) * t
            pos.lng = prev.lng + (snap.lng - prev.lng) * t
            pos.trueTrack = lerpAngle(prev.trueTrack, snap.trueTrack, t)
            pos.onGround = snap.onGround
        }
    }

    function start() {
        if (rafId !== null) return
        rafId = requestAnimationFrame(tick)
    }

    function stop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
    }

    /**
     * Called after each OpenSky poll. Adds/removes aircraft from the reactive array.
     * Individual position objects are reused across polls so LMarkers are never remounted.
     */
    function updateFromStore(aircraft: Map<string, StateVector>) {
        const now = Date.now()
        const incoming = new Set<string>()
        let arrayChanged = false

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

            const existing = snapshots.get(icao24)
            if (existing) {
                snapshots.set(icao24, { prev: existing.next, next: newSnap })
            } else {
                snapshots.set(icao24, { prev: newSnap, next: newSnap })
                // New aircraft — create a reactive position object and add to array
                const pos = reactive<InterpolatedPosition>({
                    icao24,
                    lat: sv.latitude,
                    lng: sv.longitude,
                    trueTrack: sv.trueTrack ?? 0,
                    onGround: sv.onGround,
                })
                positionMap.set(icao24, pos)
                arrayChanged = true
            }
        }

        // Remove aircraft no longer in view
        for (const key of snapshots.keys()) {
            if (!incoming.has(key)) {
                snapshots.delete(key)
                positionMap.delete(key)
                arrayChanged = true
            }
        }

        // Only rebuild the array (and trigger v-for diff) when aircraft set changes
        if (arrayChanged) {
            positions.value = Array.from(positionMap.values())
        }
    }

    onUnmounted(stop)

    return { positions, start, stop, updateFromStore }
}
