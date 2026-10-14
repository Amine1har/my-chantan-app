// chantan:role=admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } })
const DEFAULT_LIMIT = 50

// Début de la journée (heure du Maroc, UTC+1)
const dayStart = () => {
  const now = new Date(Date.now() + 3600_000)
  now.setUTCHours(0, 0, 0, 0)
  return new Date(now.getTime() - 3600_000).toISOString()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  try {
    const b = await req.json().catch(() => ({}))
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: s } = await db.from("studio_settings").select("value").eq("key", "gemini_daily_limit").maybeSingle()
    const limit = s?.value != null && s.value !== "" ? Number(s.value) : DEFAULT_LIMIT
    const { count } = await db.from("studio_usage").select("id", { count: "exact", head: true }).gte("created_at", dayStart())
    const used = count || 0
    const hasKey = !!Deno.env.get("GEMINI_API_KEY")

    if (b.action === "usage") return json({ used, limit, hasKey })

    if (b.action === "set_limit") {
      const n = Math.max(0, Math.floor(Number(b.limit) || 0))
      const { error } = await db.from("studio_settings").upsert({ key: "gemini_daily_limit", value: String(n), updated_at: new Date().toISOString() })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, used, limit: n })
    }

    if (b.action === "generate") {
      const key = Deno.env.get("GEMINI_API_KEY")
      if (!key) return json({ error: "Clé Google AI Studio (GEMINI_API_KEY) manquante" }, 400)
      if (limit > 0 && used >= limit) return json({ error: `Quota journalier atteint (${used}/${limit} requêtes). Il se réinitialise demain, ou augmentez-le dans Templates.`, quota: true, used, limit }, 429)
      const isImage = b.mode === "image"
      const model = String(b.model || (isImage ? "gemini-3.1-flash-image" : "gemini-3.8-flash"))
      const parts: Record<string, unknown>[] = [{ text: String(b.prompt || "") }]
      const m = String(b.image || "").match(/^data:([^;]+);base64,(.+)$/)
      if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } })
      const body: Record<string, unknown> = { contents: [{ parts }] }
      if (b.system && !isImage) body.system_instruction = { parts: [{ text: String(b.system) }] }
      body.generationConfig = isImage
        ? { responseModalities: ["TEXT", "IMAGE"] }
        : { temperature: Number(b.temperature ?? 0.7), maxOutputTokens: Number(b.max_tokens || 1000) }
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        console.log("[gemini] status", r.status, JSON.stringify(d).slice(0, 500))
        return json({ error: `Google AI Studio (${r.status}) : ${d?.error?.message || "erreur inconnue"}` }, 400)
      }
      const outParts = d?.candidates?.[0]?.content?.parts || []
      const text = outParts.map((p: { text?: string }) => p.text || "").join("").trim()
      const img = outParts.find((p: { inlineData?: unknown; inline_data?: unknown }) => p.inlineData || p.inline_data)
      const idata = img?.inlineData || img?.inline_data
      if (isImage && !idata) return json({ error: "Aucune image renvoyée par Gemini. " + (text || (d?.promptFeedback?.blockReason ? "Bloqué : " + d.promptFeedback.blockReason : "")) }, 400)
      if (!isImage && !text) return json({ error: "Réponse vide de Gemini" }, 400)
      await db.from("studio_usage").insert({ kind: isImage ? "image" : "text", model })
      return json({
        text,
        image: idata ? `data:${idata.mimeType || idata.mime_type || "image/png"};base64,${idata.data}` : null,
        used: used + 1, limit,
      })
    }
    return json({ error: "Action inconnue" }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
