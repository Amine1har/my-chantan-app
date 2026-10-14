// chantan:role=admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } })

function mapStatus(t: string): string | null {
  const s = (t || "").toLowerCase()
  if (!s) return null
  if (/non\s*livr|pas\s*livr|refus|injoign|[ée]chec|annul/.test(s)) return "non_livre"
  if (/retour/.test(s)) return "retourne"
  if (/livr|deliver/.test(s)) return "livre"
  if (/transit|cours|exp[ée]di|ramass|sortie|shipped|pickup|distribution/.test(s)) return "en_transit"
  return null
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ",") { row.push(cur); cur = "" }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = "" }
    else if (c !== "\r") cur += c
  }
  row.push(cur); rows.push(row)
  return rows
}

function sheetCsvUrl(u: string) {
  const m = u.match(/\/spreadsheets\/d\/([^/]+)/)
  if (!m || u.includes("output=csv") || u.includes("format=csv")) return u
  const gid = u.match(/gid=(\d+)/)?.[1]
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`
}

function normPhone(p: string): string {
  let s = String(p || "").replace(/[\s.\-()]/g, "")
  if (s.startsWith("+212")) s = "0" + s.slice(4)
  else if (s.startsWith("00212")) s = "0" + s.slice(5)
  else if (s.startsWith("212") && s.length >= 11) s = "0" + s.slice(3)
  else if (/^[5-7]\d{8}$/.test(s)) s = "0" + s
  return s
}

const pick = (o: any, path: string) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  try {
    const { carrier_id, push, order_ids } = await req.json().catch(() => ({}))
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    let cq = db.from("carriers").select("*").eq("active", true).neq("type", "manuel")
    if (carrier_id) cq = cq.eq("id", carrier_id)
    const { data: carriers } = await cq
    let updated = 0; let pushed = 0; const errors: string[] = []
    for (const c of carriers || []) {
      const apiStatuses = new Map<string, string>()
      try {
        if (c.type === "nevada") {
          const url = (c.sheet_url || "").trim()
          if (!url) throw new Error("URL du script Google (Apps Script) manquante")
          if (!c.api_key) throw new Error("Clé secrète du script manquante")
          const call = async (payload: Record<string, unknown>) => {
            const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ token: c.api_key, ...payload }), redirect: "follow" })
            const j = await r.json().catch(() => null)
            if (!r.ok || !j) throw new Error(`Réponse invalide du Google Sheet (${r.status}) — vérifiez le déploiement du script`)
            if (j.error) throw new Error(String(j.error))
            return j
          }
          const norm = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
          const list = String(c.cities || "").split(/[\n,]/).map(norm).filter(Boolean)
          const casaRe = /casa|mohammedia|bouskoura|nouaceur|mediouna|dar bouazza|berrechid|settat|benslimane|ain harrouda|tit mellil|bernoussi|ain sebaa|sidi maarouf|ain chock|had soualem/
          const inZone = (city: string) => { const n = norm(city); return !!n && (list.length ? list.some((x) => n.includes(x) || x.includes(n)) : casaRe.test(n)) }
          if (push) {
            const { data: cand } = await db.from("orders").select("*").in("status", ["confirmee", "expediee"])
            let sel = (cand || []).filter((o: any) => o.carrier === c.name || ((!o.carrier || !String(o.carrier).trim()) && inZone(o.city)))
            if (Array.isArray(order_ids) && order_ids.length) sel = sel.filter((o: any) => order_ids.includes(o.id))
            if (sel.length) {
              const rows = sel.map((o: any) => ({
                number: o.number || "", name: o.customer_name || "", phone: normPhone(o.phone || "").replace(/^0/, ""), city: o.city || "", address: o.address || "",
                source: o.source === "shopify" ? "SHOPIFY ORDERS" : "WHATSAPP ORDERS",
                etat: o.is_exchange ? "Échange" : "Normal",
                lines: (o.items || []).map((i: any) => ({ name: i.name || "", color: i.color || "", size: i.size || "", price: Number(i.price) || 0, qty: Number(i.qty) || 1 })),
                total: Number(o.total) || 0,
              }))
              await call({ action: "upsert", rows })
              for (const o of sel) {
                await db.from("orders").update({ carrier: c.name, tracking_number: o.number, updated_at: new Date().toISOString() }).eq("id", o.id)
              }
              pushed += sel.length
            }
          }
          const res = await call({ action: "statuses" })
          for (const it of res.rows || []) {
            const raw = String(it.statut || "").trim()
            if (!raw || !it.number) continue
            const bare = String(it.number).replace("#", "").trim()
            const { data: o } = await db.from("orders").select("id,shipping_status,status").in("number", [String(it.number).trim(), "#" + bare, bare]).limit(1).maybeSingle()
            if (!o || o.shipping_status === raw) continue
            const ss = mapStatus(raw)
            const patch: Record<string, unknown> = { shipping_status: raw, updated_at: new Date().toISOString() }
            if (ss === "livre") patch.status = "livree"
            if (ss === "retourne") patch.status = "retournee"
            await db.from("orders").update(patch).eq("id", o.id)
            updated++
          }
          await db.from("carriers").update({ last_sync: new Date().toISOString() }).eq("id", c.id)
          continue
        }
        if (c.type === "livcash") {
          const url = c.api_url || "https://app.livcash.com/clients/api-parcels"
          if (!c.api_key) throw new Error("Clé API Livcash manquante")
          if (push) {
            let pq = db.from("orders").select("*").eq("status", "confirmee").or("tracking_number.is.null,tracking_number.eq.")
            pq = Array.isArray(order_ids) && order_ids.length ? pq.in("id", order_ids) : pq.eq("carrier", c.name)
            const { data: toPush } = await pq
            for (const o of toPush || []) {
              const qty = (o.items || []).reduce((s: number, i: any) => s + (Number(i.qty) || 1), 0) || 1
              const lines = (o.items || []).map((i: any) => `${Number(i.qty) || 1} x ${[i.name, i.color, i.size].filter((s: any) => s && String(s).trim()).join(" / ")}`).join(" | ")
              const extra = String(o.customer_note || o.notes || "").trim()
              const noteTxt = [lines, extra].filter(Boolean).join(" — ")
              const body = new URLSearchParams({ token: c.api_key, action: "add", ville: String(o.city || "").trim(), phone: normPhone(o.phone || ""), qty: String(qty), adresse: o.address || "", note: noteTxt, price: String(o.total || 0), name: o.customer_name || "", tracking: "" })
              const r = await fetch(url, { method: "POST", body })
              const j = await r.json().catch(() => null)
              if (r.ok && j?.status === true && j?.sku) {
                await db.from("orders").update({ tracking_number: String(j.sku), carrier: c.name, updated_at: new Date().toISOString() }).eq("id", o.id)
                pushed++
              } else errors.push(`${o.number}: ${j?.msg || r.status}`)
            }
            await db.from("carriers").update({ last_sync: new Date().toISOString() }).eq("id", c.id)
            continue
          }
        }
        const { data: orders } = await db.from("orders").select("id,tracking_number,shipping_status,status").eq("carrier", c.name).not("tracking_number", "is", null).not("status", "in", "(livree,retournee,annulee)")
        const results = new Map<string, string>()
        if (c.type === "google_sheet") {
          if (!c.sheet_url) throw new Error("Lien Google Sheet manquant")
          const r = await fetch(sheetCsvUrl(c.sheet_url))
          if (!r.ok) throw new Error(`Google Sheet inaccessible (${r.status}) — partagez-le en « Tous les utilisateurs avec le lien »`)
          const rows = parseCsv(await r.text())
          const head = rows[0].map((h) => h.trim().toLowerCase())
          const ti = head.indexOf((c.tracking_col || "tracking").trim().toLowerCase())
          const si = head.indexOf((c.status_col || "statut").trim().toLowerCase())
          if (ti < 0 || si < 0) throw new Error("Colonnes introuvables dans le Sheet")
          for (const r2 of rows.slice(1)) if (r2[ti]) results.set(r2[ti].trim(), r2[si] || "")
        } else if (c.type === "livcash") {
          const url = c.api_url || "https://app.livcash.com/clients/api-parcels"
          for (const o of orders || []) {
            const r = await fetch(url, { method: "POST", body: new URLSearchParams({ token: c.api_key, action: "track", tracking: o.tracking_number! }) })
            if (!r.ok) continue
            const j = await r.json().catch(() => null)
            const m = j?.msg
            const v = Array.isArray(m) ? m[0]?.status : m?.status
            if (v) {
              const rawStatus = String(v).trim()
              results.set(o.tracking_number!, rawStatus)
              const { error: historyError } = await db.from("livcash_status_history").insert({ order_id: o.id, status: rawStatus })
              if (historyError) errors.push(`${o.number}: historique Livcash — ${historyError.message}`)
              if (rawStatus) apiStatuses.set(rawStatus.toLocaleLowerCase(), rawStatus)
            }
          }
        } else if (c.type === "api") {
          if (!c.api_url) throw new Error("URL API manquante")
          for (const o of orders || []) {
            const url = c.api_url.replace("{tracking}", encodeURIComponent(o.tracking_number!))
            const h: Record<string, string> = {}
            if (c.api_key_header && c.api_key) h[c.api_key_header] = c.api_key
            const r = await fetch(url, { headers: h })
            if (!r.ok) continue
            const j = await r.json().catch(() => null)
            const v = j ? pick(j, c.status_path || "status") : null
            if (v != null) results.set(o.tracking_number!, String(v))
          }
        }
        for (const o of orders || []) {
          const raw = results.get(o.tracking_number!)
          if (!raw) continue
          const ss = mapStatus(raw)
          const shown = c.type === "livcash" ? raw.trim() : (ss || raw.trim())
          if (shown === o.shipping_status && !ss) continue
          const patch: Record<string, unknown> = { shipping_status: shown, updated_at: new Date().toISOString() }
          if (ss === "livre") patch.status = "livree"
          if (ss === "retourne") patch.status = "retournee"
          await db.from("orders").update(patch).eq("id", o.id)
          updated++
        }
        const carrierPatch: Record<string, unknown> = { last_sync: new Date().toISOString() }
        if (c.type === "livcash" && apiStatuses.size) {
          const existing = String(c.delivery_statuses || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          const merged = new Map(existing.map((s) => [s.toLocaleLowerCase(), s]))
          for (const [key, value] of apiStatuses) merged.set(key, value)
          carrierPatch.delivery_statuses = [...merged.values()].join("\n")
        }
        await db.from("carriers").update(carrierPatch).eq("id", c.id)
      } catch (e) { errors.push(`${c.name}: ${(e as Error).message}`) }
    }
    return json({ updated, pushed, errors })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})