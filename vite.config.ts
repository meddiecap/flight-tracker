import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
    // Set base to the GitHub repository name so asset paths work on GitHub Pages.
    // Override with VITE_BASE_URL env var for other hosting targets.
    base:
        (process.env.VITE_BASE_URL as string | undefined) ?? "/flight-tracker/",
    plugins: [vue(), tailwindcss()],
    server: {
        proxy: {
            // Proxy adsb.fi through Vite dev server to work around CORS on localhost.
            "/api/adsb-fi": {
                target: "https://opendata.adsb.fi/api",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/adsb-fi/, ""),
            },
        },
    },
})
