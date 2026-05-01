<script setup lang="ts">
import { computed } from "vue"
import { useFlightsStore } from "../stores/flights"

const store = useFlightsStore()
const flight = computed(() => store.selectedFlight())

function fmt(value: number | null, decimals = 0, unit = ""): string {
    if (value === null) return "—"
    return value.toFixed(decimals) + (unit ? "\u00a0" + unit : "")
}

function heading(deg: number | null): string {
    if (deg === null) return "—"
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[Math.round(deg / 45) % 8] + " " + deg.toFixed(0) + "°"
}

function close() {
    store.selectFlight(null)
}
</script>

<template>
    <Transition name="panel">
        <aside v-if="flight"
            class="absolute top-4 right-4 z-[1000] w-72 rounded-xl bg-slate-900/90 backdrop-blur text-white shadow-2xl ring-1 ring-white/10 overflow-hidden">

            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-sky-700/30">
                <div class="flex items-center gap-2 min-w-0">
                    <!-- plane icon -->
                    <svg class="w-4 h-4 shrink-0 text-sky-300" viewBox="0 0 24 24" fill="currentColor">
                        <path
                            d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
                    </svg>
                    <span class="font-mono font-semibold text-lg tracking-widest truncate">
                        {{ flight.callsign ?? flight.icao24.toUpperCase() }}
                    </span>
                </div>
                <button @click="close"
                    class="text-slate-400 hover:text-white transition-colors ml-2 shrink-0 cursor-pointer"
                    aria-label="Close panel">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Body -->
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm">
                <div>
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">ICAO24</dt>
                    <dd class="font-mono text-slate-100">{{ flight.icao24.toUpperCase() }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">Origin</dt>
                    <dd class="text-slate-100 truncate">{{ flight.originCountry }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">Altitude</dt>
                    <dd class="text-slate-100">{{ fmt(flight.baroAltitude, 0, "m") }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">Speed</dt>
                    <dd class="text-slate-100">{{ fmt(flight.velocity, 0, "m/s") }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">Heading</dt>
                    <dd class="text-slate-100">{{ heading(flight.trueTrack) }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">Vert. rate</dt>
                    <dd :class="[
                        'text-slate-100',
                        flight.verticalRate !== null && flight.verticalRate > 0.5 ? 'text-green-400' :
                            flight.verticalRate !== null && flight.verticalRate < -0.5 ? 'text-red-400' : ''
                    ]">{{ fmt(flight.verticalRate, 1, "m/s") }}</dd>
                </div>
                <div class="col-span-2">
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">Status</dt>
                    <dd class="flex items-center gap-1.5 mt-0.5">
                        <span
                            :class="['inline-block w-2 h-2 rounded-full', flight.onGround ? 'bg-amber-400' : 'bg-sky-400']" />
                        <span class="text-slate-100">{{ flight.onGround ? "On ground" : "Airborne" }}</span>
                    </dd>
                </div>
                <div class="col-span-2 border-t border-white/10 pt-3">
                    <dt class="text-xs text-slate-400 uppercase tracking-wide">CO₂ estimate</dt>
                    <dd class="text-slate-500 italic text-xs mt-0.5">Available in next release</dd>
                </div>
            </dl>
        </aside>
    </Transition>
</template>

<style scoped>
.panel-enter-active,
.panel-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.panel-enter-from,
.panel-leave-to {
    opacity: 0;
    transform: translateX(1rem);
}
</style>
