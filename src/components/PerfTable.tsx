import { useMemo, useState } from "react"
import { Ad, Expense, Order, Product, catLabel, dateFr, inputCls, itemCost, money, statusLabel, useRows } from "@/lib/crm"
import { Modal } from "@/components/kit"

const TZ = "Europe/Paris"
const dayOf = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ })
const shift = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}
const CONF = ["confirmee", "expediee", "livree", "retournee"]
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—")

const PERIODS = [
  { k: "today", l: "Aujourd'hui" },
  { k: "yesterday", l: "Hier" },
  { k: "3", l: "3 jours" },
  { k: "7", l: "7 jours" },
  { k: "30", l: "30 jours" },
  { k: "day", l: "Date précise" },
  { k: "custom", l: "Personnalisé" },
]

const th = "text-left py-2 pr-3 font-medium text-muted-foreground"
function Detail({ k, c, p, rate, onClose }: { k: string; c: any; p: Product[]; rate: number; onClose: () => void }) {
  const ordTable = (list: Order[]) => (
    <table className="w-full text-sm"><thead><tr><th className={th}>N°</th><th className={th}>Date</th><th className={th}>Client</th><th className={th}>Statut</th><th className={th + " text-right"}>Montant</th></tr></thead>
      <tbody>{list.map((x) => <tr key={x.id} className="border-t border-border"><td className="py-2 pr-3">{x.number || x.id.slice(0, 6)}</td><td className="pr-3">{dateFr(x.created_at)}</td><td className="pr-3">{x.customer_name}</td><td className="pr-3">{statusLabel(x.status)}</td><td className="text-right">{money(Number(x.total) || 0)}</td></tr>)}</tbody></table>
  )
  const none = <p className="text-sm text-muted-foreground py-6 text-center">Aucune donnée sur cette période.</p>
  let title = "Détails", body: React.ReactNode = none
  if (k === "orders") { title = `Commandes (${c.n})`; if (c.list.length) body = ordTable(c.list) }
  else if (k === "conf") { title = "Taux de confirmation"; body = <><p className="text-sm mb-3">Confirmées ({c.conf}) ÷ reçues ({c.n}) = <b>{pct(c.conf, c.n)}</b>. Confirmées : Confirmée, Expédiée, Livrée, Retournée.</p>{c.confList.length ? ordTable(c.confList) : none}</> }
  else if (k === "del") { title = "Taux de livraison"; body = <><p className="text-sm mb-3">Livrées ({c.del}) ÷ confirmées ({c.conf}) = <b>{pct(c.del, c.conf)}</b>.</p>{c.delList.length ? ordTable(c.delList) : none}</> }
  else if (k === "ca") { title = "Chiffre d'affaires"; body = <><p className="text-sm mb-3">Commandes livrées, hors frais de livraison : <b>{money(c.ca)}</b></p>{c.delList.length ? ordTable(c.delList) : none}</> }
  else if (k === "prod") {
    title = `Coût de production — ${money(c.prod)}`
    const lines: React.ReactNode[] = []
    c.delList.forEach((x: Order) => (Array.isArray(x.items) ? x.items : []).forEach((i, n) => {
      const u = itemCost(i, p), q = Number(i.qty) || 0
      lines.push(<tr key={x.id + n} className="border-t border-border"><td className="py-2 pr-3">{x.number || x.id.slice(0, 6)}</td><td className="pr-3">{i.name}{i.color ? ` · ${i.color}` : ""}{i.size ? ` · ${i.size}` : ""}</td><td className="pr-3">{q}</td><td className="pr-3">{money(u)}</td><td className="text-right">{money(u * q)}</td></tr>)
    }))
    body = lines.length ? <table className="w-full text-sm"><thead><tr><th className={th}>Commande</th><th className={th}>Produit</th><th className={th}>Qté</th><th className={th}>Coût unit.</th><th className={th + " text-right"}>Total</th></tr></thead><tbody>{lines}</tbody></table> : none
  }
  else if (k === "ads") {
    title = `Coût des Ads — ${money(c.ads)}`
    body = c.adsList.length ? <><p className="text-xs text-muted-foreground mb-3">Taux : 1 $ = {rate} DH</p><table className="w-full text-sm"><thead><tr><th className={th}>Date</th><th className={th}>Campagne</th><th className={th}>Produit</th><th className={th}>Dépense $</th><th className={th + " text-right"}>Dépense DH</th></tr></thead><tbody>{c.adsList.map((x: Ad) => <tr key={x.id} className="border-t border-border"><td className="py-2 pr-3">{dateFr(x.date)}</td><td className="pr-3">{x.name}</td><td className="pr-3">{p.find((z) => z.id === x.product_id)?.name || "—"}</td><td className="pr-3">{(Number(x.spend) || 0).toFixed(2)} $</td><td className="text-right">{money((Number(x.spend) || 0) * rate)}</td></tr>)}</tbody></table></> : none
  }
  else if (k === "charges") {
    title = `Charges — ${money(c.charges)}`
    body = c.chList.length ? <table className="w-full text-sm"><thead><tr><th className={th}>Date</th><th className={th}>Libellé</th><th className={th}>Catégorie</th><th className={th + " text-right"}>Montant</th></tr></thead><tbody>{c.chList.map((x: Expense) => <tr key={x.id} className="border-t border-border"><td className="py-2 pr-3">{dateFr(x.date)}</td><td className="pr-3">{x.label}</td><td className="pr-3">{catLabel(x.category)}</td><td className="text-right">{money(Number(x.amount) || 0)}</td></tr>)}</tbody></table> : none
  }
  return <Modal title={title} onClose={onClose} wide>{body}</Modal>
}

export default function PerfTable() {
  const o = useRows<Order>("orders")
  const p = useRows<Product>("products", "name", true)
  const a = useRows<Ad>("ad_campaigns", "date")
  const e = useRows<Expense>("expenses", "date")
  const [period, setPeriod] = useState("today")
  const [oneDay, setOneDay] = useState("")
  const [cFrom, setCFrom] = useState("")
  const [cTo, setCTo] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [rateStr, setRateStr] = useState(() => localStorage.getItem("ads_usd_mad") || "10")
  const rate = Number(String(rateStr).replace(",", ".")) || 0
  const changeRate = (v: string) => { setRateStr(v); localStorage.setItem("ads_usd_mad", v) }

  const c = useMemo(() => {
    const today = dayOf(new Date())
    let from = "", to = ""
    if (period === "today") { from = to = today }
    else if (period === "yesterday") { from = to = shift(today, 1) }
    else if (period === "3") { from = shift(today, 2); to = today }
    else if (period === "7") { from = shift(today, 6); to = today }
    else if (period === "30") { from = shift(today, 29); to = today }
    else if (period === "day") { from = to = oneDay }
    else { from = cFrom; to = cTo }
    const needDate = period === "day" && !oneDay
    const inR = (d: string) => !needDate && (!from || d >= from) && (!to || d <= to)
    const list = o.rows.filter((x) => !x.is_exchange && inR(dayOf(x.created_at)))
    const conf = list.filter((x) => CONF.includes(x.status)).length
    const del = list.filter((x) => x.status === "livree")
    let ca = 0, prod = 0
    for (const x of del) {
      const items = Array.isArray(x.items) ? x.items : []
      const sum = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0)
      ca += sum > 0 ? sum : Math.max(0, (Number(x.total) || 0) - (Number(x.delivery_fee) || 0))
      prod += items.reduce((s, i) => s + itemCost(i, p.rows) * (Number(i.qty) || 0), 0)
    }
    const adsList = a.rows.filter((x) => x.product_id && inR(x.date))
    const ads = adsList.reduce((s, x) => s + (Number(x.spend) || 0) * rate, 0)
    const chList = e.rows.filter((x) => inR(x.date))
    const charges = chList.reduce((s, x) => s + (Number(x.amount) || 0), 0)
    const confList = list.filter((x) => CONF.includes(x.status))
    const res = ca - prod - ads
    return { list, confList, delList: del, adsList, chList, from, to, needDate, n: list.length, conf, del: del.length, ca, prod, ads, res, charges, net: res - charges }
  }, [o.rows, p.rows, a.rows, e.rows, rate, period, oneDay, cFrom, cTo])

  const rows: { k?: string; l: string; v: string; tone?: number; bold?: boolean }[] = [
    { k: "orders", l: "Nombre de commandes", v: String(c.n) },
    { k: "conf", l: "Taux de confirmation", v: `${pct(c.conf, c.n)} (${c.conf})` },
    { k: "del", l: "Taux de livraison", v: `${pct(c.del, c.conf)} (${c.del})` },
    { k: "ca", l: "Chiffre d'affaires (hors livraison)", v: money(c.ca), bold: true },
    { k: "prod", l: "− Coût de production", v: money(c.prod) },
    { k: "ads", l: "− Coût des Ads (produits attribués)", v: money(c.ads) },
    { l: "Résultat net", v: money(c.res), tone: c.res, bold: true },
    { k: "charges", l: "− Charges", v: money(c.charges) },
    { l: "Bénéfice net", v: money(c.net), tone: c.net, bold: true },
  ]

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-1">Performance par période</h2>
      <p className="text-xs text-muted-foreground mb-3">Fuseau horaire : Paris. Échanges exclus. Chiffre d'affaires = commandes livrées, sans frais de livraison. Résultat net = CA − coût de production − Ads (produits attribués uniquement). Bénéfice net = résultat net − charges. Ads converties à {rate} DH/$.</p>
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <select className={inputCls + " w-auto"} value={period} onChange={(ev) => setPeriod(ev.target.value)}>
          {PERIODS.map((x) => <option key={x.k} value={x.k}>{x.l}</option>)}
        </select>
        {period === "day" && <input className={inputCls + " w-40"} type="date" value={oneDay} onChange={(ev) => setOneDay(ev.target.value)} />}
        {period === "custom" && (
          <>
            <span className="text-muted-foreground">du</span>
            <input className={inputCls + " w-40"} type="date" value={cFrom} onChange={(ev) => setCFrom(ev.target.value)} />
            <span className="text-muted-foreground">au</span>
            <input className={inputCls + " w-40"} type="date" value={cTo} onChange={(ev) => setCTo(ev.target.value)} />
          </>
        )}
        {c.needDate && <span className="text-xs text-muted-foreground">Choisissez une date.</span>}
        <span className="ml-auto text-muted-foreground">Taux Ads : 1 $ =</span>
        <input className={inputCls + " w-20"} type="number" step="0.01" min="0" value={rateStr} onChange={(ev) => changeRate(ev.target.value)} />
        <span className="text-muted-foreground">DH</span>
      </div>
      <table className="w-full max-w-xl text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.l} onClick={r.k ? () => setOpen(r.k!) : undefined} className={`border-t border-border ${r.k ? "cursor-pointer hover:bg-muted/60 transition-colors" : ""}`}>
              <td className={`py-2.5 pr-3 ${r.bold ? "font-medium" : "text-muted-foreground"}`}>{r.l}{r.k && <span className="ml-2 text-xs text-accent">détails</span>}</td>
              <td className={`py-2.5 text-right ${r.bold ? "font-semibold" : ""} ${r.tone !== undefined ? (r.tone >= 0 ? "text-success" : "text-destructive") : ""}`}>{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && <Detail k={open} c={c} p={p.rows} rate={rate} onClose={() => setOpen(null)} />}
    </section>
  )
}
