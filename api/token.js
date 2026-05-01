/**
 * Vercel Serverless Function — OpenSky OAuth2 token proxy
 *
 * POST /api/token → https://auth.opensky-network.org/…/token
 *
 * Adds CORS headers so the browser can POST from any origin.
 */

const AUTH_TOKEN_URL =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

export default async function handler(req, res) {
    // CORS preflight
    if (req.method === "OPTIONS") {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(204).end()
    }

    if (req.method !== "POST") {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(405).end("Method Not Allowed")
    }

    // Read raw body (sent as application/x-www-form-urlencoded)
    const body = await new Promise((resolve) => {
        let data = ""
        req.on("data", (chunk) => { data += chunk })
        req.on("end", () => resolve(data))
    })

    let upstreamRes
    try {
        upstreamRes = await fetch(AUTH_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        })
    } catch (err) {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(502).end("Bad Gateway")
    }

    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader("Content-Type", "application/json")
    res.status(upstreamRes.status)

    const responseBody = await upstreamRes.text()
    return res.end(responseBody)
}
