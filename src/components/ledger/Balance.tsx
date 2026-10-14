import { useMemo, useState } from "react"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { inputCls } from "@/lib/crm"
import { Account, Center, Entry, Line, Period, lineCenters, n2 } from "@/lib/ledger"

export default function Balance({ accounts, periods, entries, lines, centers }: { accounts: Account[]; periods: Period[]; entries: Entry[]; lines: Line[]; centers: Center[] }) {
  const [pid, setPid] = useState("")
  const [center, setCenter] = useState("")
  const [hideZero, setHideZero] = useState(true)
  const per = periods.find((p) => p.id === pid)
  const [cf, setCf] = useState("")
  const [ct, setCt] = useState("")
  const from = per ? per.start_date : cf
  const to = per ? per.end_date : ct

  const rows = useMemo(() => {
    const dateOf = new Map(entries.map((e) => [e.id, e.date]))
    const m = new Map<string, { oD: number; oC: number; mD: number; mC: number }>()
    for (const l of lines) {
      if (center && !lineCenters(l).includes(center)) continue
      const d = dateOf.get(l.entry_id)
      if (!d || (to && d > to)) continue
      const r = m.get(l.account_id) || { oD: 0, oC: 0, mD: 0, mC: 0 }
      if (from && d < from) { r.oD += l.debit; r.oC += l.credit } else { r.mD += l.debit; r.mC += l.credit }
      m.set(l.account_id, r)
    }
    return accounts.map((a) => {
      const r = m.get(a.id) || { oD: 0, oC: 0, mD: 0, mC: 0 }
      const o = r.oD - r.oC, f = o + r.mD - r.mC
      return { a, oD: o > 0 ? o : 0, oC: o < 0 ? -o : 0, mD: r.mD, mC: r.mC, fD: f > 0 ? f : 0, fC: f < 0 ? -f : 0 }
    }).filter((r) => !hideZero || r.oD || r.oC || r.mD || r.mC || r.fD || r.fC)
  }, [accounts, entries, lines, from, to, center, hideZero])

  const T = rows.reduce((s, r) => ({ oD: s.oD + r.oD, oC: s.oC + r.oC, mD: s.mD + r.mD, mC: s.mC + r.mC, fD: s.fD + r.fD, fC: s.fC + r.fC }), { oD: 0, oC: 0, mD: 0, mC: 0, fD: 0, fC: 0 })
  const exportCsv = () => {
    const head = ["Compte", "Libellé", "Solde initial débit", "Solde initial crédit", "Mouvement débit", "Mouvement crédit", "Solde final débit", "Solde final crédit"]
    const body = rows.map((r) => [r.a.code, `"${r.a.name.replace(/"/g, '""')}"`, r.oD, r.oC, r.mD, r.mC, r.fD, r.fC].join(";"))
    const tot = ["", "TOTAL", T.oD, T.oC, T.mD, T.mC, T.fD, T.fC].join(";")
    const blob = new Blob(["\ufeff" + [head.join(";"), ...body, tot].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `balance-generale${from ? "-" + from : ""}${to ? "-" + to : ""}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const cell = "px-2 py-2 text-right whitespace-nowrap"
  const v = (x: number) => (x ? n2(x) : "")
  const balanced = Math.abs(T.fD - T.fC) < 0.005

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <select className={inputCls + " w-56"} value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">Dates libres</option>
          {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.closed ? " (clôturée)" : ""}</option>)}
        </select>
        {!per && <>
          <span className="text-xs text-muted-foreground">Du</span><input type="date" className={inputCls + " w-36"} value={cf} onChange={(e) => setCf(e.target.value)} />
          <span className="text-xs text-muted-foreground">au</span><input type="date" className={inputCls + " w-36"} value={ct} onChange={(e) => setCt(e.target.value)} />
        </>}
        <select className={inputCls + " w-52"} value={center} onChange={(e) => setCenter(e.target.value)}>
          <option value="">Tous les centres</option>
          {centers.map((c) => <option key={c.id} value={c.id}>{({ cout: "Coût", cc2: "CC2", profit: "Profit", projet: "Projet" } as Record<string, string>)[c.kind] || c.kind} · {c.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />Masquer les comptes sans mouvement</label>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Exporter CSV</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimer</Button>
      </div>
      <h2 className="text-lg font-semibold mb-1">Balance générale</h2>
      <p className="text-xs text-muted-foreground mb-3">{from || to ? `Du ${from || "…"} au ${to || "…"}` : "Toutes les écritures"}{center ? ` · ${centers.find((c) => c.id === center)?.name}` : ""}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-t border-border">
              <th rowSpan={2} className="px-2 py-2 text-left align-bottom">Compte</th>
              <th colSpan={2} className="px-2 py-2 text-center border-l border-border">Solde initial</th>
              <th colSpan={2} className="px-2 py-2 text-center border-l border-border">Mouvement</th>
              <th colSpan={2} className="px-2 py-2 text-center border-l border-border">Solde final</th>
            </tr>
            <tr>{["Débit", "Crédit", "Débit", "Crédit", "Débit", "Crédit"].map((h, i) => <th key={i} className={cell + (i % 2 === 0 ? " border-l border-border" : "")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.a.id} className="border-t border-border">
                <td className="px-2 py-2"><span className="text-muted-foreground">{r.a.code}</span> {r.a.name}</td>
                <td className={cell + " border-l border-border"}>{v(r.oD)}</td><td className={cell}>{v(r.oC)}</td>
                <td className={cell + " border-l border-border"}>{v(r.mD)}</td><td className={cell}>{v(r.mC)}</td>
                <td className={cell + " border-l border-border font-medium"}>{v(r.fD)}</td><td className={cell + " font-medium"}>{v(r.fC)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-foreground font-semibold">
              <td className="px-2 py-2">Total</td>
              <td className={cell}>{n2(T.oD)}</td><td className={cell}>{n2(T.oC)}</td>
              <td className={cell}>{n2(T.mD)}</td><td className={cell}>{n2(T.mC)}</td>
              <td className={cell}>{n2(T.fD)}</td><td className={cell}>{n2(T.fC)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune donnée sur cette sélection.</p>}
      <p className={`text-xs mt-3 ${balanced ? "text-success" : "text-destructive"}`}>{balanced ? "La balance est équilibrée : total débit = total crédit." : "Attention : la balance n’est pas équilibrée."}</p>
    </div>
  )
}
