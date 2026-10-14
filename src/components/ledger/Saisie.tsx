import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { inputCls } from "@/lib/crm"
import { Account, Center, Entry, JOURNALS, Line, Period, closedPeriodFor, lineCenters, n2 } from "@/lib/ledger"

type Draft = { account_id: string; debit: string; credit: string; cost_center_id: string; cc2_id: string; profit_center_id: string; project_id: string }
const blank = (): Draft => ({ account_id: "", debit: "", credit: "", cost_center_id: "", cc2_id: "", profit_center_id: "", project_id: "" })
const CC_FIELDS: { k: "cost_center_id" | "cc2_id" | "profit_center_id" | "project_id"; kind: string; label: string }[] = [
  { k: "cost_center_id", kind: "cout", label: "Centre de coût" },
  { k: "cc2_id", kind: "cc2", label: "CC2" },
  { k: "profit_center_id", kind: "profit", label: "Centre de profit" },
  { k: "project_id", kind: "projet", label: "Centre de projet" },
]
const today = () => new Date().toISOString().slice(0, 10)
const newSuffix = (used: Set<string>, prefix: string) => {
  for (let i = 0; i < 50; i++) {
    const s = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X")
    if (!used.has(prefix + s)) return s
  }
  return Date.now().toString(36).toUpperCase().slice(-6)
}
const num = (s: string) => Number(String(s).replace(",", ".")) || 0

export default function Saisie({ accounts, periods, entries, lines, centers, reload }: { accounts: Account[]; periods: Period[]; entries: Entry[]; lines: Line[]; centers: Center[]; reload: () => void }) {
  const [date, setDate] = useState(today())
  const [journal, setJournal] = useState("OD")
  const [reference, setReference] = useState("")
  const [suffix, setSuffix] = useState(() => newSuffix(new Set(), ""))
  const prefix = `${journal}-${date.replace(/-/g, "")}-`
  const piece = prefix + suffix
  const used = new Set(entries.map((e) => e.piece || ""))
  const regen = () => setSuffix(newSuffix(used, prefix))
  const [label, setLabel] = useState("")
  const [rows, setRows] = useState<Draft[]>([blank(), blank()])
  const [busy, setBusy] = useState(false)
  const [limit, setLimit] = useState(30)
  const [editId, setEditId] = useState<string | null>(null)
  const [exoOv, setExoOv] = useState<string | null>(null)
  const [perOv, setPerOv] = useState<string | null>(null)
  const exo = exoOv ?? date.slice(0, 4)
  const per = perOv ?? String(Number(date.slice(5, 7)) || 1)
  const resetForm = () => { setEditId(null); setExoOv(null); setPerOv(null); setLabel(""); setReference(""); setRows([blank(), blank()]); setDate(today()) }
  const startEdit = (e: Entry) => {
    setEditId(e.id); setDate(e.date); setJournal(e.journal); setReference(e.reference || ""); setLabel(e.label)
    setExoOv(e.exercice ? String(e.exercice) : null); setPerOv(e.periode ? String(e.periode) : null)
    setRows(lines.filter((l) => l.entry_id === e.id).map((l) => ({ account_id: l.account_id, debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "", cost_center_id: l.cost_center_id || "", cc2_id: l.cc2_id || "", profit_center_id: l.profit_center_id || "", project_id: l.project_id || "" })))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const td = rows.reduce((s, r) => s + num(r.debit), 0)
  const tc = rows.reduce((s, r) => s + num(r.credit), 0)
  const ok = Math.abs(td - tc) < 0.005 && td > 0
  const upd = (i: number, k: keyof Draft, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const accOf = (id: string) => accounts.find((a) => a.id === id)

  const save = async () => {
    if (!label.trim()) return toast.error("Libellé requis")
    const valid = rows.filter((r) => r.account_id && (num(r.debit) || num(r.credit)))
    if (valid.length < 2) return toast.error("Au moins deux lignes avec compte et montant")
    if (valid.some((r) => num(r.debit) && num(r.credit))) return toast.error("Une ligne ne peut pas avoir débit et crédit à la fois")
    if (!ok) return toast.error("L’écriture n’est pas équilibrée (débit ≠ crédit)")
    const cp = closedPeriodFor(periods, date)
    if (cp) return toast.error(`La période « ${cp.name} » est clôturée`)
    const exN = Number(exo), peN = Number(per)
    if (!exN || exN < 1900 || exN > 2200) return toast.error("Exercice invalide")
    const out = valid.map((r) => ({ account_id: r.account_id, debit: num(r.debit), credit: num(r.credit), cost_center_id: r.cost_center_id || null, cc2_id: r.cc2_id || null, profit_center_id: r.profit_center_id || null, project_id: r.project_id || null }))
    if (editId) {
      setBusy(true)
      const old = lines.filter((l) => l.entry_id === editId)
      const { error: eu } = await supabase.from("acc_entries").update({ date, journal, reference: reference.trim() || null, label: label.trim(), exercice: exN, periode: peN }).eq("id", editId)
      if (eu) { setBusy(false); return toast.error(eu.message) }
      await supabase.from("acc_lines").delete().eq("entry_id", editId)
      const { error: ei } = await supabase.from("acc_lines").insert(out.map((o) => ({ ...o, entry_id: editId })))
      if (ei) {
        await supabase.from("acc_lines").insert(old.map((l) => ({ entry_id: l.entry_id, account_id: l.account_id, debit: l.debit, credit: l.credit, cost_center_id: l.cost_center_id, cc2_id: l.cc2_id || null, profit_center_id: l.profit_center_id || null, project_id: l.project_id || null })))
        setBusy(false); return toast.error(ei.message)
      }
      setBusy(false); toast.success("Écriture modifiée"); resetForm(); reload(); return
    }
    setBusy(true)
    const id = crypto.randomUUID()
    const { error } = await supabase.from("acc_entries").insert({ id, date, journal, piece: used.has(piece) ? prefix + newSuffix(used, prefix) : piece, reference: reference.trim() || null, label: label.trim(), exercice: exN, periode: peN })
    if (error) { setBusy(false); return toast.error(error.message) }
    const { error: e2 } = await supabase.from("acc_lines").insert(out.map((o) => ({ ...o, entry_id: id })))
    if (e2) { await supabase.from("acc_entries").delete().eq("id", id); setBusy(false); return toast.error(e2.message) }
    setBusy(false)
    toast.success("Écriture enregistrée")
    setLabel(""); setReference(""); setSuffix(newSuffix(new Set([...used, piece]), prefix)); setRows([blank(), blank()])
    reload()
  }
  const del = async (e: Entry) => {
    const cp = closedPeriodFor(periods, e.date)
    if (cp) return toast.error(`La période « ${cp.name} » est clôturée`)
    const { error } = await supabase.from("acc_entries").delete().eq("id", e.id)
    if (error) return toast.error(error.message)
    reload()
  }
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{editId ? "Modifier l’écriture" : "Nouvelle écriture comptable"}</h2>
      <div className="grid md:grid-cols-12 gap-2 mb-3">
        <input type="date" className={inputCls + " md:col-span-2"} value={date} onChange={(e) => setDate(e.target.value)} />
        <select className={inputCls + " md:col-span-3"} value={journal} onChange={(e) => setJournal(e.target.value)}>
          {Object.entries(JOURNALS).filter(([k]) => k !== "CLO").map(([k, l]) => <option key={k} value={k}>{k} — {l}</option>)}
        </select>
        <input className={inputCls + " md:col-span-2 bg-muted"} readOnly title="N° pièce généré automatiquement" value={piece} onDoubleClick={regen} />
        <input className={inputCls + " md:col-span-4"} placeholder="Référence (facture, chèque…)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <input className={inputCls + " md:col-span-6"} placeholder="Libellé de l’écriture" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input type="number" className={inputCls + " md:col-span-3"} title="Exercice" placeholder="Exercice" value={exo} onChange={(e) => setExoOv(e.target.value)} />
        <select className={inputCls + " md:col-span-3"} title="Période de clôture" value={per} onChange={(e) => setPerOv(e.target.value)}>
          {Array.from({ length: 13 }, (_, i) => <option key={i + 1} value={i + 1}>Période {i + 1}{i === 12 ? " (clôture)" : ""}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 pb-2 border-b border-border/50">
            <select className={inputCls + " col-span-12 md:col-span-7"} value={r.account_id} onChange={(e) => upd(i, "account_id", e.target.value)}>
              <option value="">Compte…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <input className={inputCls + " col-span-5 md:col-span-2 text-right"} placeholder="Débit" inputMode="decimal" value={r.debit} onChange={(e) => upd(i, "debit", e.target.value)} />
            <input className={inputCls + " col-span-5 md:col-span-2 text-right"} placeholder="Crédit" inputMode="decimal" value={r.credit} onChange={(e) => upd(i, "credit", e.target.value)} />
            <button className="col-span-2 md:col-span-1 text-muted-foreground hover:text-destructive flex items-center justify-center" aria-label="Retirer la ligne" onClick={() => rows.length > 2 && setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
            {CC_FIELDS.map((f) => (
              <select key={f.k} className={inputCls + " col-span-6 md:col-span-3"} title={f.label} value={r[f.k]} onChange={(e) => upd(i, f.k, e.target.value)}>
                <option value="">{f.label}</option>
                {centers.filter((c) => c.kind === f.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <Button variant="outline" size="sm" onClick={() => setRows([...rows, blank()])}><Plus className="h-4 w-4 mr-1" />Ajouter une ligne</Button>
        <div className="flex items-center gap-4 text-sm">
          <span>Débit : <strong>{n2(td)}</strong></span>
          <span>Crédit : <strong>{n2(tc)}</strong></span>
          <span className={ok ? "text-success" : "text-destructive"}>{ok ? "Équilibrée" : `Écart : ${n2(Math.abs(td - tc))}`}</span>
          {editId && <Button variant="outline" onClick={resetForm}>Annuler</Button>}
          <Button onClick={save} disabled={busy}>{editId ? "Mettre à jour" : "Enregistrer"}</Button>
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-12 mb-3">Journal des écritures</h2>
      {sorted.slice(0, limit).map((e) => {
        const ls = lines.filter((l) => l.entry_id === e.id)
        const locked = !!closedPeriodFor(periods, e.date)
        return (
          <div key={e.id} className="border-t border-border py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span><span className="text-muted-foreground">{new Date(e.date + "T12:00:00Z").toLocaleDateString("fr-FR")} · {e.journal}{e.piece ? ` · ${e.piece}` : ""}{e.reference ? ` · Réf. ${e.reference}` : ""}{e.exercice ? ` · Ex. ${e.exercice}` : ""}{e.periode ? ` · P${e.periode}` : ""}</span> — <strong>{e.label}</strong></span>
              {!locked ? <span className="flex items-center gap-3">{e.journal !== "CLO" && <button className="text-muted-foreground hover:text-foreground" aria-label="Modifier l’écriture" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></button>}<button className="text-muted-foreground hover:text-destructive" aria-label="Supprimer l’écriture" onClick={() => del(e)}><Trash2 className="h-4 w-4" /></button></span> : <span className="text-xs text-muted-foreground">Clôturée</span>}
            </div>
            {ls.map((l) => {
              const a = accOf(l.account_id); const cn = lineCenters(l).map((id) => centers.find((x) => x.id === id)?.name).filter(Boolean).join(" · ")
              return (
                <div key={l.id} className="grid grid-cols-12 gap-2 text-muted-foreground mt-1">
                  <span className="col-span-6">{a ? `${a.code} ${a.name}` : "?"}{cn ? ` · ${cn}` : ""}</span>
                  <span className="col-span-3 text-right">{l.debit ? n2(l.debit) : ""}</span>
                  <span className="col-span-3 text-right">{l.credit ? n2(l.credit) : ""}</span>
                </div>
              )
            })}
          </div>
        )
      })}
      {!sorted.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune écriture pour le moment.</p>}
      {sorted.length > limit && <Button variant="outline" size="sm" className="mt-3" onClick={() => setLimit(limit + 30)}>Afficher plus</Button>}
    </div>
  )
}
