<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet"
import type { Map as LeafletMap } from "leaflet"
import "leaflet/dist/leaflet.css"
import { useOpenSky } from "../composables/useOpenSky"
import { useInterpolation } from "../composables/useInterpolation"
import { useFlightsStore } from "../stores/flights"
import AircraftMarker from "../components/AircraftMarker.vue"
import FlightPanel from "../components/FlightPanel.vue"
import StatsBar from "../components/StatsBar.vue"
import AirportMarker from "../components/AirportMarker.vue"
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
const { positions, start: startInterp, updateFromStore } = useInterpolation()

// Feed interpolation when the aircraft map updates after each poll
watch(
    () => flightsStore.aircraft,
    (aircraft) => updateFromStore(aircraft),
    { deep: false },
)

function onMapReady(map: LeafletMap) {
    startPolling(map)
    startInterp()
    // Initialise airport viewport filter
    const b = map.getBounds()
    airportsStore.setViewBounds(b.getSouth(), b.getNorth(), b.getWest(), b.getEast())
    map.on("moveend", () => {
        const nb = map.getBounds()
        airportsStore.setViewBounds(nb.getSouth(), nb.getNorth(), nb.getWest(), nb.getEast())
    })
}

function onMarkerClick(icao24: string) {
    flightsStore.selectFlight(icao24)
}

const interpolatedList = computed(() => Array.from(positions.value.values()))
</script>

<template>
    <div class="w-full h-dvh relative">
        <LMap :zoom="zoom" :center="center" :use-global-leaflet="false" class="w-full h-full" @ready="onMapReady"
            @click="flightsStore.selectFlight(null)">
            <LTileLayer :url="tileUrl" :attribution="tileAttribution" layer-type="base" name="CartoDB Dark"
                :max-zoom="19" />

            <AircraftMarker v-for="pos in interpolatedList" :key="pos.icao24" :icao24="pos.icao24" :lat="pos.lat"
                :lng="pos.lng" :true-track="pos.trueTrack" :on-ground="pos.onGround"
                :callsign="flightsStore.aircraft.get(pos.icao24)?.callsign ?? null" @click="onMarkerClick" />

            <AirportMarker v-for="ap in airportsStore.visibleAirports" :key="ap.icao" :icao="ap.icao" :iata="ap.iata"
                :name="ap.name" :lat="ap.lat" :lng="ap.lng"
                :nearby-count="airportsStore.nearbyCount(ap, flightsStore.aircraft)" />
        </LMap>

        <StatsBar />
        <FlightPanel />
    </div>
</template>
