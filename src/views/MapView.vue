<script setup lang="ts">
import { ref } from "vue"
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet"
import "leaflet/dist/leaflet.css"

const zoom = ref(5)
const center = ref<[number, number]>([51.5, 10.0]) // centred over Europe

const tileUrl =
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const tileAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
</script>

<template>
    <div class="w-full h-dvh">
        <LMap :zoom="zoom" :center="center" :use-global-leaflet="false" class="w-full h-full">
            <LTileLayer :url="tileUrl" :attribution="tileAttribution" layer-type="base" name="CartoDB Dark"
                :max-zoom="19" />
        </LMap>
    </div>
</template>
