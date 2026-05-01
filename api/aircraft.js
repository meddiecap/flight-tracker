/**
 * Vercel Serverless Function — adsb.fi CORS proxy
 *
 * GET /api/aircraft?lat=52.3&lon=4.9&dist=100
 *   → https://opendata.adsb.fi/api/v3/lat/52.3/lon/4.9/dist/100
 *
 * Adds CORS headers so the browser (GitHub Pages, localhost) can call it.
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

export default async function handler(req, res) {
    if (req.method === "OPTIONS") {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(204).end()
    }

    if (req.method !== "GET") {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(405).end("Method Not Allowed")
    }

    const { lat, lon, dist } = req.query
    if (!lat || !lon || !dist) {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(400).json({ error: "Missing lat, lon or dist query params" })
    }

    const upstream = `https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lon}/dist/${dist}`

    let upstreamRes
    try {
        upstreamRes = await fetch(upstream)
    } catch (err) {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(502).json({ error: "Bad Gateway", detail: String(err), cause: String(err?.cause) })
    }

    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader("Content-Type", "application/json")
    res.status(upstreamRes.status)
    return res.end(await upstreamRes.text())
}
