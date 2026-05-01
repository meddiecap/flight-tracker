/**
 * Cloudflare Worker — OpenSky Network CORS proxy
 *
 * Proxied endpoints:
 *   GET  /api/states/all?…  → https://opensky-network.org/api/states/all?…
 *   POST /api/token         → https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token
 *
 * Both responses get Access-Control-Allow-Origin: * so the browser can reach
 * them from any origin (GitHub Pages, localhost, etc.).
 *
 * Deploy:
 *   bunx wrangler deploy worker/opensky-proxy.js --name opensky-proxy --compatibility-date 2024-01-01
 */

const OPENSKY_BASE = "https://opensky-network.org"
const AUTH_TOKEN_URL =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

export default {
    async fetch(request) {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS })
        }

        const url = new URL(request.url)

        // --- Token endpoint proxy ---
        if (url.pathname === "/api/token") {
            if (request.method !== "POST") {
                return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS })
            }
            let upstreamRes
            try {
                upstreamRes = await fetch(AUTH_TOKEN_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: await request.text(),
                })
            } catch {
                return new Response("Bad Gateway", { status: 502, headers: CORS_HEADERS })
            }
            return new Response(upstreamRes.body, {
                status: upstreamRes.status,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            })
        }

        // --- States endpoint proxy ---
        if (!url.pathname.startsWith("/api/states/all")) {
            return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
        }

        if (request.method !== "GET") {
            return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS })
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
