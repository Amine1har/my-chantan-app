import { useState } from "react"
import { Lock, LockOpen, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { inputCls } from "@/lib/crm"
import { Account, Entry, KINDS, Line, Period, n2 } from "@/lib/ledger"

export default function PlanPeriods({ accounts, periods, entries, lines, reload }: { accounts: Account[]; periods: Period[]; entries: Entry[]; lines: Line[]; reload: () => void }) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [kind, setKind] = useState("actif")
  const [pn, setPn] = useState("")
  const [ps, setPs] = useState("")
  const [pe, setPe] = useState("")
  const [confirm, setConfirm] = useState<string | null>(null)

  const addAcc = async () => {
    if (!code.trim() || !name.trim()) return toast.error("Code et intitulé requis")
    const { error } = await supabase.from("acc_accounts").insert({ code: code.trim(), name: name.trim(), kind })
    if (error) return toast.error(error.message.includes("duplicate") ? "Ce code existe déjà" : error.message)
    setCode(""); setName(""); reload()
  }
  const delAcc = async (a: Account) => {
    if (lines.some((l) => l.account_id === a.id)) return toast.error("Ce compte a des écritures : suppression impossible")
    const { error } = await supabase.from("acc_accounts").delete().eq("id", a.id)
    if (error) return toast.error(error.message)
    reload()
  }
  const addPer = async () => {
    if (!pn.trim() || !ps || !pe) return toast.error("Nom, début et fin requis")
    if (pe < ps) return toast.error("La fin doit être après le début")
    if (periods.some((p) => ps <= p.end_date && pe >= p.start_date)) return toast.error("Cette période chevauche une période existante")
    const { error } = await supabase.from("acc_periods").insert({ name: pn.trim(), start_date: ps, end_date: pe })
    if (error) return toast.error(error.message)
    setPn(""); setPs(""); setPe(""); reload()
  }
  const close = async (p: Period) => {
    if (periods.some((x) => !x.closed && x.end_date < p.start_date)) return toast.error("Clôturez d’abord les périodes précédentes")
    const res = accounts.find((a) => a.code === "1191")
    if (!res) return toast.error("Le compte 1191 (Résultat de l’exercice) est requis")
    const inP = new Set(entries.filter((e) => e.date <= p.end_date).map((e) => e.id))
    const net = new Map<string, number>()
    for (const l of lines) if (inP.has(l.entry_id)) net.set(l.account_id, (net.get(l.account_id) || 0) + l.debit - l.credit)
    const pl = accounts.filter((a) => (a.kind === "charge" || a.kind === "produit") && Math.abs(net.get(a.id) || 0) > 0.004)
    const sum = pl.reduce((s, a) => s + (net.get(a.id) || 0), 0)
    if (pl.length) {
      const id = crypto.randomUUID()
      const { error } = await supabase.from("acc_entries").insert({ id, date: p.end_date, journal: "CLO", reference: null, label: `Clôture ${p.name}` })
      if (error) return toast.error(error.message)
      const out = pl.map((a) => { const n = net.get(a.id) || 0; return { entry_id: id, account_id: a.id, debit: n < 0 ? -n : 0, credit: n > 0 ? n : 0 } })
      out.push({ entry_id: id, account_id: res.id, debit: sum > 0 ? sum : 0, credit: sum < 0 ? -sum : 0 })
      const { error: e2 } = await supabase.from("acc_lines").insert(out)
      if (e2) { await supabase.from("acc_entries").delete().eq("id", id); return toast.error(e2.message) }
    }
    const { error } = await supabase.from("acc_periods").update({ closed: true, closed_at: new Date().toISOString() }).eq("id", p.id)
    if (error) return toast.error(error.message)
    toast.success(`Période clôturée — ${sum <= 0 ? "bénéfice" : "perte"} : ${n2(Math.abs(sum))} DH`)
    setConfirm(null); reload()
  }
  const reopen = async (p: Period) => {
    if (periods.some((x) => x.closed && x.start_date > p.start_date)) return toast.error("Rouvrez d’abord les périodes suivantes")
    await supabase.from("acc_entries").delete().eq("journal", "CLO").eq("label", `Clôture ${p.name}`)
    const { error } = await supabase.from("acc_periods").update({ closed: false, closed_at: null }).eq("id", p.id)
    if (error) return toast.error(error.message)
    reload()
  }
  const delPer = async (p: Period) => {
    const { error } = await supabase.from("acc_periods").delete().eq("id", p.id)
    if (error) return toast.error(error.message)
    reload()
  }

  return (
    <div className="grid lg:grid-cols-2 gap-12">
      <section>
        <h2 className="text-lg font-semibold mb-1">Périodes comptables</h2>
        <p className="text-sm text-muted-foreground mb-3">À la clôture, les comptes de charges et de produits sont soldés vers le compte 1191 (Résultat) et la période n’accepte plus d’écritures. Les soldes de bilan sont reportés automatiquement dans la période suivante.</p>
        <div className="grid grid-cols-12 gap-2 mb-4">
          <input className={inputCls + " col-span-12"} placeholder="Nom (ex. Exercice 2026)" value={pn} onChange={(e) => setPn(e.target.value)} />
          <input type="date" className={inputCls + " col-span-5"} value={ps} onChange={(e) => setPs(e.target.value)} />
          <input type="date" className={inputCls + " col-span-5"} value={pe} onChange={(e) => setPe(e.target.value)} />
          <Button className="col-span-2" onClick={addPer}>OK</Button>
        </div>
        {periods.map((p) => (
          <div key={p.id} className="border-t border-border py-2.5 flex items-center justify-between gap-3 text-sm">
            <span>{p.name} <span className="text-muted-foreground">· {new Date(p.start_date + "T12:00:00Z").toLocaleDateString("fr-FR")} → {new Date(p.end_date + "T12:00:00Z").toLocaleDateString("fr-FR")}</span></span>
            <span className="flex items-center gap-2">
              {p.closed ? (
                <Button size="sm" variant="outline" onClick={() => reopen(p)}><LockOpen className="h-4 w-4 mr-1" />Rouvrir</Button>
              ) : confirm === p.id ? (
                <>
                  <Button size="sm" onClick={() => close(p)}>Confirmer la clôture</Button>
                  <button className="text-xs underline text-muted-foreground" onClick={() => setConfirm(null)}>Annuler</button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(p.id)}><Lock className="h-4 w-4 mr-1" />Clôturer</Button>
                  <button className="text-muted-foreground hover:text-destructive" aria-label="Supprimer la période" onClick={() => delPer(p)}><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </span>
          </div>
        ))}
        {!periods.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune période. Créez par exemple un exercice annuel.</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Plan comptable</h2>
        <p className="text-sm text-muted-foreground mb-3">Un plan de base est déjà prêt. Ajoutez vos propres comptes.</p>
        <div className="grid grid-cols-12 gap-2 mb-4">
          <input className={inputCls + " col-span-3"} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className={inputCls + " col-span-9"} placeholder="Intitulé" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={inputCls + " col-span-9"} value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Button className="col-span-3" onClick={addAcc}>Ajouter</Button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {accounts.map((a) => (
            <div key={a.id} className="border-t border-border py-2 flex items-center justify-between gap-3 text-sm">
              <span><span className="text-muted-foreground">{a.code}</span> {a.name}</span>
              <span className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{KINDS[a.kind] || a.kind}</span>
                <button className="text-muted-foreground hover:text-destructive" aria-label="Supprimer le compte" onClick={() => delAcc(a)}><Trash2 className="h-4 w-4" /></button></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
