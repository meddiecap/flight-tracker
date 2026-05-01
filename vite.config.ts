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
            // OAuth2 token endpoint — must be listed BEFORE /api/opensky to avoid prefix conflict.
            "/api/opensky-auth": {
                target: "https://auth.opensky-network.org",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/opensky-auth/, ""),
            },
            // Proxy OpenSky state vectors through Vite dev server to work around CORS.
            "/api/opensky": {
                target: "https://opensky-network.org",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/opensky/, ""),
            },
        },
    },
})
