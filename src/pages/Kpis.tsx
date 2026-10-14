import { useMemo, useState } from "react"
import Shell from "@/components/Shell"
import { Empty, Fig, Modal, PageHead } from "@/components/kit"
import { Ad, Move, Order, Product, findProduct, inputCls, matchQ, money, useRows } from "@/lib/crm"

export default function Kpis() {
  const pr = useRows<Product>("products", "name", true)
  const o = useRows<Order>("orders")
  const a = useRows<Ad>("ad_campaigns", "date")
  const m = useRows<Move>("stock_movements")
  const [dFrom, setDFrom] = useState("")
  const [dTo, setDTo] = useState("")
  const [prodF, setProdF] = useState("")
  const [q, setQ] = useState("")
  const [hideEmpty, setHideEmpty] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState("name")
  const rate = Number(String(localStorage.getItem("ads_usd_mad") || "10").replace(",", ".")) || 0

  const lines = useMemo(() => {
    type OD = { number: string; day: string; label: string; qty: number; price: number; gross: number; fee: number; share: number }
    type AD = { day: string; name: string; spend: number; mad: number }
    const od = new Map<string, OD[]>(), ad = new Map<string, AD[]>()
    const rev = new Map<string, number>(), qty = new Map<string, number>(), ads = new Map<string, number>(), init = new Map<string, number>()
    for (const ord of o.rows) {
      if (ord.status !== "livree" || ord.is_exchange) continue
      let day = ""
      try { day = new Date(ord.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" }) } catch { continue }
      if ((dFrom && day < dFrom) || (dTo && day > dTo)) continue
      const items = Array.isArray(ord.items) ? ord.items : []
      if (!items.length) continue
      const feeShare = (Number(ord.delivery_fee) || 0) / items.length
      const linesSum = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0)
      for (const it of items) {
        const p = findProduct(it, pr.rows)
        if (!p) continue
        const gross = linesSum > 0 ? (Number(it.price) || 0) * (Number(it.qty) || 0) : (Number(ord.total) || 0) / items.length
        const share = gross - feeShare
        rev.set(p.id, (rev.get(p.id) || 0) + share)
        od.set(p.id, [...(od.get(p.id) || []), { number: ord.number || ord.id.slice(0, 8), day, label: [it.name, it.color, it.size].filter(Boolean).join(" · "), qty: Number(it.qty) || 0, price: Number(it.price) || 0, gross, fee: feeShare, share }])
        qty.set(p.id, (qty.get(p.id) || 0) + (Number(it.qty) || 0))
      }
    }
    for (const x of a.rows) if (x.product_id && (!dFrom || x.date >= dFrom) && (!dTo || x.date <= dTo)) ad.set(x.product_id, [...(ad.get(x.product_id) || []), { day: x.date, name: x.name, spend: Number(x.spend) || 0, mad: (Number(x.spend) || 0) * rate }])
    for (const x of a.rows) if (x.product_id && (!dFrom || x.date >= dFrom) && (!dTo || x.date <= dTo)) ads.set(x.product_id, (ads.get(x.product_id) || 0) + (Number(x.spend) || 0) * rate)
    const recv = new Map<string, number>(), conf = new Map<string, number>(), deliv = new Map<string, number>()
    for (const ord of o.rows) {
      if (ord.is_exchange) continue
      let day = ""
      try { day = new Date(ord.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" }) } catch { continue }
      if ((dFrom && day < dFrom) || (dTo && day > dTo)) continue
      const ids = new Set<string>()
      for (const it of Array.isArray(ord.items) ? ord.items : []) { const p = findProduct(it, pr.rows); if (p) ids.add(p.id) }
      const isConf = ["confirmee", "expediee", "livree", "retournee"].includes(ord.status)
      for (const id of ids) {
        recv.set(id, (recv.get(id) || 0) + 1)
        if (isConf) conf.set(id, (conf.get(id) || 0) + 1)
        if (ord.status === "livree") deliv.set(id, (deliv.get(id) || 0) + 1)
      }
    }
    for (const mv of m.rows) if (mv.type === "entree") init.set(mv.product_id, (init.get(mv.product_id) || 0) + mv.quantity)
    return pr.rows.map((p) => {
      const stockInit = init.get(p.id) || p.stock
      const invest = (Number(p.cost) || 0) * stockInit
      const revenu = rev.get(p.id) || 0
      const prod = (Number(p.cost) || 0) * (qty.get(p.id) || 0)
      const pub = ads.get(p.id) || 0
      return { p, nRecv: recv.get(p.id) || 0, nConf: conf.get(p.id) || 0, nDeliv: deliv.get(p.id) || 0, orders: od.get(p.id) || [], adRows: ad.get(p.id) || [], entries: m.rows.filter((mv) => mv.product_id === p.id && mv.type === "entree"), stockInit, invest, revenu, sold: qty.get(p.id) || 0, prod, pub, net: revenu - prod - pub }
    })
  }, [pr.rows, o.rows, a.rows, m.rows, rate, dFrom, dTo])

  const shown = useMemo(() => {
    const r = lines.filter((l) => (!prodF || l.p.id === prodF) && matchQ(q, l.p.name, l.p.sku) && (!hideEmpty || l.sold > 0 || l.pub > 0))
    const key = (l: (typeof lines)[number]) => sortBy === "net" ? -l.net : sortBy === "revenu" ? -l.revenu : sortBy === "pub" ? -l.pub : 0
    return sortBy === "name" ? r : [...r].sort((x, y) => key(x) - key(y))
  }, [lines, prodF, q, hideEmpty, sortBy])
  const sum = (k: "invest" | "revenu" | "prod" | "pub" | "net") => shown.reduce((s, l) => s + l[k], 0)
  const col = "grid grid-cols-[minmax(0,2fr)_repeat(9,minmax(0,1fr))] gap-2 text-sm"
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—")

  return (
    <Shell>
      <PageHead title="KPIs" sub="Rentabilité par produit : investissement, revenu net de livraison et résultat net." />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <Fig label="Total investissement" value={money(sum("invest"))} />
        <Fig label="Revenu net de livraison" value={money(sum("revenu"))} />
        <Fig label="Coût de production" value={money(sum("prod"))} />
        <Fig label="Coût des Ads" value={money(sum("pub"))} />
        <Fig label="Résultat net" value={money(sum("net"))} tone={sum("net") >= 0 ? "good" : "bad"} />
      </div>
      <p className="text-xs text-muted-foreground mt-4 max-w-3xl">
        Investissement = coût d'achat × stock initial (entrées de stock cumulées). Revenu net = valeur de chaque produit livré (prix × quantité) − part des frais de livraison (répartis à parts égales entre les produits de la commande). Les échanges sont exclus (ni revenu, ni frais, ni coût). Taux de confirmation = commandes confirmées / reçues ; taux de livraison = livrées / confirmées (échanges exclus, une commande comptée une fois par produit). Les dates filtrent les commandes et les dépenses Meta (le stock initial n'est pas filtré).
        Coût de production = coût d'achat × quantité livrée. Coût des Ads = dépenses Meta attribuées au produit × taux de change ({rate} DH/$). Résultat net = revenu net − coût de production − coût des Ads.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-8 text-sm">
        <input className={inputCls + " max-w-[220px]"} placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls + " w-auto"} value={prodF} onChange={(e) => setProdF(e.target.value)}>
          <option value="">Tous les produits</option>
          {pr.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-muted-foreground">Période : toutes les dates par défaut — du</span>
        <input className={inputCls + " w-36"} type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
        <span className="text-muted-foreground">au</span>
        <input className={inputCls + " w-36"} type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} />
        <select className={inputCls + " w-auto"} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Tri : nom</option><option value="net">Tri : résultat net</option><option value="revenu">Tri : revenu net</option><option value="pub">Tri : coût des Ads</option>
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Masquer les produits sans activité</label>
        {(q || prodF || dFrom || dTo || hideEmpty || sortBy !== "name") && <button className="text-xs underline text-muted-foreground" onClick={() => { setQ(""); setProdF(""); setDFrom(""); setDTo(""); setHideEmpty(false); setSortBy("name") }}>Réinitialiser</button>}
      </div>
      <div className="overflow-x-auto mt-4">
        <div className="min-w-[1150px]">
          <div className={col + " text-xs text-muted-foreground pb-2"}>
            <span>Produit</span><span>Cmd. reçues</span><span>Taux confirmation</span><span>Taux livraison</span><span>Coût unit.</span><span>Stock initial</span><span>Investissement</span><span>Qté livrée</span><span>Revenu net</span><span>Coût prod. + Ads</span><span>Résultat net</span>
          </div>
          {shown.map((l) => (
            <div key={l.p.id} onClick={() => setSelId(l.p.id)} className={col + " border-t border-border py-2.5 cursor-pointer hover:bg-muted/50"}>
              <span className="font-medium truncate" title={l.p.name}>{l.p.name}</span>
              <span>{l.nRecv}</span>
              <span title="Confirmées / reçues">{pct(l.nConf, l.nRecv)} <span className="text-xs text-muted-foreground">({l.nConf})</span></span>
              <span title="Livrées / confirmées">{pct(l.nDeliv, l.nConf)} <span className="text-xs text-muted-foreground">({l.nDeliv})</span></span>
              <span>{money(l.p.cost)}</span><span>{l.stockInit}</span><span>{money(l.invest)}</span><span>{l.sold}</span>
              <span>{money(l.revenu)}</span>
              <span title={`Prod. ${money(l.prod)} · Ads ${money(l.pub)}`}>{money(l.prod + l.pub)}</span>
              <span className={`font-semibold ${l.net >= 0 ? "text-success" : "text-destructive"}`}>{money(l.net)}</span>
            </div>
          ))}
          {!shown.length && <Empty text={pr.loading ? "Chargement…" : pr.rows.length ? "Aucun produit à afficher avec ces filtres." : "Aucun produit dans le stock."} />}
        </div>
      </div>
      {(() => {
        const l = lines.find((x) => x.p.id === selId)
        if (!l) return null
        return (
          <Modal title={`Détail du calcul — ${l.p.name}`} onClose={() => setSelId(null)} wide>
            <div className="space-y-5 text-sm">
              <div>
                <div className="font-medium mb-1">Taux de confirmation et de livraison</div>
                <p className="text-muted-foreground">Commandes reçues : <b className="text-foreground">{l.nRecv}</b> · Confirmées : <b className="text-foreground">{l.nConf}</b> ({pct(l.nConf, l.nRecv)}) · Livrées : <b className="text-foreground">{l.nDeliv}</b> ({pct(l.nDeliv, l.nConf)} des confirmées, {pct(l.nDeliv, l.nRecv)} des reçues)</p>
              </div>
              <div>
                <div className="font-medium mb-1">Investissement</div>
                <p className="text-muted-foreground">{money(l.p.cost)} (coût d'achat) × {l.stockInit} (stock initial) = <b className="text-foreground">{money(l.invest)}</b></p>
                {l.entries.length > 0 && <p className="text-xs text-muted-foreground mt-1">Entrées : {l.entries.map((e) => e.quantity).join(" + ")}</p>}
              </div>
              <div>
                <div className="font-medium mb-1">Commandes livrées ({l.orders.length} lignes)</div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-[1.2fr_1.6fr_.5fr_.8fr_.8fr_.8fr] gap-2 text-xs text-muted-foreground pb-1"><span>Commande</span><span>Article</span><span>Qté</span><span>Valeur</span><span>− Frais</span><span>Net</span></div>
                  {l.orders.map((x, i) => (
                    <div key={i} className="grid grid-cols-[1.2fr_1.6fr_.5fr_.8fr_.8fr_.8fr] gap-2 border-t border-border py-1.5 text-xs">
                      <span title={x.day}>{x.number}<br /><span className="text-muted-foreground">{x.day}</span></span>
                      <span className="truncate" title={x.label}>{x.label}</span><span>{x.qty}</span><span>{money(x.gross)}</span><span>{money(x.fee)}</span><span className="font-medium">{money(x.share)}</span>
                    </div>
                  ))}
                  {!l.orders.length && <p className="text-xs text-muted-foreground">Aucune commande livrée.</p>}
                </div>
                <p className="mt-2">Revenu net = <b>{money(l.revenu)}</b> · Qté livrée = <b>{l.sold}</b></p>
              </div>
              <div>
                <div className="font-medium mb-1">Coût de production</div>
                <p className="text-muted-foreground">{money(l.p.cost)} × {l.sold} = <b className="text-foreground">{money(l.prod)}</b></p>
              </div>
              <div>
                <div className="font-medium mb-1">Coût des Ads (taux {rate} DH/$)</div>
                <div className="max-h-40 overflow-y-auto">
                  {l.adRows.map((x, i) => <div key={i} className="flex justify-between border-t border-border py-1 text-xs"><span className="truncate pr-2" title={x.name}>{x.day} · {x.name}</span><span>{x.spend.toFixed(2)} $ → {money(x.mad)}</span></div>)}
                  {!l.adRows.length && <p className="text-xs text-muted-foreground">Aucune dépense Meta attribuée.</p>}
                </div>
                <p className="mt-1">Total = <b>{money(l.pub)}</b></p>
              </div>
              <div className="border-t border-border pt-3">
                Résultat net = {money(l.revenu)} − {money(l.prod)} − {money(l.pub)} = <b className={l.net >= 0 ? "text-success" : "text-destructive"}>{money(l.net)}</b>
              </div>
            </div>
          </Modal>
        )
      })()}
    </Shell>
  )
}
