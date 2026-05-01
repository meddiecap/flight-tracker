/**
 * Vercel Serverless Function — OpenSky states proxy
 *
 * GET /api/states → https://opensky-network.org/api/states/all?…
 *
 * Adds CORS headers so the browser (GitHub Pages, localhost) can call it.
 * Forwards Authorization header for OAuth2 bearer tokens.
 * Passes through Retry-After on 429 responses.
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

export default async function handler(req, res) {
    // CORS preflight
    if (req.method === "OPTIONS") {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(204).end()
    }

    if (req.method !== "GET") {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(405).end("Method Not Allowed")
    }

    // Build upstream URL, forward all query params from the client
    const params = new URLSearchParams(req.query)
    const upstream = `https://opensky-network.org/api/states/all?${params.toString()}`

    const headers = {}
    const auth = req.headers["authorization"]
    if (auth) headers["Authorization"] = auth

    let upstreamRes
    try {
        upstreamRes = await fetch(upstream, { headers })
    } catch (err) {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(502).json({ error: "Bad Gateway", detail: String(err), cause: String(err?.cause), upstream })
    }

    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

    const retryAfter = upstreamRes.headers.get("Retry-After")
    if (retryAfter) res.setHeader("Retry-After", retryAfter)

    res.setHeader("Content-Type", "application/json")
    res.status(upstreamRes.status)

    const body = await upstreamRes.text()
    return res.end(body)
}
