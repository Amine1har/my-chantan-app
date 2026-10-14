import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { missingGroups } from "@/components/MissingProducts"
import { AlertTriangle, Plus } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Empty, Field, Modal, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import OrderRow from "@/components/OrderRow"
import SortSelect, { sortList } from "@/components/SortSelect"
import { Link } from "react-router-dom"
import { CONFIRM_STATUSES, Carrier, feeFor, Item, Order, Product, ProductVariant, SHIPPING, STATUSES, dateFr, dateTimeFr, statusLabel, findProduct, findVariant, inputCls, itemIssue, logicIssues, money, phoneKey, useRows } from "@/lib/crm"

const SORTS = [
  { k: "date_desc", l: "Date : plus récentes" },
  { k: "date_asc", l: "Date : plus anciennes" },
  { k: "name_asc", l: "Client : A → Z" },
  { k: "name_desc", l: "Client : Z → A" },
  { k: "num_desc", l: "N° de commande : décroissant" },
  { k: "num_asc", l: "N° de commande : croissant" },
  { k: "total_desc", l: "Montant : plus élevé" },
  { k: "total_asc", l: "Montant : plus bas" },
  { k: "city_asc", l: "Ville : A → Z" },
  { k: "city_desc", l: "Ville : Z → A" },
]
const orderGet = (k: string) => (x: Order): unknown =>
  k.startsWith("date") ? x.created_at : k.startsWith("name") ? x.customer_name : k.startsWith("num") ? Number((x.number || "").replace(/\D/g, "")) || null : k.startsWith("total") ? x.total : x.city

const OPS = [
  { k: "gt", l: "supérieur à (>)" }, { k: "gte", l: "supérieur ou égal (≥)" }, { k: "lt", l: "inférieur à (<)" }, { k: "lte", l: "inférieur ou égal (≤)" }, { k: "eq", l: "égal à (=)" }, { k: "between", l: "entre" },
]
type NumF = { op: string; a: string; b: string }
const numActive = (f: NumF) => f.op !== "" && f.a !== "" && (f.op !== "between" || f.b !== "")
const numOk = (f: NumF, n: number) => {
  if (!numActive(f)) return true
  const a = Number(f.a), b = Number(f.b)
  return f.op === "gt" ? n > a : f.op === "gte" ? n >= a : f.op === "lt" ? n < a : f.op === "lte" ? n <= a : f.op === "eq" ? n === a : n >= Math.min(a, b) && n <= Math.max(a, b)
}
const applyNum = (qb: any, col: string, f: NumF) => {
  if (!numActive(f)) return qb
  const a = Number(f.a), b = Number(f.b)
  return f.op === "gt" ? qb.gt(col, a) : f.op === "gte" ? qb.gte(col, a) : f.op === "lt" ? qb.lt(col, a) : f.op === "lte" ? qb.lte(col, a) : f.op === "eq" ? qb.eq(col, a) : qb.gte(col, Math.min(a, b)).lte(col, Math.max(a, b))
}
function NumFilter({ label, f, set }: { label: string; f: NumF; set: (f: NumF) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select className={inputCls + " w-auto"} value={f.op} onChange={(e) => set({ ...f, op: e.target.value })}>
        <option value="">—</option>
        {OPS.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
      </select>
      {f.op && <input className={inputCls + " w-24"} type="number" value={f.a} onChange={(e) => set({ ...f, a: e.target.value })} />}
      {f.op === "between" && <><span className="text-muted-foreground">et</span><input className={inputCls + " w-24"} type="number" value={f.b} onChange={(e) => set({ ...f, b: e.target.value })} /></>}
    </div>
  )
}

const badge = (k: string) => STATUSES.find((s) => s.k === k)?.cls ?? ""

export default function Orders() {
  const p = useRows<Product>("products", "name", true)
  const car = useRows<Carrier>("carriers", "name", true)
  const vr = useRows<ProductVariant>("product_variants")
  const [tab, setTab] = useState("all")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState("date_desc")
  const [livcashStatusFilter, setLivcashStatusFilter] = useState("all")
  const [amt, setAmt] = useState<NumF>({ op: "", a: "", b: "" })
  const [cnt, setCnt] = useState<NumF>({ op: "", a: "", b: "" })
  const [newOpen, setNewOpen] = useState(false)
  const [detail, setDetail] = useState<Order | null>(null)

  const PAGE = 50
  const [page, setPage] = useState(0)
  const [pageRows, setPageRows] = useState<Order[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<{ total: number; status: Record<string, number>; ship: Record<string, number> }>({ total: 0, status: {}, ship: {} })
  const [slim, setSlim] = useState<Order[]>([])
  const [dq, setDq] = useState("")
  const reqRef = useRef(0)
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(0) }, [dq, tab, sort, livcashStatusFilter, amt, cnt])
  const slimOk = (x: Order) => numOk(amt, Number(x.total) || 0) && numOk(cnt, (x.items || []).length)
  const issueIds = useMemo(() => slim.filter((x) => !["annulee", "retournee"].includes(x.status) && (x.items || []).some((it) => itemIssue(it, p.rows, vr.rows))).map((x) => x.id), [slim, p.rows, vr.rows])
  const logicMap = useMemo(() => {
    const m = new Map<string, { number: string | null; reasons: string[] }>()
    const phones = new Map<string, number>()
    for (const x of slim) { const k = phoneKey(x.phone); if (k) phones.set(k, (phones.get(k) || 0) + 1) }
    for (const x of slim) {
      if (["annulee", "retournee"].includes(x.status)) continue
      const reasons: string[] = []
      const zero = (x.items || []).filter((it) => !it.exchange && (Number(it.price) || 0) <= 0).length
      if ((Number(x.total) || 0) > 0 && zero > 0) reasons.push(`Montant renseigné mais ${zero} produit(s) à 0 DH`)
      if ((x.items || []).some((it) => it.exchange)) {
        const k = phoneKey(x.phone)
        if (!k) reasons.push("Échange sans numéro de téléphone")
        else if ((phones.get(k) || 0) < 2) reasons.push("Échange : ce numéro n’existe dans aucune autre commande")
      }
      if (reasons.length) m.set(x.id, { number: x.number, reasons })
    }
    return m
  }, [slim])
  const logicIds = useMemo(() => [...logicMap.keys()], [logicMap])
  const normQ = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const loadPage = useCallback(async () => {
    const id = ++reqRef.current
    setLoading(true)
    const from = page * PAGE
    let rows: Order[] = []
    let count = 0
    if (tab === "__issue" || tab === "__logic") {
      const slimMap = new Map(slim.map((s) => [s.id, s]))
      const src = (tab === "__logic" ? logicIds : issueIds).filter((id) => { const s = slimMap.get(id); return !s || slimOk(s) })
      const ids = src.slice(from, from + PAGE)
      count = src.length
      if (ids.length) {
        const { data, error } = await supabase.from("orders").select("*").in("id", ids)
        if (error) toast.error("Chargement impossible : " + error.message)
        rows = sortList((data as Order[]) || [], orderGet(sort), sort.endsWith("_asc"))
      }
    } else {
      let qb = supabase.from("orders").select("*", { count: "exact" })
      if (tab !== "all") qb = qb.eq("status", tab)
      qb = applyNum(applyNum(qb, "total", amt), "items_count", cnt)
      if (livcashStatusFilter === "__empty") qb = qb.or("shipping_status.is.null,shipping_status.eq.")
      else if (livcashStatusFilter !== "all") qb = qb.eq("shipping_status", livcashStatusFilter)
      for (const t of normQ(dq).split(/\s+/).filter(Boolean)) {
        const clean = t.replace(/[%,()*\\]/g, "")
        if (!clean) continue
        const alt = clean.replace(/^0+/, "")
        qb = alt && alt !== clean ? qb.or(`search_text.ilike.%${clean}%,search_text.ilike.%${alt}%`) : qb.ilike("search_text", `%${clean}%`)
      }
      const col = sort.startsWith("date") ? "created_at" : sort.startsWith("name") ? "customer_name" : sort.startsWith("num") ? "number" : sort.startsWith("total") ? "total" : "city"
      const { data, error, count: c } = await qb.order(col, { ascending: sort.endsWith("_asc") }).order("id").range(from, from + PAGE - 1)
      if (error) toast.error("Chargement impossible : " + error.message)
      rows = (data as Order[]) || []
      count = c || 0
    }
    if (id !== reqRef.current) return
    setPageRows(rows)
    setTotalRows(count)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab, dq, sort, livcashStatusFilter, issueIds, logicIds, amt, cnt])
  const loadCounts = useCallback(async () => {
    const { data } = await supabase.rpc("order_counts")
    if (data) setCounts(data as typeof counts)
  }, [])
  const loadSlim = useCallback(async () => {
    const all: Order[] = []
    for (let from = 0; from < 50000; from += 1000) {
      const { data } = await supabase.from("orders").select("id,number,status,items,total,phone").order("created_at", { ascending: false }).order("id").range(from, from + 999)
      all.push(...((data as Order[]) || []))
      if (!data || data.length < 1000) break
    }
    setSlim(all)
  }, [])
  useEffect(() => { loadPage() }, [loadPage])
  useEffect(() => { loadCounts(); loadSlim() }, [loadCounts, loadSlim])
  const o = { rows: pageRows, loading, reload: () => { loadPage(); loadCounts() } }

  const livcashCarrierNames = new Set(car.rows.filter((c) => c.type === "livcash").map((c) => c.name))
  const livcashStatuses = [...new Set([
    ...Object.keys(counts.ship).filter(Boolean),
    ...car.rows.filter((c) => c.type === "livcash").flatMap((c) => (c.delivery_statuses || "").split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean)),
  ])].sort((a, b) => a.localeCompare(b, "fr"))
  const list = pageRows

  const reloadAll = () => { loadPage(); loadCounts(); loadSlim(); p.reload(); vr.reload() }
  const issueCount = issueIds.length

  const setStatus = async (x: Order, status: string) => {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === "livree") patch.shipping_status = "livre"
    if (status === "retournee") patch.shipping_status = "retourne"
    if (status === "expediee" && x.shipping_status === "en_attente") patch.shipping_status = "en_transit"
    const { error } = await supabase.from("orders").update(patch).eq("id", x.id)
    if (error) return toast.error(error.message)
    const wasOut = ["expediee", "livree"].includes(x.status)
    if (status === "expediee" && !wasOut) {
      for (const it of x.items || []) {
        const prod = findProduct(it, p.rows)
        if (!prod) continue
        const v = vr.rows.find((r) => r.id === it.variant_id) || findVariant(it, prod, vr.rows)
        if (v) await supabase.from("product_variants").update({ stock: Math.max(0, v.stock - it.qty) }).eq("id", v.id)
        await supabase.from("products").update({ stock: Math.max(0, prod.stock - it.qty) }).eq("id", prod.id)
        await supabase.from("stock_movements").insert({ product_id: prod.id, type: "sortie", quantity: it.qty, note: `Commande ${x.number ?? ""}${v ? ` · ${[v.color, v.size].filter(Boolean).join(" / ")}` : ""}` })
      }
    }
    toast.success("Statut mis à jour")
    reloadAll()
  }

  const setCarrier = async (x: Order, name: string) => {
    const fee = feeFor(car.rows.find((c) => c.name === name), x.city)
    const { error } = await supabase.from("orders").update({ carrier: name || null, ...(fee != null ? { delivery_fee: fee } : {}), updated_at: new Date().toISOString() }).eq("id", x.id)
    if (error) return toast.error(error.message)
    toast.success("Transporteur mis à jour")
    o.reload()
  }

  const setShipping = async (x: Order, s: string) => {
    const { error } = await supabase.from("orders").update({ shipping_status: s, updated_at: new Date().toISOString() }).eq("id", x.id)
    if (error) return toast.error(error.message)
    if (s === "livre" && x.status !== "livree") await setStatus(x, "livree")
    else if (s === "retourne" && x.status !== "retournee") await setStatus(x, "retournee")
    else o.reload()
  }

  return (
    <Shell>
      <PageHead
        title="Commandes"
        sub="Équipe de confirmation : appelez, mettez à jour le statut et suivez la livraison."
        actions={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nouvelle commande</Button>}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setTab("all")} className={`px-3 py-1 rounded-full text-xs border ${tab === "all" ? "bg-primary text-primary-foreground" : "border-border"}`}>Toutes ({counts.total})</button>
        {CONFIRM_STATUSES.map((s) => (
          <button key={s.k} onClick={() => setTab(s.k)} className={`px-3 py-1 rounded-full text-xs border ${tab === s.k ? "bg-primary text-primary-foreground" : "border-border"}`}>
            {s.l} ({counts.status[s.k] ?? 0})
          </button>
        ))}
        <button onClick={() => setTab("nouvelle")} className={`px-3 py-1 rounded-full text-xs border ${tab === "nouvelle" ? "bg-primary text-primary-foreground" : "border-border"}`}>Nouvelle ({counts.status["nouvelle"] ?? 0})</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className={inputCls + " max-w-sm"} placeholder="Rechercher : nom, téléphone, n° de commande, montant, ville, produit, suivi…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SortSelect value={sort} onChange={setSort} options={SORTS} />
        <select className={inputCls + " max-w-xs"} aria-label="Filtrer par statut de confirmation" value={tab.startsWith("__") ? "all" : tab} onChange={(e) => setTab(e.target.value)}>
          <option value="all">Tous les statuts de confirmation ({counts.total})</option>
          {Object.entries(counts.status).filter(([, n]) => n > 0).sort((a, b) => statusLabel(a[0]).localeCompare(statusLabel(b[0]), "fr")).map(([k, n]) => <option key={k} value={k}>{statusLabel(k)} ({n})</option>)}
        </select>
        <button
          type="button"
          onClick={() => setTab(tab === "__issue" ? "all" : "__issue")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${tab === "__issue" ? "border-destructive bg-destructive text-destructive-foreground" : "border-destructive/50 text-destructive hover:bg-destructive/5"}`}
        >
          <AlertTriangle className="h-4 w-4" /> Erreur produit ({issueCount})
        </button>
        <button
          type="button"
          onClick={() => setTab(tab === "__logic" ? "all" : "__logic")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${tab === "__logic" ? "border-destructive bg-destructive text-destructive-foreground" : "border-destructive/50 text-destructive hover:bg-destructive/5"}`}
        >
          <AlertTriangle className="h-4 w-4" /> Erreur logique ({logicIds.length})
        </button>
        <select className={inputCls + " max-w-xs"} aria-label="Filtrer par statut de livraison" value={livcashStatusFilter} onChange={(e) => setLivcashStatusFilter(e.target.value)}>
          <option value="all">Tous les statuts de livraison</option>
          {livcashStatuses.map((s) => <option key={s} value={s}>{SHIPPING.find((z) => z.k === s)?.l ?? s} ({counts.ship[s] ?? 0})</option>)}
          <option value="__empty">Statut de livraison non renseigné</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <NumFilter label="Montant (DH)" f={amt} set={setAmt} />
        <NumFilter label="Nombre de produits" f={cnt} set={setCnt} />
        {(numActive(amt) || numActive(cnt) || amt.op || cnt.op) && <button className="text-xs underline text-muted-foreground" onClick={() => { setAmt({ op: "", a: "", b: "" }); setCnt({ op: "", a: "", b: "" }) }}>Réinitialiser</button>}
      </div>
      {tab === "__logic" && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1 max-h-56 overflow-y-auto">
          <p className="font-medium text-destructive">{logicIds.length} commande(s) en erreur logique (produit à 0 DH avec montant renseigné, ou échange dont le téléphone est introuvable dans une autre commande)</p>
          {pageRows.map((r) => <p key={r.id}><span className="font-medium">{logicMap.get(r.id)?.number || r.number}</span> — {(logicMap.get(r.id)?.reasons || []).join(" · ")}</p>)}
        </div>
      )}
      {issueCount > 0 && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {issueCount} commande(s) contiennent un produit ou une variante absents du stock.
            <button className="underline" onClick={() => setTab(tab === "__issue" ? "all" : "__issue")}>{tab === "__issue" ? "Voir toutes les commandes" : "Voir uniquement ces commandes"}</button>
            <Link to="/stock" className="underline">Aller au stock</Link>
          </div>
          {tab === "__issue" && (
            <ul className="mt-2 text-xs text-foreground space-y-0.5">
              {missingGroups(slim, p.rows, vr.rows).sort((a, b) => b.orders - a.orders).map((g) => (
                <li key={g.name}>• <b>{g.name}</b> — {g.orders} commande(s) — {g.kind === "produit" ? "produit inconnu" : "variante inconnue"}{g.combos.length ? ` (${g.combos.map((c) => [c.color, c.size].filter(Boolean).join(" / ")).join(", ")})` : ""}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {list.map((x) => (
        <OrderRow key={x.id} x={x} products={p.rows} variants={vr.rows} carriers={car.rows} badge={badge(x.status)} onStatus={setStatus} onShipping={setShipping} onCarrier={setCarrier} onDetail={setDetail} reload={reloadAll} />
      ))}
      {!list.length && <Empty text={loading ? "Chargement…" : "Aucune commande. Importez depuis Shopify ou ajoutez une commande WhatsApp."} />}
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

      {newOpen && <NewOrder orders={o.rows} carriers={car.rows} products={p.rows} variants={vr.rows} onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); reloadAll() }} />}
      {detail && <Detail order={detail} carriers={car.rows} isLivcash={livcashCarrierNames.has(detail.carrier || "")} onClose={() => setDetail(null)} onDone={() => { setDetail(null); o.reload() }} />}
    </Shell>
  )
}

function NewOrder({ orders, carriers, products, variants, onClose, onDone }: { orders: Order[]; carriers: Carrier[]; products: Product[]; variants: ProductVariant[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ customer_name: "", phone: "", city: "", address: "", source: "whatsapp", notes: "", ad_campaign: "" })
  type Line = { product_id: string; qty: number; color: string; size: string }
  const blank: Line = { product_id: "", qty: 1, color: "", size: "" }
  const [lines, setLines] = useState<Line[]>([blank])
  const upd = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const [total, setTotal] = useState("")
  const [busy, setBusy] = useState(false)
  const [carrier, setCarrier] = useState("Autre")
  const [isEx, setIsEx] = useState(false)
  const [exQ, setExQ] = useState("")
  const [origin, setOrigin] = useState<Order | null>(null)
  const exNorm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const exTokens = exNorm(exQ).split(/\s+/).filter(Boolean)
  const [exResults, setExResults] = useState<Order[]>([])
  useEffect(() => {
    if (origin || !exTokens.length) { setExResults([]); return }
    const t = setTimeout(async () => {
      let qb = supabase.from("orders").select("*")
      for (const w of exTokens) { const c = w.replace(/[%,()*\\]/g, ""); if (c) qb = qb.ilike("search_text", `%${c}%`) }
      const { data } = await qb.order("created_at", { ascending: false }).limit(8)
      setExResults((data as Order[]) || [])
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exQ, origin])
  const pickOrigin = (x: Order) => {
    setOrigin(x)
    setF((p) => ({ ...p, customer_name: x.customer_name || "", phone: x.phone || "", city: x.city || "", address: x.address || "" }))
    if (x.carrier && carriers.some((c) => c.name === x.carrier && c.active)) setCarrier(x.carrier)
    else setCarrier("Autre")
    const ls = (x.items || []).map((it) => { const pr = findProduct(it, products); return { product_id: pr?.id || "", qty: it.qty || 1, color: it.color || "", size: it.size || "" } })
    setLines(ls.length ? ls : [blank])
    setTotal("")
  }
  const curCar = carriers.find((c) => c.name === carrier)
  const cityList = [...new Set(String(curCar?.cities || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"))
  const items: Item[] = lines.filter((l) => l.product_id).map((l) => {
    const pr = products.find((x) => x.id === l.product_id)!
    const v = variants.find((r) => r.product_id === pr.id && r.color === l.color && r.size === l.size)
    return { product_id: pr.id, ...(v ? { variant_id: v.id } : {}), name: pr.name, color: l.color || undefined, size: l.size || undefined, qty: l.qty, price: pr.price, cost: pr.cost }
  })
  const auto = items.reduce((s, i) => s + i.price * i.qty, 0)

  const save = async () => {
    if (!f.customer_name || !f.phone) return toast.error("Nom et téléphone requis")
    setBusy(true)
    try {
      const d = new Date()
      const stamp = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
      let number = ""
      for (let n = 0; n < 8; n++) {
        const cand = `CB-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        const { data: dup } = await supabase.from("orders").select("id").eq("number", cand).limit(1)
        if (!dup?.length) { number = cand; break }
      }
      if (!number) throw new Error("Impossible de générer un ID unique, réessayez")
      const { error } = await supabase.from("orders").insert({ ...f, ad_campaign: f.ad_campaign || null, items, total: total === "" ? auto : Number(total), number, status: "confirmee", carrier, is_exchange: isEx, exchange_of: isEx && origin ? (origin.number || origin.id) : null, ...(feeFor(curCar, f.city) != null ? { delivery_fee: feeFor(curCar, f.city) } : {}) })
      if (error) throw error
      const { data: ex } = await supabase.from("customers").select("id,phone")
      if (!(ex || []).some((c: { phone: string | null }) => phoneKey(c.phone) === phoneKey(f.phone))) {
        await supabase.from("customers").insert({ name: f.customer_name, phone: f.phone, city: f.city, address: f.address, source: f.source })
      }
      toast.success("Commande ajoutée")
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal title="Nouvelle commande" onClose={onClose} wide>
      <label className="flex items-center gap-2 text-sm mb-3 font-medium"><input type="checkbox" checked={isEx} onChange={(e) => { setIsEx(e.target.checked); if (!e.target.checked) { setOrigin(null); setExQ("") } }} /> Cette commande est un échange</label>
      {isEx && (
        <div className="mb-4 rounded-md border border-border p-3 space-y-2">
          {origin ? (
            <div className="flex items-center justify-between text-sm">
              <span>Échange de la commande <strong>{origin.number}</strong> · {origin.customer_name}</span>
              <button className="text-xs text-accent" onClick={() => { setOrigin(null); setExQ("") }}>Changer</button>
            </div>
          ) : <>
            <input className={inputCls} placeholder="Rechercher l’ancienne commande : nom, téléphone ou n° de commande…" value={exQ} onChange={(e) => setExQ(e.target.value)} />
            {exResults.map((x) => <button key={x.id} type="button" onClick={() => pickOrigin(x)} className="block w-full text-left text-sm border-t border-border py-1.5 hover:text-accent">{x.number} · {x.customer_name} · {x.phone} · {x.city} · {money(x.total)}</button>)}
            {exTokens.length > 0 && !exResults.length && <p className="text-xs text-muted-foreground">Aucune commande trouvée.</p>}
          </>}
          <p className="text-xs text-muted-foreground">Les infos de l’ancienne commande sont reprises ; modifiez seulement la couleur, la taille ou le produit.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom du client"><input className={inputCls} value={f.customer_name} onChange={set("customer_name")} /></Field>
        <Field label="Téléphone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Transporteur">
          <select className={inputCls} value={carrier} onChange={(e) => { setCarrier(e.target.value); setF({ ...f, city: "" }) }}>
            {carriers.filter((c) => (c.type === "nevada" || c.type === "livcash") && c.active).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value="Autre">Autre</option>
          </select>
        </Field>
        <Field label="Ville">{cityList.length ? (
          <select className={inputCls} value={f.city} onChange={set("city")}>
            <option value="">Ville…</option>
            {cityList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : <input className={inputCls} value={f.city} onChange={set("city")} />}</Field>
        <Field label="Origine">
          <select className={inputCls} value={f.source} onChange={set("source")}>
            <option value="whatsapp">WhatsApp</option><option value="manuel">Manuelle</option><option value="instagram">Instagram</option>
          </select>
        </Field>
        <div className="col-span-2"><Field label="Adresse"><input className={inputCls} value={f.address} onChange={set("address")} /></Field></div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Produits</div>
        {lines.map((l, i) => {
          const vs = variants.filter((v) => v.product_id === l.product_id)
          const colors = [...new Set(vs.map((v) => v.color).filter(Boolean))]
          const sizes = [...new Set(vs.filter((v) => !l.color || v.color === l.color).map((v) => v.size).filter(Boolean))]
          return (
            <div key={i} className="flex gap-2">
              <select className={inputCls} value={l.product_id} onChange={(e) => upd(i, { product_id: e.target.value, color: "", size: "" })}>
                <option value="">Choisir un produit…</option>
                {products.map((x) => <option key={x.id} value={x.id}>{x.name} — {money(x.price)}</option>)}
              </select>
              <select className={inputCls + " w-32"} value={l.color} disabled={!colors.length} onChange={(e) => upd(i, { color: e.target.value, size: "" })}>
                <option value="">Couleur…</option>
                {colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className={inputCls + " w-28"} value={l.size} disabled={!sizes.length} onChange={(e) => upd(i, { size: e.target.value })}>
                <option value="">Taille…</option>
                {sizes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className={inputCls + " w-20"} type="number" min={1} value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) || 1 })} />
            </div>
          )
        })}
        <button className="text-xs text-accent" onClick={() => setLines([...lines, blank])}>+ Ajouter un produit</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label={`Total (calculé : ${money(auto)})`}><input className={inputCls} type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={String(auto)} /></Field>
        <Field label="Campagne pub (optionnel)"><input className={inputCls} value={f.ad_campaign} onChange={set("ad_campaign")} /></Field>
        <div className="col-span-2"><Field label="Notes"><input className={inputCls} value={f.notes} onChange={set("notes")} /></Field></div>
      </div>
      <Button className="mt-5 w-full" disabled={busy} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer la commande"}</Button>
    </Modal>
  )
}

function Detail({ order, carriers, isLivcash, onClose, onDone }: { order: Order; carriers: Carrier[]; isLivcash: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ tracking_number: order.tracking_number || "", carrier: order.carrier || "", address: order.address || "", notes: order.notes || "" })
  const [statusHistory, setStatusHistory] = useState<{ id: string; status: string; received_at: string }[]>([])
  const [historyLoading, setHistoryLoading] = useState(isLivcash)
  useEffect(() => {
    if (!isLivcash) { setHistoryLoading(false); return }
    let active = true
    supabase.from("livcash_status_history").select("id,status,received_at").eq("order_id", order.id).order("received_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return
      if (error) toast.error("Historique Livcash indisponible : " + error.message)
      setStatusHistory((data as { id: string; status: string; received_at: string }[]) || [])
      setHistoryLoading(false)
    })
    return () => { active = false }
  }, [order.id, isLivcash])
  const save = async () => {
    const { error } = await supabase.from("orders").update({ ...f, updated_at: new Date().toISOString() }).eq("id", order.id)
    if (error) return toast.error(error.message)
    toast.success("Commande mise à jour")
    onDone()
  }
  return (
    <Modal title={`Commande ${order.number ?? ""}`} onClose={onClose}>
      <div className="text-sm mb-4">
        <div className="font-medium">{order.customer_name} · {order.phone}</div>
        {(order.items || []).map((i, n) => <div key={n} className="text-muted-foreground">{i.qty} × {i.name} — {money(i.price)}</div>)}
        <div className="mt-1 font-medium">Total : {money(order.total)}</div>
      </div>
      <div className="space-y-3">
        <Field label="Transporteur"><input className={inputCls} list="carrier-list" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
        <datalist id="carrier-list">{carriers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        <Field label="Numéro de suivi"><input className={inputCls} value={f.tracking_number} onChange={(e) => setF({ ...f, tracking_number: e.target.value })} /></Field>
        <Field label="Adresse"><input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Notes de confirmation"><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      {isLivcash && <section className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Historique des statuts Livcash</h3>
        {historyLoading ? <p className="mt-2 text-xs text-muted-foreground">Chargement de l’historique…</p> : statusHistory.length ? <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {statusHistory.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 text-sm"><span>{entry.status}</span><time className="shrink-0 text-xs text-muted-foreground">{dateTimeFr(entry.received_at)}</time></li>)}
        </ol> : <p className="mt-2 text-xs text-muted-foreground">Aucun statut Livcash reçu pour le moment.</p>}
      </section>}
      <Button className="mt-5 w-full" onClick={save}>Enregistrer</Button>
    </Modal>
  )
}
