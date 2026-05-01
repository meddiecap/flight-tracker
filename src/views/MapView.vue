<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue"
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet"
import type { Map as LeafletMap } from "leaflet"
import "leaflet/dist/leaflet.css"
import { useOpenSky } from "../composables/useOpenSky"
import { useAircraftLayer } from "../composables/useAircraftLayer"
import { useAirportLayer } from "../composables/useAirportLayer"
import { useFlightsStore } from "../stores/flights"
import FlightPanel from "../components/FlightPanel.vue"
import StatsBar from "../components/StatsBar.vue"
import ErrorBanner from "../components/ErrorBanner.vue"
import { useAirportsStore } from "../stores/airports"

const zoom = ref(5)
const center = ref<[number, number]>([51.5, 10.0]) // centred over Europe

const tileUrl =
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const tileAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

const flightsStore = useFlightsStore()
const airportsStore = useAirportsStore()
const { start: startPolling } = useOpenSky()
const aircraftLayer = useAircraftLayer()
const airportLayer = useAirportLayer()

// After each poll: update aircraft markers and airports nearby count
watch(
    () => flightsStore.pollVersion,
    () => {
        aircraftLayer.update(flightsStore.aircraft)
        airportsStore.setAircraft(flightsStore.aircraft)
    },
)

// Sync airport markers whenever visible set or nearby counts change
watch(
    () => [airportsStore.visibleAirports, airportsStore.nearbyCountMap] as const,
    ([airports, countMap]) => {
        airportLayer.setVisible(airports, countMap)
    },
)

function onMapReady(map: LeafletMap) {
    startPolling(map)
    aircraftLayer.mount(map, (icao24) => flightsStore.selectFlight(icao24))
    airportLayer.mount(map)
    const syncBounds = () => {
        const b = map.getBounds()
        airportsStore.setViewBounds(b.getSouth(), b.getNorth(), b.getWest(), b.getEast())
        airportsStore.setZoom(map.getZoom())
    }
    syncBounds()
    map.on("moveend", syncBounds)
    map.on("zoomend", syncBounds)
}

onUnmounted(() => {
    aircraftLayer.unmount()
    airportLayer.unmount()
})
</script>

<template>
    <div class="w-full h-dvh relative">
        <LMap :zoom="zoom" :center="center" :use-global-leaflet="false" class="w-full h-full" @ready="onMapReady"
            @click="flightsStore.selectFlight(null)">
            <LTileLayer :url="tileUrl" :attribution="tileAttribution" layer-type="base" name="CartoDB Dark"
                :max-zoom="19" />

        </LMap>

        <StatsBar />
        <FlightPanel />
        <ErrorBanner />
    </div>
</template>
