import { ref, onUnmounted } from "vue"
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

/**
 * Linearly interpolates between two snapshots.
 * t = 0 → prev position, t = 1 → next position.
 */
function lerpAngle(a: number, b: number, t: number): number {
    // Shortest-path interpolation around the 0/360 boundary
    let diff = ((b - a + 540) % 360) - 180
    return (a + diff * t + 360) % 360
}

export function useInterpolation() {
    // Keyed by icao24: the last two known positions
    const snapshots = new Map<string, { prev: Snapshot; next: Snapshot }>()

    // The reactive output: interpolated positions for all tracked aircraft
    const positions = ref<Map<string, InterpolatedPosition>>(new Map())

    let rafId: number | null = null
    const POLL_INTERVAL_MS = 30_000 // must match useOpenSky
    const TARGET_FPS = 15
    const FRAME_MS = 1000 / TARGET_FPS
    let lastFrameTime = 0

    function tick(timestamp: number) {
        rafId = requestAnimationFrame(tick)
        if (timestamp - lastFrameTime < FRAME_MS) return
        lastFrameTime = timestamp

        const now = Date.now()
        const next = new Map<string, InterpolatedPosition>()

        for (const [icao24, { prev, next: snap }] of snapshots) {
            const elapsed = now - snap.timestamp
            // t goes from 0→1 over one poll interval, clamped so we never overshoot
            const t = Math.min(elapsed / POLL_INTERVAL_MS, 1)
            next.set(icao24, {
                icao24,
                lat: prev.lat + (snap.lat - prev.lat) * t,
                lng: prev.lng + (snap.lng - prev.lng) * t,
                trueTrack: lerpAngle(prev.trueTrack, snap.trueTrack, t),
                onGround: snap.onGround,
            })
        }

        positions.value = next
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
     * Called after each OpenSky poll. Feeds new positions into the snapshot store.
     * Aircraft that disappeared from the response are removed.
     */
    function updateFromStore(aircraft: Map<string, StateVector>) {
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

            const existing = snapshots.get(icao24)
            if (existing) {
                // Advance: old "next" becomes "prev", new data becomes "next"
                snapshots.set(icao24, { prev: existing.next, next: newSnap })
            } else {
                // First sighting: both prev and next are the same point (no interpolation yet)
                snapshots.set(icao24, { prev: newSnap, next: newSnap })
            }
        }

        // Remove aircraft no longer in view
        for (const key of snapshots.keys()) {
            if (!incoming.has(key)) snapshots.delete(key)
        }
    }

    onUnmounted(stop)

    return { positions, start, stop, updateFromStore }
}
