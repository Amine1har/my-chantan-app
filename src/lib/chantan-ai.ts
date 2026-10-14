// ChanTan AI — built-in AI for your app. No API key needed; Chantan provides the
// models and bills the project owner's AI credits.
//
//   import { chantanAI } from "@/lib/chantan-ai"
//   const { text } = await chantanAI.chat({ messages: [{ role: "user", content: "Hi" }] })
//   const reply = await chantanAI.complete("Summarize: " + article)
//   const { image } = await chantanAI.image({ prompt: "a red sports car at sunset" })
//   const { image } = await chantanAI.image({ prompt: "make it a cartoon", image: dataUrl }) // image→image
//
// Models (optional `model`, omit for the default):
//   text  → "google/gemini-2.5-flash" (default) · "anthropic/claude-sonnet-4.5" (smart)
//   image → "google/gemini-2.5-flash-image" (default) · "openai/gpt-5-image" (quality)
//   vision (analyze a photo) → chantanAI.vision({ image, prompt })

const API_BASE =
  (typeof window !== "undefined" && (window as any).__CHANTAN_API_URL__) ||
  (import.meta as any).env?.VITE_API_URL ||
  "https://chantanapi.chantan.one"

function projectId(): string {
  if (typeof window !== "undefined") {
    const fromGlobal = (window as any).__CHANTAN_PROJECT_ID__
    if (fromGlobal) return String(fromGlobal)
    const fromMeta = document.querySelector('meta[name="chantan:project-id"]')
    if (fromMeta) return fromMeta.getAttribute("content") || ""
  }
  return ""
}

// Downscale a base64 data-URL image to <= MAX_EDGE px (longest side) and re-encode
// as JPEG before upload. A raw phone photo is 4–12MB; its base64 form can exceed
// the gateway's request limit (→ rejected before the model runs → empty result)
// and is slow to upload. The AI models work at ~1024px anyway, so this is loss-less
// for quality and turns a 12MB upload into ~150KB. Runs in the browser, on the
// actual upload — so it protects EVERY app without the app having to resize.
// https:// URLs and non-data inputs pass through untouched.
const MAX_EDGE = 1024
async function shrinkImage(input: string, maxEdge: number = MAX_EDGE): Promise<string> {
  if (typeof document === "undefined") return input        // SSR / non-browser
  if (typeof input !== "string" || !input.startsWith("data:image/")) return input
  try {
    const blob = await (await fetch(input)).blob()
    // `imageOrientation: from-image` also fixes EXIF-rotated phone photos.
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" } as any)
    const longest = Math.max(bmp.width, bmp.height)
    const scale = Math.min(1, maxEdge / longest)
    // Already small enough AND a light payload → keep as-is.
    if (scale >= 1 && input.length < 1_200_000) { bmp.close?.(); return input }
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) { bmp.close?.(); return input }
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    return canvas.toDataURL("image/jpeg", 0.85)
  } catch {
    return input   // never block the AI call because resizing failed
  }
}

/** Resize a photo (data URL) to <= maxEdge px (JPEG) before uploading it to YOUR
 *  OWN edge function / API. chantanAI.image()/vision() already do this internally —
 *  use this only when you POST a user photo somewhere else. https:// and non-data
 *  inputs pass through unchanged; never throws. */
export async function resizeImageForAI(dataUrl: string, maxEdge: number = MAX_EDGE): Promise<string> {
  return shrinkImage(dataUrl, maxEdge)
}

class AiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message); this.status = status; this.code = code
  }
}

async function post(path: string, body: any): Promise<any> {
  // Chantan injects a signed per-project token into the served HTML; sending it
  // proves the call comes from a page Chantan itself served (Origin is forgeable).
  const tok = typeof window !== "undefined" ? (window as any).__CHANTAN_AI_TOKEN__ : ""
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Chantan-Project-Id": projectId(),
      ...(tok ? { "X-Chantan-Ai-Token": String(tok) } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || `AI request failed (${res.status})`
    throw new AiError(msg, res.status, data?.error)
  }
  return data
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export const chantanAI = {
  /** Chat / text generation. Returns { text, model, usage }. */
  async chat(opts: { messages: ChatMessage[]; model?: string; max_tokens?: number; temperature?: number }): Promise<{ text: string; model: string; usage: { input: number; output: number } }> {
    return post("/api/chantan-ai/chat", opts)
  },

  /** Convenience: one prompt in, the reply text out. */
  async complete(prompt: string, opts?: { model?: string; system?: string }): Promise<string> {
    const messages: ChatMessage[] = []
    if (opts?.system) messages.push({ role: "system", content: opts.system })
    messages.push({ role: "user", content: prompt })
    const r = await this.chat({ messages, model: opts?.model })
    return r.text
  },

  /** Image generation (text→image) or editing (image→image if `image` given).
   *  The input photo is auto-resized for reliable, fast uploads — keep passing
   *  `image` for edits (haircut, cartoon, background swap…); never drop it.
   *  Retries once if the model returns no image. Returns { image } (a data URL). */
  async image(opts: { prompt: string; image?: string; model?: string }): Promise<{ image: string; model: string }> {
    const body = opts.image ? { ...opts, image: await shrinkImage(opts.image) } : opts
    try {
      return await post("/api/chantan-ai/image", body)
    } catch (e) {
      // Retry ONCE on a transient empty/upstream result — not on bad-request,
      // out-of-credits, rate-limit, or model-not-supported (retrying won't help).
      const err = e as AiError
      const transient = err.status === 502 || err.code === "no_image" || err.code === "ai_upstream" || !err.status
      if (!transient) throw e
      return await post("/api/chantan-ai/image", body)
    }
  },

  /** Vision (image→text): analyze / understand / read an uploaded image. `image`
   *  is a data URL or https URL. Returns { text } — what the AI sees/extracts. */
  async vision(opts: { image: string; prompt?: string; model?: string }): Promise<{ text: string; model: string }> {
    return post("/api/chantan-ai/vision", { ...opts, image: await shrinkImage(opts.image) })
  },
}

export default chantanAI
