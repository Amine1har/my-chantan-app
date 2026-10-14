import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/chantan-db"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Shell from "@/components/Shell"
import CaBreakdown from "@/components/CaBreakdown"
import { Fig, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Ad, Expense, Order, Product, findProduct, inputCls, itemCost, money, statusLabel, useRows } from "@/lib/crm"

function MultiProd({ label, products, sel, setSel }: { label: string; products: { id: string; name: string }[]; sel: string[]; setSel: (s: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant={sel.length ? "default" : "outline"} size="sm" onClick={() => setOpen(!open)}>{label}{sel.length ? ` (${sel.length})` : " : tous"}</Button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-64 overflow-y-auto rounded-md border border-border bg-background p-2 shadow-sm">
          <button className="text-xs underline text-muted-foreground mb-1" onClick={() => setSel([])}>Tout sélectionner</button>
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
              <input type="checkbox" checked={!sel.length || sel.includes(p.id)} onChange={() => {
                const cur = sel.length ? sel : products.map((x) => x.id)
                if (cur.includes(p.id)) { if (cur.length > 1) setSel(cur.filter((x) => x !== p.id)) }
                else { const n = [...cur, p.id]; setSel(n.length === products.length ? [] : n) }
              }} />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
          <button className="text-xs underline mt-1" onClick={() => setOpen(false)}>Fermer</button>
        </div>
      )}
    </div>
  )
}

const TZ = "Africa/Casablanca"
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ })
const shift = (k: string, n: number) => {
  const d = new Date(k + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const CONFIRMED = ["confirmee", "expediee", "livree", "retournee"]
const UNTREATED = (s: string) => !s || s === "nouvelle"
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export default function Dashboard() {
  const today = dayKey(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const inR = (k: string) => k >= from && k <= to
  const setRange = (f: string, t: string) => { setFrom(f); setTo(t) }
  const span = Math.round((new Date(to + "T12:00:00Z").getTime() - new Date(from + "T12:00:00Z").getTime()) / 86400000) + 1
  const move = (dir: number) => { let f = shift(from, dir * span), t = shift(to, dir * span); if (t > today) { t = today; f = shift(t, -(span - 1)) } setRange(f, t) }
  const [prodSel, setProdSel] = useState<string[]>([])
  const [adSel, setAdSel] = useState<string[]>([])
  const [cenSel, setCenSel] = useState<string[]>([])
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    supabase.from("cost_centers").select("id,name").eq("kind", "profit").order("name").then(({ data }) => setCenters([...(data || []), { id: "__none__", name: "Sans centre de profit" }]))
  }, [])
  const o = useRows<Order>("orders")
  const p = useRows<Product>("products", "name", true)
  const rate = Number(String(localStorage.getItem("ads_usd_mad") || "10").replace(",", ".")) || 0
  const [adRows, setAdRows] = useState<Pick<Ad, "date" | "spend" | "product_id">[]>([])
  const [adLoading, setAdLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setAdLoading(true)
    ;(async () => {
      const all: Pick<Ad, "date" | "spend" | "product_id">[] = []
      for (let f = 0; f < 100000; f += 1000) {
        const { data } = await supabase.from("ad_campaigns").select("date,spend,product_id").gte("date", from).lte("date", to).order("id").range(f, f + 999)
        all.push(...((data as Pick<Ad, "date" | "spend" | "product_id">[]) || []))
        if (!data || data.length < 1000) break
      }
      if (alive) { setAdRows(all); setAdLoading(false) }
    })()
    return () => { alive = false }
  }, [from, to])
  const a = { rows: adRows, loading: adLoading }
  const e = useRows<Expense>("expenses", "date")

  const d = useMemo(() => {
    const ordIds = prodSel.length ? prodSel : adSel
    const hasF = ordIds.length > 0
    const lines = (x: Order) => (hasF ? (x.items || []).filter((it) => { const pr = findProduct(it, p.rows); return !!pr && ordIds.includes(pr.id) }) : x.items || [])
    const cenOk = (x: Order) => !cenSel.length || cenSel.includes((x as Order & { profit_center_id?: string | null }).profit_center_id || "__none__")
    const orders = o.rows.filter((x) => inR(dayKey(x.created_at)) && cenOk(x) && (!hasF || lines(x).length > 0))
    const lineSum = (x: Order) => hasF ? lines(x).reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0) : Number(x.total) || 0
    const confirmed = orders.filter((x) => CONFIRMED.includes(x.status))
    const live = (x: Order) => !["annulee", "fake_order", "doublon"].includes(x.status)
    const isDeliv = (x: Order) => live(x) && x.shipping_status === "livre"
    const sent = orders.filter((x) => live(x) && ["en_transit", "livre", "non_livre", "retourne"].includes(x.shipping_status))
    const delivered = orders.filter(isDeliv)
    const untreated = orders.filter((x) => UNTREATED(x.status))
    const backlog = o.rows.filter((x) => UNTREATED(x.status) && cenOk(x) && (!hasF || lines(x).length > 0)).length
    const sum = (l: Order[]) => l.reduce((s, x) => s + lineSum(x), 0)
    const adSpend = a.rows.filter((r) => !adSel.length || (!!r.product_id && adSel.includes(r.product_id))).reduce((s, x) => s + (Number(x.spend) || 0), 0) * rate
    const exps = e.rows.filter((x) => inR(String(x.date).slice(0, 10)))
    const production = delivered.reduce((s, x) => s + lines(x).reduce((a, it) => a + itemCost(it, p.rows) * (Number(it.qty) || 0), 0), 0)
    const deliveredQty = delivered.reduce((s, x) => s + lines(x).reduce((a, it) => a + (Number(it.qty) || 0), 0), 0)
    const prodFilter = hasF || adSel.length > 0
    const otherCharges = prodFilter ? 0 : exps.filter((x) => x.category !== "achat" && x.category !== "publicite" && (!cenSel.length || cenSel.includes((x as Expense & { cost_center_id?: string | null }).cost_center_id || "__none__"))).reduce((s, x) => s + (Number(x.amount) || 0), 0)
    const adExpenses = adSel.length ? 0 : exps.filter((x) => x.category === "publicite").reduce((s, x) => s + (Number(x.amount) || 0), 0)
    const ads = adSpend + adExpenses
    return {
      orders, confirmedList: confirmed, untreated, backlog,
      count: orders.length,
      confirmedCount: confirmed.length,
      rateConf: pct(confirmed.length, orders.length),
      rateDeliv: pct(delivered.length, sent.length),
      sentCount: sent.length, deliveredCount: delivered.length,
      ca: sum(confirmed), caAll: sum(orders.filter((x) => !["annulee", "fake_order", "doublon"].includes(x.status))), caDelivered: sum(delivered),
      ads, production, deliveredQty, otherCharges, totalSpend: ads + production + otherCharges,
    }
  }, [o.rows, a.rows, e.rows, p.rows, from, to, rate, prodSel, adSel, cenSel])

  const low = p.rows.filter((x) => x.stock <= x.alert_threshold)
  const fmt = (k: string) => new Date(k + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const isToday = from === today && to === today
  const label = isToday ? "Aujourd’hui" : from === to ? fmt(from) : `du ${fmt(from)} au ${fmt(to)}`
  const y = today.slice(0, 4), m = today.slice(0, 7)
  const presets: [string, string, string][] = [["7 jours", shift(today, -6), today], ["30 jours", shift(today, -29), today], ["Ce mois", m + "-01", today], ["Cette année", y + "-01-01", today]]
  const loading = o.loading || a.loading || e.loading

  return (
    <Shell>
      <PageHead
        title="Tableau de bord"
        sub={`Activité de Cloud Brand · ${label}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" aria-label="Période précédente" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground">Du</span>
            <input type="date" className={inputCls + " w-36"} value={from} max={to} onChange={(ev) => ev.target.value && setFrom(ev.target.value)} />
            <span className="text-xs text-muted-foreground">au</span>
            <input type="date" className={inputCls + " w-36"} value={to} min={from} max={today} onChange={(ev) => ev.target.value && setTo(ev.target.value)} />
            <Button variant="outline" size="sm" aria-label="Période suivante" disabled={to >= today} onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant={isToday ? "default" : "outline"} size="sm" onClick={() => setRange(today, today)}>Aujourd’hui</Button>
            {presets.map(([l, f, t]) => <Button key={l} variant={from === f && to === t ? "default" : "outline"} size="sm" onClick={() => setRange(f, t)}>{l}</Button>)}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-muted-foreground">Filtres :</span>
        <MultiProd label="Produit (chiffre d’affaires)" products={p.rows} sel={prodSel} setSel={setProdSel} />
        <MultiProd label="Produit Meta (publicités)" products={p.rows} sel={adSel} setSel={setAdSel} />
        <MultiProd label="Centre de profit" products={centers} sel={cenSel} setSel={setCenSel} />
        {(prodSel.length > 0 || adSel.length > 0 || cenSel.length > 0) && <span className="text-xs text-muted-foreground">Les indicateurs sont calculés uniquement sur les produits choisis ; les autres charges (non liées à un produit) sont exclues.</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
        <Fig label="Commandes du jour" value={loading ? "…" : String(d.count)} />
        <Fig label={`Taux de confirmation (${d.confirmedCount}/${d.count})`} value={`${d.rateConf} %`} tone={d.count && d.rateConf >= 60 ? "good" : undefined} />
        <Fig label={`Taux de livraison (${d.deliveredCount}/${d.sentCount} expédiées)`} value={`${d.rateDeliv} %`} tone={d.sentCount && d.rateDeliv >= 70 ? "good" : undefined} />
        <Fig label="Commandes non traitées (ce jour)" value={String(d.untreated.length)} tone={d.untreated.length ? "bad" : "good"} />
        <Fig label="Chiffre d’affaires confirmé" value={money(d.ca)} tone="good" />
        <Fig label={isToday ? "Total des dépenses du jour" : "Total des dépenses (période)"} value={money(d.totalSpend)} tone={d.totalSpend ? "bad" : undefined} />
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        {d.backlog > 0
          ? <>Au total, <strong className="text-foreground">{d.backlog}</strong> commande(s) n’ont pas encore été traitées, tous jours confondus. <Link to="/commandes" className="text-accent hover:underline">Ouvrir les commandes</Link></>
          : "Toutes les commandes ont été traitées."}
      </div>

      <div className="grid md:grid-cols-2 gap-10 mt-12">
        <section>
          <h2 className="text-lg font-semibold mb-3">Chiffre d’affaires du jour</h2>
          <Row l="Commandes confirmées (ou plus avancées)" v={money(d.ca)} />
          <Row l="Toutes commandes hors annulées / fake / doublons" v={money(d.caAll)} />
          <Row l="Commandes livrées ce jour-là" v={money(d.caDelivered)} />
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-3">{isToday ? "Dépenses du jour" : "Dépenses de la période"}</h2>
          <Row l={`Publicités (Meta Ads, 1 $ = ${rate} DH)`} v={money(d.ads)} />
          <Row l={`Charge de production (${d.deliveredQty} article(s) livré(s) × coût)`} v={money(d.production)} />
          <Row l="Autres charges" v={money(d.otherCharges)} />
          <Row l="Total" v={money(d.totalSpend)} strong />
        </section>
      </div>

      <CaBreakdown orders={d.confirmedList} products={p.rows} periodLabel={label} />

      <div className="grid md:grid-cols-2 gap-10 mt-12">
        <section>
          <h2 className="text-lg font-semibold mb-3">Commandes à traiter</h2>
          {d.untreated.slice(0, 8).map((x) => (
            <Link key={x.id} to="/commandes" className="flex justify-between gap-3 py-2.5 border-t border-border text-sm hover:text-accent transition-colors">
              <span className="truncate">{x.customer_name} <span className="text-muted-foreground">· {x.city || "—"}</span></span>
              <span className="shrink-0">{money(x.total)}</span>
            </Link>
          ))}
          {!d.untreated.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune commande en attente pour ce jour.</p>}
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-3">Commandes du jour</h2>
          {d.orders.slice(0, 8).map((x) => (
            <Link key={x.id} to="/commandes" className="flex justify-between gap-3 py-2.5 border-t border-border text-sm hover:text-accent transition-colors">
              <span className="truncate">{x.customer_name}</span>
              <span className="shrink-0">{money(x.total)} · {statusLabel(x.status || "nouvelle")}</span>
            </Link>
          ))}
          {!d.orders.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune commande à cette date.</p>}
          {d.orders.length > 8 && <p className="text-xs text-muted-foreground border-t border-border pt-2">+ {d.orders.length - 8} autre(s) dans la page Commandes.</p>}
        </section>
      </div>

      {low.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-3">Alertes de stock</h2>
          {low.slice(0, 6).map((x) => (
            <Link key={x.id} to="/stock" className="flex justify-between py-2.5 border-t border-border text-sm hover:text-accent transition-colors">
              <span>{x.name}</span>
              <span className={x.stock === 0 ? "text-destructive font-medium" : ""}>{x.stock === 0 ? "Rupture" : `${x.stock} restant(s)`}</span>
            </Link>
          ))}
        </section>
      )}
    </Shell>
  )
}

function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-2.5 border-t border-border text-sm ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{l}</span><span>{v}</span>
    </div>
  )
}
