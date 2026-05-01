<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue"
import { useFlightsStore } from "../stores/flights"

const store = useFlightsStore()

const cooldownSec = ref(0)
let intervalId: ReturnType<typeof setInterval> | null = null

function updateCooldown() {
    cooldownSec.value = Math.max(
        0,
        Math.ceil((store.rateLimitCooldownUntil - Date.now()) / 1000),
    )
}

watch(
    () => store.isRateLimited,
    (limited) => {
        if (limited) {
            updateCooldown()
            intervalId = setInterval(updateCooldown, 1000)
        } else {
            if (intervalId !== null) {
                clearInterval(intervalId)
                intervalId = null
            }
        }
    },
    { immediate: true },
)

onUnmounted(() => {
    if (intervalId !== null) clearInterval(intervalId)
})

const message = computed<string | null>(() => {
    if (store.isRateLimited) {
        return `OpenSky rate limit — retrying in ${cooldownSec.value}s`
    }
    if (store.fetchError) {
        return `OpenSky unreachable: ${store.fetchError}`
    }
    return null
})
</script>

<template>
    <Transition name="banner">
        <div v-if="message"
            class="absolute bottom-4 left-4 z-1000 max-w-[min(22rem,calc(100vw-2rem))] rounded-lg bg-amber-950/90 backdrop-blur text-amber-100 text-xs px-3 py-2.5 shadow-xl ring-1 ring-amber-500/30 flex items-start gap-2"
            role="alert" aria-live="polite">
            <svg class="w-4 h-4 shrink-0 text-amber-400 mt-px" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>{{ message }}</span>
        </div>
    </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
}

.banner-enter-from,
.banner-leave-to {
    opacity: 0;
    transform: translateY(0.5rem);
}
</style>
