import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { supabase } from "@/lib/chantan-db"
import { Order, Product, findProduct, money } from "@/lib/crm"

type Row = { id: string; label: string; ca: number; n: number }
const NONE = "__none__"

export default function CaBreakdown({ orders, products, periodLabel }: { orders: Order[]; products: Product[]; periodLabel: string }) {
  const [mode, setMode] = useState<"produit" | "centre">("produit")
  const [sel, setSel] = useState<Record<string, string[]>>({ produit: [], centre: [] })
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    supabase.from("cost_centers").select("id,name").eq("kind", "profit").order("name").then(({ data }) => setCenters(data || []))
  }, [])

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>()
    const add = (id: string, label: string, v: number) => {
      const r = map.get(id) || { id, label, ca: 0, n: 0 }
      r.ca += v; r.n += 1
      map.set(id, r)
    }
    if (mode === "centre") {
      centers.forEach((c) => map.set(c.id, { id: c.id, label: c.name, ca: 0, n: 0 }))
      for (const o of orders) {
        const pc = (o as Order & { profit_center_id?: string | null }).profit_center_id
        const c = centers.find((x) => x.id === pc)
        if (c) add(c.id, c.name, Number(o.total) || 0)
        else add(NONE, "Sans centre de profit", Number(o.total) || 0)
      }
    } else {
      for (const o of orders) {
        const items = Array.isArray(o.items) ? o.items : []
        if (!items.length) continue
        const sumLines = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0)
        for (const it of items) {
          const p = findProduct(it, products)
          const v = sumLines > 0 ? (Number(it.price) || 0) * (Number(it.qty) || 0) : (Number(o.total) || 0) / items.length
          add(p ? p.id : "n:" + (it.name || "Produit"), p ? p.name : it.name || "Produit", v)
        }
      }
    }
    return [...map.values()].sort((a, b) => b.ca - a.ca)
  }, [mode, orders, products, centers])

  const chosen = sel[mode]
  const shown = chosen.length ? rows.filter((r) => chosen.includes(r.id)) : rows
  const total = shown.reduce((s, r) => s + r.ca, 0)
  const toggle = (id: string) => setSel({ ...sel, [mode]: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] })
  const tab = (k: "produit" | "centre", l: string) => (
    <button onClick={() => setMode(k)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${mode === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{l}</button>
  )

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold mb-1">Chiffre d’affaires par {mode === "produit" ? "produit" : "centre de profit"}</h2>
      <p className="text-xs text-muted-foreground mb-3">Commandes confirmées (ou plus avancées) · {periodLabel}. Sélectionnez un ou plusieurs éléments ; sans sélection, tout est affiché.</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {tab("produit", "Par produit")}
        {tab("centre", "Par centre de profit")}
        {chosen.length > 0 && <button className="text-xs underline text-muted-foreground ml-2" onClick={() => setSel({ ...sel, [mode]: [] })}>Tout afficher</button>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4 max-h-40 overflow-y-auto">
        {rows.map((r) => {
          const on = chosen.includes(r.id)
          return (
            <button key={r.id} onClick={() => toggle(r.id)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}>
              {on && <Check className="h-3 w-3" />}{r.label}
            </button>
          )
        })}
        {!rows.length && <span className="text-sm text-muted-foreground">Aucune donnée sur cette période.</span>}
      </div>
      {shown.map((r) => (
        <div key={r.id} className="flex justify-between gap-3 py-2.5 border-t border-border text-sm">
          <span className="truncate">{r.label} <span className="text-muted-foreground">· {r.n} {mode === "produit" ? "ligne(s)" : "commande(s)"}</span></span>
          <span className="shrink-0">{money(r.ca)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 py-2.5 border-t border-border text-sm font-semibold">
        <span>Total{chosen.length ? ` (${chosen.length} sélectionné(s))` : ""}</span><span>{money(total)}</span>
      </div>
    </section>
  )
}
