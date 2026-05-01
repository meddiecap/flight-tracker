<script setup lang="ts">
import { computed } from "vue"
import { useFlightsStore } from "../stores/flights"
import { sumCo2 } from "../composables/useCo2"

const store = useFlightsStore()

const stats = computed(() => {
    const aircraft = store.aircraft
    let highestAlt: number | null = null
    let fastestSpeed: number | null = null

    for (const ac of aircraft.values()) {
        if (ac.baroAltitude !== null && (highestAlt === null || ac.baroAltitude > highestAlt)) {
            highestAlt = ac.baroAltitude
        }
        if (ac.velocity !== null && (fastestSpeed === null || ac.velocity > fastestSpeed)) {
            fastestSpeed = ac.velocity
        }
    }

    return {
        count: aircraft.size,
        highestAlt,
        fastestSpeed,
        co2Total: sumCo2(aircraft),
    }
})

function fmtAlt(m: number | null): string {
    if (m === null) return "\u2014"
    return m.toFixed(0) + "\u00a0m"
}

function fmtSpeed(ms: number | null): string {
    if (ms === null) return "\u2014"
    return ms.toFixed(0) + "\u00a0m/s"
}

function fmtCo2(kghr: number): string {
    if (kghr < 1000) return kghr.toFixed(0) + "\u00a0kg/h"
    return (kghr / 1000).toFixed(1) + "\u00a0t/h"
}
</script>

<template>
    <div
        class="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center rounded-xl bg-slate-900/85 backdrop-blur ring-1 ring-white/10 shadow-xl text-white overflow-hidden text-sm whitespace-nowrap">

        <!-- Aircraft count -->
        <div class="flex items-center gap-1.5 px-4 py-2.5">
            <svg class="w-3.5 h-3.5 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
            </svg>
            <span class="font-semibold tabular-nums">{{ stats.count }}</span>
            <span class="text-slate-400 text-xs">aircraft</span>
        </div>

        <div class="w-px h-6 bg-white/10" />

        <!-- Max altitude -->
        <div class="flex items-center gap-1.5 px-4 py-2.5">
            <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            <span class="font-semibold tabular-nums">{{ fmtAlt(stats.highestAlt) }}</span>
            <span class="text-slate-400 text-xs">max alt</span>
        </div>

        <div class="w-px h-6 bg-white/10" />

        <!-- Max speed -->
        <div class="flex items-center gap-1.5 px-4 py-2.5">
            <svg class="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="font-semibold tabular-nums">{{ fmtSpeed(stats.fastestSpeed) }}</span>
            <span class="text-slate-400 text-xs">max speed</span>
        </div>

        <div class="w-px h-6 bg-white/10" />

        <!-- CO₂ total with disclaimer tooltip -->
        <div class="flex items-center gap-1.5 px-4 py-2.5 group relative">
            <svg class="w-3.5 h-3.5 text-green-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 3.5S2 16 2 16s1-11.5 15-8z" />
            </svg>
            <span class="font-semibold tabular-nums">{{ fmtCo2(stats.co2Total) }}</span>
            <span class="text-slate-400 text-xs">CO₂ est.</span>
            <!-- Hover disclaimer -->
            <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-slate-800 text-slate-300 text-xs px-3 py-2 shadow-lg ring-1 ring-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Rough estimate only — not scientifically accurate. Based on a simplified
                velocity-scaled emission model.
                <span
                    class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
            </div>
        </div>
    </div>
</template>
