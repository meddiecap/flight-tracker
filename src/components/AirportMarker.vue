<script setup lang="ts">
import { computed } from "vue"
import { LMarker, LTooltip } from "@vue-leaflet/vue-leaflet"
import L, { type Icon, type IconOptions } from "leaflet"

const props = defineProps<{
    icao: string
    iata: string
    name: string
    lat: number
    lng: number
    nearbyCount: number
}>()

const icon = computed(() => {
    const hasFlights = props.nearbyCount > 0
    const color = hasFlights ? "#fbbf24" : "#94a3b8"
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>
        <text x="11" y="15" text-anchor="middle" font-size="10" font-family="monospace" fill="${color}" font-weight="bold">◆</text>
    </svg>`
    return L.divIcon({
        html: svg,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    }) as unknown as Icon<IconOptions>
})

</script>

<template>
    <LMarker :lat-lng="[lat, lng]" :icon="icon"
        :aria-label="`Airport: ${name} (${iata || icao}), ${nearbyCount} nearby flights`">
        <LTooltip :options="{ direction: 'top', offset: [0, -8], opacity: 0.95 }">
            <div class="text-xs leading-snug">
                <div class="font-bold">{{ name }}</div>
                <div class="text-slate-400">{{ iata ? `IATA: ${iata}` : '' }} {{ icao ? `ICAO: ${icao}` : '' }}</div>
                <div v-if="nearbyCount > 0" class="text-amber-400 mt-0.5">{{ nearbyCount }} aircraft within 150 km</div>
            </div>
        </LTooltip>
    </LMarker>
</template>
