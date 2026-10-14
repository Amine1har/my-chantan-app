// chantan:role=admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" }
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: cors })

const SIZE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|\d{2,3})$/i
function parseVariant(vt?: string | null) {
  let color = "", size = ""
  const parts = (vt || "").split("/").map((s) => s.trim()).filter((s) => s && s !== "Default Title")
  for (const p of parts) {
    if (SIZE.test(p) && !size) size = p
    else if (!color) color = p
    else if (!size) size = p
  }
  return { color, size }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  try {
    const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN")
    let token = Deno.env.get("SHOPIFY_ACCESS_TOKEN")
    const cid = Deno.env.get("SHOPIFY_CLIENT_ID")
    const csec = Deno.env.get("SHOPIFY_CLIENT_SECRET")
    if (!domain || (!token && !(cid && csec))) return out({ error: "Clés Shopify manquantes" })
    if (!token) {
      const tr = await fetch(`https://${domain.replace(/^https?:\/\//, "")}/admin/oauth/access_token`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: cid, client_secret: csec, grant_type: "client_credentials" }),
      })
      const tj = await tr.json().catch(() => ({}))
      if (!tr.ok || !tj.access_token) return out({ error: `Shopify auth ${tr.status}: vérifiez l'installation de l'appli et les clés` })
      token = tj.access_token as string
    }
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: products } = await db.from("products").select("id,name,sku,cost")
    const { data: variants } = await db.from("product_variants").select("id,product_id,color,size")
    const prods = products || []
    const vars = variants || []

    let url: string | null = `https://${domain.replace(/^https?:\/\//, "")}/admin/api/2024-10/orders.json?status=any&limit=250`
    let count = 0, updated = 0, missing = 0
    for (let page = 0; url && page < 8; page++) {
      const r = await fetch(url, { headers: { "X-Shopify-Access-Token": token } })
      if (!r.ok) {
        const body = (await r.text().catch(() => "")).slice(0, 200)
        return out({ error: `Shopify ${r.status} : ${body}` })
      }
      const { orders } = await r.json()
      const rows = orders.map((o: any) => {
        const a = o.shipping_address || o.billing_address || {}
        const c = o.customer || {}
        const d = c.default_address || {}
        const items = (o.line_items || []).map((l: any) => {
          const { color, size } = parseVariant(l.variant_title)
          const title = l.title || l.name
          const pr = prods.find((p: any) => (l.sku && p.sku && p.sku.toLowerCase() === String(l.sku).toLowerCase()) || p.name.toLowerCase() === String(title).toLowerCase())
          const vr = pr ? vars.find((v: any) => v.product_id === pr.id && (v.color || "").toLowerCase() === color.toLowerCase() && (v.size || "").toLowerCase() === size.toLowerCase()) : null
          if (!pr) missing++
          return { product_id: pr?.id, variant_id: vr?.id, name: title, color, size, qty: l.quantity, price: Number(l.price), cost: pr?.cost }
        })
        return {
          shopify_id: String(o.id), number: o.name, source: "shopify", created_at: o.created_at,
          customer_name: a.name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client",
          phone: o.phone || a.phone || c.phone || d.phone || null,
          city: a.city || d.city || null,
          address: [a.address1, a.address2].filter(Boolean).join(" ") || [d.address1, d.address2].filter(Boolean).join(" ") || null,
          customer_note: o.note || null,
          items, total: Number(o.total_price),
        }
      })
      if (rows.length) {
        const ids = rows.map((x: any) => x.shopify_id)
        const { data: ex } = await db.from("orders").select("id,shopify_id,city,address,phone,customer_note,items").in("shopify_id", ids)
        const exMap = new Map((ex || []).map((e: any) => [e.shopify_id, e]))
        const fresh = rows.filter((x: any) => !exMap.has(x.shopify_id))
        if (fresh.length) {
          const { error } = await db.from("orders").upsert(fresh, { onConflict: "shopify_id", ignoreDuplicates: true })
          if (error) return out({ error: error.message })
          count += fresh.length
        }
        // Commandes existantes : on complète seulement les champs vides (rien d'édité n'est écrasé)
        for (const x of rows) {
          const e: any = exMap.get(x.shopify_id)
          if (!e) continue
          const patch: Record<string, unknown> = {}
          if (!e.city && x.city) patch.city = x.city
          if (!e.address && x.address) patch.address = x.address
          if (!e.phone && x.phone) patch.phone = x.phone
          if (!e.customer_note && x.customer_note) patch.customer_note = x.customer_note
          if (Array.isArray(e.items) && e.items.length && !("color" in e.items[0])) patch.items = x.items
          if (Object.keys(patch).length) {
            await db.from("orders").update(patch).eq("id", e.id)
            updated++
          }
        }
        const custs = orders.filter((o: any) => o.customer?.id).map((o: any) => ({
          shopify_id: String(o.customer.id), source: "shopify", name: `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim() || "Client",
          phone: o.customer.phone || o.shipping_address?.phone || null, email: o.customer.email || null,
          city: o.shipping_address?.city || o.customer.default_address?.city || null,
        }))
        if (custs.length) await db.from("customers").upsert(custs, { onConflict: "shopify_id", ignoreDuplicates: true })
      }
      const link = r.headers.get("link") || ""
      const m = link.match(/<([^>]+)>;\s*rel="next"/)
      url = m ? m[1] : null
    }
    return out({ orders: count, updated, missing })
  } catch (e) {
    return out({ error: (e as Error).message }, 500)
  }
})
