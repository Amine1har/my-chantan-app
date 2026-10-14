import { useCallback, useEffect, useRef, useState } from "react"
import { MessageCircle, Plus } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import SortSelect, { sortList } from "@/components/SortSelect"
import { Empty, Field, Modal, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Order, SHIPPING, STATUSES, dateFr, inputCls, money, statusLabel, waLink } from "@/lib/crm"

type Profile = {
  key: string; phone: string | null; names: { name: string; n: number }[]; main: string
  city: string | null; email: string | null; source: string | null; last_order: string | null
  count: number; delivered: number; total: number
}
const PAGE = 50

const SORTS = [
  { k: "last_desc", l: "Dernière commande : récente" },
  { k: "last_asc", l: "Dernière commande : ancienne" },
  { k: "name_asc", l: "Nom : A → Z" },
  { k: "name_desc", l: "Nom : Z → A" },
  { k: "count_desc", l: "Nombre de commandes : plus élevé" },
  { k: "count_asc", l: "Nombre de commandes : plus bas" },
  { k: "total_desc", l: "Montant livré : plus élevé" },
  { k: "total_asc", l: "Montant livré : plus bas" },
  { k: "city_asc", l: "Ville : A → Z" },
]

const shipLabel = (k: string) => SHIPPING.find((s) => s.k === k)?.l ?? k

export default function Customers() {
  const [rows, setRows] = useState<Profile[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [curOrders, setCurOrders] = useState<Order[]>([])
  const reqRef = useRef(0)
  const [q, setQ] = useState("")
  const [dq, setDq] = useState("")
  const [sort, setSort] = useState("last_desc")
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [f, setF] = useState({ name: "", phone: "", city: "", email: "" })

  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(0) }, [dq, sort])
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const load = useCallback(async () => {
    const id = ++reqRef.current
    setLoading(true)
    let qb = supabase.from("customer_profiles").select("*", { count: "exact" })
    for (const t of norm(dq).split(/\s+/).filter(Boolean)) {
      const c = t.replace(/[%,()*\\]/g, "")
      if (c) qb = qb.ilike("search_text", `%${c}%`)
    }
    const col = sort.startsWith("last") ? "last_order" : sort.startsWith("name") ? "main" : sort.startsWith("count") ? "count" : sort.startsWith("total") ? "total" : "city"
    const from = page * PAGE
    const { data, error, count } = await qb.order(col, { ascending: sort.endsWith("_asc"), nullsFirst: false }).order("key").range(from, from + PAGE - 1)
    if (error) toast.error("Chargement impossible : " + error.message)
    if (id !== reqRef.current) return
    setRows(((data as Profile[]) || []).map((p) => ({ ...p, total: Number(p.total) || 0 })))
    setTotalRows(count || 0)
    setLoading(false)
  }, [page, dq, sort])
  useEffect(() => { load() }, [load])
  const list = rows
  const cur = rows.find((p) => p.key === sel) || null
  useEffect(() => {
    if (!sel) { setCurOrders([]); return }
    supabase.rpc("customer_orders", { p_key: sel }).then(({ data }) => setCurOrders((data as Order[]) || []))
  }, [sel])
  const save = async () => {
    if (!f.name) return toast.error("Nom requis")
    const { error } = await supabase.from("customers").insert({ ...f, source: "manuel" })
    if (error) return toast.error(error.message)
    setOpen(false)
    setF({ name: "", phone: "", city: "", email: "" })
    load()
  }

  return (
    <Shell>
      <PageHead title="Clients" sub="Un seul dossier par numéro de téléphone : toutes les commandes et tous les noms utilisés sont regroupés." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className={inputCls + " max-w-sm"} placeholder="Rechercher : nom, téléphone, ville, n° de commande…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SortSelect value={sort} onChange={setSort} options={SORTS} />
      </div>
      {list.map((p) => (
        <div key={p.key} className="border-t border-border py-3 grid grid-cols-12 gap-3 items-center text-sm">
          <button className="col-span-5 text-left hover:text-accent transition-colors" onClick={() => setSel(p.key)}>
            <div className="font-medium">{p.main}{p.names.length > 1 && <span className="ml-2 text-xs text-muted-foreground">+{p.names.length - 1} autre(s) nom(s)</span>}</div>
            <div className="text-xs text-muted-foreground">{p.phone || "Sans téléphone"} · {p.city || "—"}</div>
          </button>
          <div className="col-span-3">{p.count} commande(s)</div>
          <div className="col-span-3">{money(p.total)} livré</div>
          {p.phone && <a className="col-span-1 text-muted-foreground hover:text-success" href={waLink(p.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>}
        </div>
      ))}
      {!list.length && <Empty text={loading ? "Chargement…" : "Aucun client pour le moment."} />}
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

      {cur && (
        <Modal title={`Dossier client — ${cur.main}`} onClose={() => setSel(null)} wide>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Téléphone</div><div className="font-medium">{cur.phone || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Ville</div><div className="font-medium">{cur.city || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Commandes</div><div className="font-medium">{cur.count} ({cur.delivered} livrée(s))</div></div>
            <div><div className="text-xs text-muted-foreground">Total livré</div><div className="font-medium">{money(cur.total)}</div></div>
          </div>
          <h3 className="mt-5 mb-2 text-sm font-semibold">Noms utilisés</h3>
          <div className="flex flex-wrap gap-1.5">
            {cur.names.map((n) => <span key={n.name} className="rounded-full border border-border px-2.5 py-1 text-xs">{n.name}{n.n > 1 ? ` · ${n.n}×` : ""}</span>)}
          </div>
          <h3 className="mt-5 mb-2 text-sm font-semibold">Historique des commandes</h3>
          <div className="max-h-80 overflow-y-auto">
            {curOrders.map((x) => (
              <div key={x.id} className="border-t border-border py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{x.number || "—"} <span className="text-muted-foreground font-normal">· {dateFr(x.created_at)} · {x.customer_name}</span></span>
                  <span>{money(x.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${STATUSES.find((s) => s.k === x.status)?.cls || ""}`}>Confirmation : {statusLabel(x.status)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">Livraison : {shipLabel(x.shipping_status)}</span>
                  {x.tracking_number && <span className="text-muted-foreground">Suivi {x.tracking_number}</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{(x.items || []).map((it) => `${it.qty}× ${it.name}${[it.color, it.size].filter(Boolean).length ? " (" + [it.color, it.size].filter(Boolean).join(" / ") + ")" : ""}`).join(", ") || "—"}</div>
              </div>
            ))}
            {!curOrders.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune commande pour ce numéro.</p>}
          </div>
        </Modal>
      )}

      {open && (
        <Modal title="Nouveau client" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <Field label="Nom"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Téléphone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Ville"><input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label="E-mail"><input className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          </div>
          <Button className="mt-5 w-full" onClick={save}>Ajouter</Button>
        </Modal>
      )}
    </Shell>
  )
}
