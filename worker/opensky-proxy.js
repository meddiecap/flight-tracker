/**
 * Cloudflare Worker — OpenSky Network CORS proxy
 *
 * Forwards requests to https://opensky-network.org/api/states/all and adds
 * the correct CORS headers so the browser can call it from any origin.
 *
 * Deploy (free tier, no credit card needed):
 *   1. npx wrangler login
 *   2. npx wrangler deploy worker/opensky-proxy.js --name opensky-proxy --compatibility-date 2024-01-01
 *
 * The worker URL will be something like:
 *   https://opensky-proxy.<your-subdomain>.workers.dev
 *
 * Set that URL as the VITE_OPENSKY_PROXY_URL secret in GitHub Actions
 * (Settings → Secrets → Actions → New repository secret).
 *
 * Auth note: the Worker forwards the Authorization header unchanged, so
 * OAuth2 bearer tokens obtained by the client still work transparently.
 */

const OPENSKY_BASE = "https://opensky-network.org"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

export default {
    async fetch(request) {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS })
        }

        if (request.method !== "GET") {
            return new Response("Method Not Allowed", { status: 405 })
        }

        const url = new URL(request.url)

        // Only allow the states/all endpoint — block any other path
        if (!url.pathname.startsWith("/api/states/all")) {
            return new Response("Not Found", { status: 404 })
        }

        const upstream = new URL(OPENSKY_BASE)
        upstream.pathname = url.pathname.replace(/^\/api/, "")
        upstream.search = url.search

        // Forward Authorization header if present (for OAuth2 bearer tokens)
        const headers = {}
        const auth = request.headers.get("Authorization")
        if (auth) headers["Authorization"] = auth

        let upstreamRes
        try {
            upstreamRes = await fetch(upstream.toString(), { headers })
        } catch {
            return new Response("Bad Gateway", { status: 502, headers: CORS_HEADERS })
        }

        // Pass through 429 Retry-After so the client-side backoff still works
        const responseHeaders = { ...CORS_HEADERS }
        const retryAfter = upstreamRes.headers.get("Retry-After")
        if (retryAfter) responseHeaders["Retry-After"] = retryAfter

        return new Response(upstreamRes.body, {
            status: upstreamRes.status,
            headers: responseHeaders,
        })
    },
}
