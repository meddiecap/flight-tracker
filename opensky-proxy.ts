/**
 * Deno Deploy — OpenSky Network CORS proxy
 *
 * Proxied endpoints:
 *   GET  /api/states/all?…  → https://opensky-network.org/api/states/all?…
 *   POST /api/token         → https://auth.opensky-network.org/…/token
 *
 * Deploy via Deno Deploy playground (https://dash.deno.com/new):
 *   Paste this file as the entry point, or link to the GitHub repo and
 *   set the entry point to "worker/opensky-proxy-deno.ts".
 */

const OPENSKY_BASE = "https://opensky-network.org"
const AUTH_TOKEN_URL =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

Deno.serve(async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    // --- Token endpoint proxy ---
    if (url.pathname === "/api/token") {
        if (request.method !== "POST") {
            return new Response("Method Not Allowed", {
                status: 405,
                headers: CORS_HEADERS,
            })
        }
        try {
            const upstream = await fetch(AUTH_TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: await request.text(),
            })
            const body = await upstream.arrayBuffer()
            return new Response(body, {
                status: upstream.status,
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                },
            })
        } catch {
            return new Response("Bad Gateway", {
                status: 502,
                headers: CORS_HEADERS,
            })
        }
    }

    // --- States endpoint proxy ---
    if (!url.pathname.startsWith("/api/states/all")) {
        return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: CORS_HEADERS,
        })
    }

    const upstream = new URL(OPENSKY_BASE + "/api/states/all")
    upstream.search = url.search

    const headers: Record<string, string> = {}
    const auth = request.headers.get("Authorization")
    if (auth) headers["Authorization"] = auth

    try {
        const upstreamRes = await fetch(upstream.toString(), { headers })
        const body = await upstreamRes.arrayBuffer()
        const responseHeaders: Record<string, string> = { ...CORS_HEADERS }
        const retryAfter = upstreamRes.headers.get("Retry-After")
        if (retryAfter) responseHeaders["Retry-After"] = retryAfter
        return new Response(body, {
            status: upstreamRes.status,
            headers: responseHeaders,
        })
    } catch {
        return new Response("Bad Gateway", {
            status: 502,
            headers: CORS_HEADERS,
        })
    }
})
