// chantan:role=admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" }
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: cors })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  try {
    const token = Deno.env.get("META_ACCESS_TOKEN")
    const acct = (Deno.env.get("META_AD_ACCOUNT_ID") || "").replace(/^act_/, "")
    if (!token || !acct) return out({ error: "Clés Meta manquantes" })
    const fields = "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values"
    const body = await req.json().catch(() => ({}))
    const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
    const since = iso(body?.since), until = iso(body?.until)
    const dstr = (d: Date) => d.toISOString().slice(0, 10)
    const endD = until ? new Date(until) : new Date()
    const startD = since ? new Date(since) : new Date(endD.getTime() - 30 * 864e5)
    const chunks: { s: string; u: string }[] = []
    for (let c = new Date(startD); c <= endD; c = new Date(c.getTime() + 7 * 864e5)) {
      const e = new Date(Math.min(c.getTime() + 6 * 864e5, endD.getTime()))
      chunks.push({ s: dstr(c), u: dstr(e) })
    }
    const j: { data: any[] } = { data: [] }
    for (const ch of chunks) {
      const rg = `time_range=${encodeURIComponent(JSON.stringify({ since: ch.s, until: ch.u }))}`
      let next: string | null = `https://graph.facebook.com/v21.0/act_${acct}/insights?level=campaign&fields=${fields}&${rg}&time_increment=1&limit=100&access_token=${token}`
      let pages = 0
      while (next && pages++ < 20) {
        let p: any = null, ok = false
        for (let a = 0; a < 3 && !ok; a++) {
          const r = await fetch(next)
          p = await r.json().catch(() => ({}))
          ok = r.ok
          if (!ok && ![1, 2, 4, 17, 32, 613].includes(p?.error?.code)) break
          if (!ok) await new Promise((res) => setTimeout(res, 1500 * (a + 1)))
        }
        if (!ok) return out({ error: `${p?.error?.message || "Erreur Meta"} (code ${p?.error?.code ?? "?"}${p?.error?.error_subcode ? "/" + p.error.error_subcode : ""}, ${ch.s} → ${ch.u})` })
        j.data.push(...(p.data || []))
        next = p?.paging?.next || null
      }
    }
    const find = (arr: any[] | undefined) => Number((arr || []).find((x) => x.action_type === "purchase" || x.action_type === "omni_purchase")?.value || 0)
    const rows = (j.data || []).map((d: any) => ({
      meta_id: d.campaign_id, name: d.campaign_name, date: d.date_start, spend: Number(d.spend || 0),
      impressions: Number(d.impressions || 0), clicks: Number(d.clicks || 0), purchases: find(d.actions), revenue: find(d.action_values),
    }))
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    if (rows.length) {
      const { data: prev } = await db.from("ad_campaigns").select("meta_id,product_id").not("product_id", "is", null)
      const pm = new Map((prev || []).map((r: any) => [r.meta_id, r.product_id]))
      for (const r of rows as any[]) if (pm.has(r.meta_id)) r.product_id = pm.get(r.meta_id)
      // Attribution automatique : le nom de la campagne contient le nom (ou un mot-clé) d'un produit
      const nk = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
      const { data: prods } = await db.from("products").select("id,name,keywords")
      const terms: { id: string; t: string }[] = []
      for (const p of prods || []) {
        for (const t of [p.name, ...String(p.keywords || "").split(/[,;\n]/)]) { const k = nk(t); if (k.length >= 3) terms.push({ id: p.id, t: k }) }
      }
      terms.sort((a, b) => b.t.length - a.t.length)
      for (const r of rows as any[]) {
        if (r.product_id) continue
        const n = nk(r.name)
        const hit = terms.find((x) => n.includes(x.t))
        if (hit) r.product_id = hit.id
      }
      const { error } = await db.from("ad_campaigns").upsert(rows, { onConflict: "meta_id,date" })
      if (error) return out({ error: error.message })
    }
    return out({ rows: rows.length })
  } catch (e) {
    return out({ error: (e as Error).message }, 500)
  }
})
