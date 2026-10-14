import { useMemo, useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Empty, Fig, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import CostCenters, { CostCenter } from "@/components/CostCenters"
import { Ad, CATEGORIES, Expense, Order, Product, catLabel, computePnl, dateFr, inputCls, matchQ, money, useRows } from "@/lib/crm"

export default function Accounting() {
  const e = useRows<Expense>("expenses", "date")
  const o = useRows<Order>("orders")
  const p = useRows<Product>("products", "name", true)
  const a = useRows<Ad>("ad_campaigns", "date")
  const cc = useRows<CostCenter>("cost_centers", "name", true)
  const [q, setQ] = useState("")
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [f, setF] = useState({ label: "", category: "autre", cost_center_id: "", amount: "", date: new Date().toISOString().slice(0, 10) })

  const d = useMemo(() => {
    const exps = e.rows.filter((x) => (!month || x.date.startsWith(month)) && matchQ(q, x.label, catLabel(x.category), x.amount, x.date, dateFr(x.date)))
    const orders = o.rows.filter((x) => !month || x.created_at.startsWith(month))
    const ads = a.rows.filter((x) => !month || x.date.startsWith(month))
    const totals: Record<string, number> = {}
    for (const x of e.rows) if (x.cost_center_id && (!month || x.date.startsWith(month))) totals[x.cost_center_id] = (totals[x.cost_center_id] || 0) + x.amount
    return { exps, totals, pnl: computePnl(orders, p.rows, ads, exps) }
  }, [e.rows, o.rows, p.rows, a.rows, month, q])

  const add = async () => {
    if (!f.label || !Number(f.amount)) return toast.error("Libellé et montant requis")
    const { error } = await supabase.from("expenses").insert({ ...f, cost_center_id: f.cost_center_id || null, amount: Number(f.amount) })
    if (error) return toast.error(error.message)
    setF({ ...f, label: "", amount: "" })
    e.reload()
  }
  const del = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id)
    e.reload()
  }

  return (
    <Shell>
      <PageHead title="Comptabilité" sub="Bénéfices, pertes et charges quotidiennes." actions={<input type="month" className={inputCls + " w-44"} value={month} onChange={(ev) => setMonth(ev.target.value)} />} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <Fig label="Chiffre d’affaires (livré)" value={money(d.pnl.revenue)} />
        <Fig label="Coût des produits vendus" value={money(d.pnl.cogs)} />
        <Fig label="Marge brute" value={money(d.pnl.gross)} />
        <Fig label="Publicité Meta" value={money(d.pnl.adSpend)} />
        <Fig label="Charges" value={money(d.pnl.charges)} />
        <Fig label={d.pnl.net >= 0 ? "Bénéfice net" : "Perte nette"} value={money(d.pnl.net)} tone={d.pnl.net >= 0 ? "good" : "bad"} />
      </div>

      <h2 className="text-lg font-semibold mt-12 mb-3">Ajouter une charge</h2>
      <div className="grid md:grid-cols-12 gap-2 border-t border-border pt-4">
        <input className={inputCls + " md:col-span-3"} placeholder="Libellé (ex. loyer, salaire…)" value={f.label} onChange={(ev) => setF({ ...f, label: ev.target.value })} />
        <select className={inputCls + " md:col-span-2"} value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value })}>
          {CATEGORIES.map((c) => <option key={c.k} value={c.k}>{c.l}</option>)}
        </select>
        <select className={inputCls + " md:col-span-2"} value={f.cost_center_id} onChange={(ev) => setF({ ...f, cost_center_id: ev.target.value })}>
          <option value="">Centre…</option>
          {cc.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className={inputCls + " md:col-span-2"} type="number" placeholder="Montant" value={f.amount} onChange={(ev) => setF({ ...f, amount: ev.target.value })} />
        <input className={inputCls + " md:col-span-2"} type="date" value={f.date} onChange={(ev) => setF({ ...f, date: ev.target.value })} />
        <Button className="md:col-span-1" onClick={add}>OK</Button>
      </div>

      <h2 className="text-lg font-semibold mt-10 mb-3">Charges du mois</h2>
      <input className={inputCls + " max-w-sm mb-3"} placeholder="Rechercher une charge : libellé, catégorie, montant, date…" value={q} onChange={(ev) => setQ(ev.target.value)} />
      {d.exps.map((x) => (
        <div key={x.id} className="border-t border-border py-2.5 grid grid-cols-12 gap-2 text-sm items-center">
          <span className="col-span-5">{x.label}{x.cost_center_id && <span className="text-xs text-muted-foreground"> · {cc.rows.find((c) => c.id === x.cost_center_id)?.name}</span>}</span><span className="col-span-3 text-muted-foreground">{catLabel(x.category)}</span>
          <span className="col-span-2 text-muted-foreground">{dateFr(x.date)}</span><span className="col-span-1 font-medium">{money(x.amount)}</span>
          <button className="col-span-1 text-muted-foreground hover:text-destructive justify-self-end" onClick={() => del(x.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      {!d.exps.length && <Empty text="Aucune charge enregistrée sur cette période." />}
      <CostCenters centers={cc.rows} totals={d.totals} reload={cc.reload} />
    </Shell>
  )
}
