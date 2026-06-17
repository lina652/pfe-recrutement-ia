import { API_BASE_URL } from "../api/authApi"

/** Rewrite localhost/old-origin /media URLs to the current API base (ngrok). */
export function normalizeMediaUrl(url) {
  if (!url) return ""
  try {
    const parsed = new URL(url, API_BASE_URL)
    if (!parsed.pathname.startsWith("/media/")) return url
    const api = new URL(API_BASE_URL)
    return `${api.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

/** Fetch TTS audio with ngrok header (required for free ngrok in the browser). */
export async function loadPlayableAudioUrl(url) {
  const normalized = normalizeMediaUrl(url)
  const res = await fetch(normalized, {
    headers: { "ngrok-skip-browser-warning": "69420" },
  })
  if (!res.ok) {
    throw new Error(`Audio load failed: ${res.status}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
