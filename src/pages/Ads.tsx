import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Empty, Field, Fig, Modal, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Ad, Order, Product, dateFr, findProduct, inputCls, money, useRows } from "@/lib/crm"

const PAGE = 50

const usd = (n: number) => `${(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

export default function Ads() {
  const [rate, setRate] = useState(() => localStorage.getItem("ads_usd_mad") || "10")
  const r = Number(String(rate).replace(",", ".")) || 0
  const changeRate = (v: string) => { setRate(v); localStorage.setItem("ads_usd_mad", v) }
  const [pageRows, setPageRows] = useState<Ad[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tot, setTot] = useState({ spend: 0, revenue: 0, purchases: 0 })
  const [winOrders, setWinOrders] = useState<Pick<Order, "created_at" | "items" | "status" | "ad_campaign">[]>([])
  const [crmOrders, setCrmOrders] = useState<Pick<Order, "created_at" | "items" | "status" | "ad_campaign">[]>([])
  const reqRef = useRef(0)
  const pr = useRows<Product>("products", "name", true)
  const a = { rows: pageRows, reload: () => { load(); loadTot() } }
  const assign = async (x: Ad, productId: string) => {
    const val = productId || null
    const base = supabase.from("ad_campaigns").update({ product_id: val })
    const { error } = await (x.meta_id ? base.eq("meta_id", x.meta_id) : base.eq("name", x.name))
    if (error) return toast.error(error.message)
    toast.success(val ? "Campagne attribuée au produit (tous les jours)" : "Attribution retirée")
    a.reload()
  }
  type Prop = { key: string; name: string; meta_id: string | null; product_id: string; term: string; on: boolean }
  const [props, setProps] = useState<Prop[] | null>(null)
  const [propBusy, setPropBusy] = useState(false)
  const propose = async () => {
    setPropBusy(true)
    const nk = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
    const terms: { id: string; t: string }[] = []
    for (const p of pr.rows) for (const t of [p.name, ...(p.keywords || "").split(/[,;\n]/)]) { const k = nk(t); if (k.length >= 3) terms.push({ id: p.id, t: k }) }
    terms.sort((x, y) => y.t.length - x.t.length)
    const seen = new Set<string>()
    const out: Prop[] = []
    for (let from = 0; from < 50000; from += 1000) {
      const { data } = await supabase.from("ad_campaigns").select("id,name,meta_id,product_id").is("product_id", null).order("id").range(from, from + 999)
      for (const x of (data as Ad[]) || []) {
        const key = x.meta_id || x.name
        if (seen.has(key)) continue
        const hit = terms.find((m) => nk(x.name).includes(m.t))
        if (!hit) continue
        seen.add(key)
        out.push({ key, name: x.name, meta_id: x.meta_id, product_id: hit.id, term: hit.t, on: true })
      }
      if (!data || data.length < 1000) break
    }
    setPropBusy(false)
    if (!out.length) return toast.info("Aucune proposition : aucune campagne non attribuée ne correspond à un produit ou mot-clé")
    setProps(out)
  }
  const validateProps = async () => {
    if (!props) return
    setPropBusy(true)
    let n = 0
    for (const x of props.filter((p) => p.on && p.product_id)) {
      const base = supabase.from("ad_campaigns").update({ product_id: x.product_id })
      const { error } = await (x.meta_id ? base.eq("meta_id", x.meta_id) : base.eq("name", x.name))
      if (!error) n++
    }
    setPropBusy(false)
    setProps(null)
    toast.success(`${n} campagne(s) attribuée(s)`)
    a.reload()
  }
  const autoAssign = async () => {
    const nk = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
    const terms: { id: string; t: string }[] = []
    for (const p of pr.rows) for (const t of [p.name, ...(p.keywords || "").split(/[,;\n]/)]) { const k = nk(t); if (k.length >= 3) terms.push({ id: p.id, t: k }) }
    terms.sort((x, y) => y.t.length - x.t.length)
    const done = new Set<string>()
    let n = 0
    const unassigned: Ad[] = []
    for (let from = 0; from < 50000; from += 1000) {
      const { data } = await supabase.from("ad_campaigns").select("id,name,meta_id,product_id").is("product_id", null).order("id").range(from, from + 999)
      unassigned.push(...((data as Ad[]) || []))
      if (!data || data.length < 1000) break
    }
    for (const x of unassigned) {
      if (x.product_id) continue
      const key = x.meta_id || x.name
      if (done.has(key)) continue
      const hit = terms.find((m) => nk(x.name).includes(m.t))
      if (!hit) continue
      done.add(key)
      const base = supabase.from("ad_campaigns").update({ product_id: hit.id })
      const { error } = await (x.meta_id ? base.eq("meta_id", x.meta_id) : base.eq("name", x.name))
      if (!error) n++
    }
    toast.success(n ? `${n} campagne(s) attribuée(s) automatiquement` : "Aucune campagne à attribuer")
    a.reload()
  }
  const [dFrom, setDFrom] = useState("")
  const [dTo, setDTo] = useState("")
  const [q, setQ] = useState("")
  const [hideZero, setHideZero] = useState(false)
  const [minSpend, setMinSpend] = useState("")
  const [maxSpend, setMaxSpend] = useState("")
  const [prodF, setProdF] = useState("")
  const prodOrders = useMemo(() => {
    const m = new Map<string, number>()
    for (const ord of winOrders) {
      if (ord.status === "annulee") continue
      const day = new Date(ord.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" })
      const ids = new Set<string>()
      for (const it of ord.items || []) { const p = findProduct(it, pr.rows); if (p) ids.add(p.id) }
      ids.forEach((id) => m.set(`${id}|${day}`, (m.get(`${id}|${day}`) || 0) + 1))
    }
    return m
  }, [winOrders, pr.rows])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: "", spend: "", impressions: "", clicks: "", purchases: "", revenue: "", date: new Date().toISOString().slice(0, 10) })

  const [dq, setDq] = useState("")
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(0) }, [dq, hideZero, minSpend, maxSpend, prodF, dFrom, dTo])
  const loadTot = useCallback(async () => {
    const { data } = await supabase.rpc("ad_totals")
    if (data) setTot(data as typeof tot)
  }, [])
  const load = useCallback(async () => {
    const id = ++reqRef.current
    setLoading(true)
    let qb = supabase.from("ad_campaigns").select("*", { count: "exact" })
    if (dFrom) qb = qb.gte("date", dFrom)
    if (dTo) qb = qb.lte("date", dTo)
    if (hideZero) qb = qb.gt("spend", 0)
    if (minSpend !== "") qb = qb.gte("spend", Number(minSpend))
    if (maxSpend !== "") qb = qb.lte("spend", Number(maxSpend))
    if (prodF === "none") qb = qb.is("product_id", null)
    else if (prodF === "assigned") qb = qb.not("product_id", "is", null)
    else if (prodF) qb = qb.eq("product_id", prodF)
    for (const t of dq.split(/\s+/).filter(Boolean)) { const c = t.replace(/[%,()*\\]/g, ""); if (c) qb = qb.ilike("name", `%${c}%`) }
    const from = page * PAGE
    const { data, error, count } = await qb.order("date", { ascending: false }).order("id").range(from, from + PAGE - 1)
    if (error) toast.error("Chargement impossible : " + error.message)
    const rows = (data as Ad[]) || []
    let ords: typeof winOrders = []
    let crm: typeof winOrders = []
    if (rows.length) {
      const days = rows.map((r) => r.date).sort()
      const lo = new Date(days[0] + "T00:00:00Z").getTime() - 864e5
      const hi = new Date(days[days.length - 1] + "T00:00:00Z").getTime() + 2 * 864e5
      for (let f = 0; f < 20000; f += 1000) {
        const { data: od } = await supabase.from("orders").select("created_at,items,status,ad_campaign").gte("created_at", new Date(lo).toISOString()).lt("created_at", new Date(hi).toISOString()).order("id").range(f, f + 999)
        ords.push(...((od as typeof winOrders) || []))
        if (!od || od.length < 1000) break
      }
      const names = [...new Set(rows.map((r) => r.name))]
      const { data: byName } = await supabase.from("orders").select("created_at,items,status,ad_campaign").in("ad_campaign", names)
      crm = (byName as typeof winOrders) || []
    }
    if (id !== reqRef.current) return
    setPageRows(rows)
    setTotalRows(count || 0)
    setWinOrders(ords)
    setCrmOrders(crm)
    setLoading(false)
  }, [page, dq, hideZero, minSpend, maxSpend, prodF, dFrom, dTo])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadTot() }, [loadTot])
  const spend = tot.spend
  const rev = tot.revenue
  const buys = tot.purchases

  const [range, setRange] = useState("30")
  const sync = async () => {
    setBusy(true)
    try {
      const day = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
      const payload = range === "1" ? { since: day(1), until: day(1) } : range === "7" ? { since: day(7), until: day(1) } : range === "90" ? { since: day(90), until: day(0) } : range === "365" ? { since: day(365), until: day(0) } : {}
      const { data, error } = await supabase.functions.invoke("meta-sync", { body: payload })
      if (error || data?.error) throw new Error(data?.error || error?.message)
      toast.success(`${data.rows} ligne(s) enregistrée(s) dans l'historique Meta`)
      a.reload()
    } catch (e) {
      toast.error("Synchronisation impossible : " + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (!f.name) return toast.error("Nom requis")
    const n = (v: string) => Number(v) || 0
    const { error } = await supabase.from("ad_campaigns").insert({ name: f.name, date: f.date, spend: n(f.spend), impressions: n(f.impressions), clicks: n(f.clicks), purchases: n(f.purchases), revenue: n(f.revenue) })
    if (error) return toast.error(error.message)
    setOpen(false)
    a.reload()
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <Shell>
      <PageHead
        title="Meta Ads"
        sub="Performance des campagnes et ventes liées aux publicités."
        actions={<>
          <Button variant="outline" onClick={propose} disabled={propBusy}>Proposition d'attribution</Button>
          <Button variant="outline" onClick={() => setOpen(true)}>Saisie manuelle</Button>
          <select className={inputCls + " w-auto"} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="1">Hier</option><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">90 derniers jours</option><option value="365">12 derniers mois</option>
          </select>
          <Button onClick={sync} disabled={busy}><RefreshCw className={`h-4 w-4 mr-1 ${busy ? "animate-spin" : ""}`} /> Synchroniser Meta</Button>
        </>}
      />
      <div className="flex items-center gap-2 mb-6 text-sm">
        <span className="text-muted-foreground">Taux de change : 1 $ =</span>
        <input className={inputCls + " w-24"} type="number" step="0.01" min="0" value={rate} onChange={(e) => changeRate(e.target.value)} />
        <span className="text-muted-foreground">DH</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <Fig label="Dépenses ($)" value={usd(spend)} />
        <Fig label="Dépenses (DH)" value={money(spend * r)} />
        <Fig label="Revenu attribué ($)" value={usd(rev)} />
        <Fig label="ROAS" value={spend ? (rev / spend).toFixed(2) : "—"} tone={spend && rev / spend >= 1 ? "good" : undefined} />
        <Fig label="Coût par achat" value={buys ? usd(spend / buys) : "—"} />
      </div>
      <h2 className="text-lg font-semibold mt-12 mb-3">Campagnes</h2>
      <div className="hidden md:grid grid-cols-[repeat(13,minmax(0,1fr))] gap-2 text-xs text-muted-foreground pb-2">
        <span className="col-span-2">Campagne</span><span className="col-span-1">Date</span><span className="col-span-1">Dépense ($)</span><span className="col-span-1">Dépense (DH)</span><span className="col-span-1">Clics</span><span className="col-span-1">Achats</span><span className="col-span-1">CRM</span><span className="col-span-1">ROAS</span><span className="col-span-2">Produit (centre de coût)</span><span className="col-span-1">Cmd. produit</span><span className="col-span-1">Coût / résultat</span>
      </div>
      <input className={inputCls + " max-w-sm mb-3"} placeholder="Rechercher une campagne par nom…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Masquer les dépenses à 0 $</label>
        <span className="text-muted-foreground">Dépense ($) min</span>
        <input className={inputCls + " w-24"} type="number" min="0" placeholder="ex. 100" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
        <span className="text-muted-foreground">max</span>
        <input className={inputCls + " w-24"} type="number" min="0" value={maxSpend} onChange={(e) => setMaxSpend(e.target.value)} />
        <select className={inputCls + " w-auto"} value={prodF} onChange={(e) => setProdF(e.target.value)}>
          <option value="">Toutes les attributions</option><option value="assigned">Attribuées (tous produits)</option><option value="none">Non attribuées</option>
          {pr.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-muted-foreground">Du</span>
        <input className={inputCls + " w-36"} type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
        <span className="text-muted-foreground">au</span>
        <input className={inputCls + " w-36"} type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} />
        {(hideZero || minSpend || maxSpend || prodF || dFrom || dTo) && <button className="text-xs underline text-muted-foreground" onClick={() => { setHideZero(false); setMinSpend(""); setMaxSpend(""); setProdF(""); setDFrom(""); setDTo("") }}>Réinitialiser</button>}
      </div>
      {a.rows.map((x) => (
        <div key={x.id} className="border-t border-border py-2.5 grid grid-cols-[repeat(13,minmax(0,1fr))] gap-2 text-sm">
          <span className="col-span-2 font-medium truncate" title={x.name}>{x.name}</span><span className="col-span-1">{dateFr(x.date)}</span>
          <span className="col-span-1">{usd(x.spend)}</span><span className="col-span-1 font-medium">{money(x.spend * r)}</span><span className="col-span-1">{x.clicks}</span><span className="col-span-1">{x.purchases}</span>
          <span className="col-span-1">{crmOrders.filter((row) => row.ad_campaign === x.name).length}</span><span className="col-span-1">{x.spend ? (x.revenue / x.spend).toFixed(1) : "—"}</span>
          <select className={inputCls + " col-span-2"} value={x.product_id || ""} onChange={(e) => assign(x, e.target.value)}>
            <option value="">— Non attribuée —</option>
            {pr.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="col-span-1 font-medium">{x.product_id ? (prodOrders.get(`${x.product_id}|${x.date}`) || 0) : "—"}</span>
          <span className="col-span-1 font-medium">{(() => { const n = x.product_id ? (prodOrders.get(`${x.product_id}|${x.date}`) || 0) : 0; return n ? money((x.spend * r) / n) : "—" })()}</span>
        </div>
      ))}
      {!a.rows.length && <Empty text={loading ? "Chargement…" : "Aucune donnée publicitaire. Connectez Meta (page Intégrations) puis synchronisez."} />}
      {totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
          <span className="text-muted-foreground">{page * PAGE + 1}–{Math.min((page + 1) * PAGE, totalRows)} sur {totalRows}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Précédent</Button>
            <span>Page {page + 1} / {Math.max(1, Math.ceil(totalRows / PAGE))}</span>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= totalRows || loading} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}
      {props && (
        <Modal title={`Proposition d'attribution (${props.length})`} onClose={() => setProps(null)} wide>
          <p className="text-sm text-muted-foreground mb-3">Vérifiez les propositions : décochez celles à ignorer ou changez le produit. Rien n'est enregistré avant la validation.</p>
          <div className="flex gap-3 text-xs mb-2">
            <button className="underline" onClick={() => setProps(props.map((p) => ({ ...p, on: true })))}>Tout cocher</button>
            <button className="underline" onClick={() => setProps(props.map((p) => ({ ...p, on: false })))}>Tout décocher</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {props.map((x, i) => (
              <div key={x.key} className="border-t border-border py-2 grid grid-cols-12 gap-2 items-center text-sm">
                <input type="checkbox" className="col-span-1" checked={x.on} onChange={(e) => setProps(props.map((p, j) => j === i ? { ...p, on: e.target.checked } : p))} />
                <div className="col-span-6 min-w-0"><div className="truncate" title={x.name}>{x.name}</div><div className="text-[11px] text-muted-foreground">Mot trouvé : {x.term}</div></div>
                <select className={inputCls + " col-span-5"} value={x.product_id} onChange={(e) => setProps(props.map((p, j) => j === i ? { ...p, product_id: e.target.value } : p))}>
                  {pr.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={validateProps} disabled={propBusy || !props.some((p) => p.on)}>Valider l'attribution ({props.filter((p) => p.on).length})</Button>
        </Modal>
      )}
      {open && (
        <Modal title="Saisie manuelle" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Nom de la campagne"><input className={inputCls} value={f.name} onChange={set("name")} /></Field></div>
            <Field label="Dépense ($)"><input className={inputCls} type="number" value={f.spend} onChange={set("spend")} /></Field>
            <Field label="Revenu ($)"><input className={inputCls} type="number" value={f.revenue} onChange={set("revenue")} /></Field>
            <Field label="Impressions"><input className={inputCls} type="number" value={f.impressions} onChange={set("impressions")} /></Field>
            <Field label="Clics"><input className={inputCls} type="number" value={f.clicks} onChange={set("clicks")} /></Field>
            <Field label="Achats"><input className={inputCls} type="number" value={f.purchases} onChange={set("purchases")} /></Field>
            <Field label="Date"><input className={inputCls} type="date" value={f.date} onChange={set("date")} /></Field>
          </div>
          <Button className="mt-5 w-full" onClick={save}>Enregistrer</Button>
        </Modal>
      )}
    </Shell>
  )
}
