<script setup lang="ts">
import { computed } from "vue"
import { LMarker } from "@vue-leaflet/vue-leaflet"
import L, { type Icon, type IconOptions } from "leaflet"

const props = defineProps<{
    icao24: string
    lat: number
    lng: number
    trueTrack: number
    onGround: boolean
    callsign: string | null
}>()

const emit = defineEmits<{
    click: [icao24: string]
}>()

/**
 * Build a Leaflet DivIcon containing an inline SVG plane silhouette.
 * The outer <div> is rotated to the true-track heading via CSS transform.
 */
const icon = computed(() => {
    const opacity = props.onGround ? 0.45 : 1
    const color = props.onGround ? "#94a3b8" : "#38bdf8"

    // Simple top-down aircraft silhouette as an inline SVG path
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
     style="transform:rotate(${props.trueTrack}deg);opacity:${opacity};display:block">
  <path fill="${color}"
    d="M12 2 L15 10 L22 11 L15 13 L16 20 L12 18 L8 20 L9 13 L2 11 L9 10 Z"/>
</svg>`

    return L.divIcon({
        html: svg,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    }) as unknown as Icon<IconOptions>
})

const latLng = computed<[number, number]>(() => [props.lat, props.lng])

const label = computed(
    () => props.callsign ?? props.icao24,
)
</script>

<template>
    <LMarker :lat-lng="latLng" :icon="icon" :options="{ alt: `Aircraft ${label}`, keyboard: false }"
        @click="emit('click', icao24)" />
</template>
