import type { StateVector } from "../stores/flights"

/**
 * Rough ICAO24 3-hex-char prefixes for operators known to predominantly fly
 * wide-body aircraft (Emirates, Etihad, Cathay Pacific, Singapore Airlines, …).
 * This is a simplified heuristic — not a complete aircraft registration database.
 */
const WIDE_BODY_PREFIXES: string[] = [
    "896", // UAE (Emirates, Etihad)
    "06a", // Qatar Airways
    "780", // Hong Kong (Cathay Pacific)
    "48a", // Singapore Airlines
    "710", // China (CAAC wide-body long-haul)
]

/**
 * Returns true when the aircraft is likely a wide-body / heavy type.
 * Priority: OpenSky category field → ICAO24 prefix heuristic.
 * OpenSky category 5 = Heavy, 7 = High vortex large.
 */
function isWidebody(ac: StateVector): boolean {
    if (ac.category !== null) {
        const cat = Number(ac.category)
        if (cat === 5 || cat === 7) return true
    }
    const prefix = ac.icao24.toLowerCase()
    return WIDE_BODY_PREFIXES.some((p) => prefix.startsWith(p))
}

/**
 * Estimate CO₂ output in **kg/hour** for a single aircraft.
 *
 * Model (simplified — for illustration only, not scientifically accurate):
 *   base_rate  = 8.5 kg/km  (narrow-body)  |  15 kg/km (wide-body)
 *   co2_kg_hr  = velocity_km_h × base_rate × (velocity_m_s / 250)
 *
 * On-ground aircraft and those with no velocity data return 0.
 */
export function estimateCo2(ac: StateVector): number {
    if (ac.onGround || ac.velocity === null || ac.velocity <= 0) return 0
    const baseRate = isWidebody(ac) ? 15 : 8.5
    const velocityKmh = ac.velocity * 3.6
    const scale = ac.velocity / 250
    return velocityKmh * baseRate * scale
}

/**
 * Sum CO₂ estimates (kg/hour) across all aircraft in the provided map.
 */
export function sumCo2(aircraft: Map<string, StateVector>): number {
    let total = 0
    for (const ac of aircraft.values()) {
        total += estimateCo2(ac)
    }
    return total
}

export function useCo2() {
    return { estimateCo2, sumCo2 }
}
