import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { inputCls } from "@/lib/crm"
import { Account, Entry, Line, n2 } from "@/lib/ledger"

type Row = { line: Line; entry: Entry; account: Account; running: number }

export default function Consultation({ accounts, entries, lines }: { accounts: Account[]; entries: Entry[]; lines: Line[] }) {
  const [accountId, setAccountId] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [reference, setReference] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")

  const rows = useMemo(() => {
    const entryById = new Map(entries.map((entry) => [entry.id, entry]))
    const accountById = new Map(accounts.map((account) => [account.id, account]))
    const all = lines.flatMap((line) => {
      const entry = entryById.get(line.entry_id)
      const account = accountById.get(line.account_id)
      return entry && account ? [{ line, entry, account }] : []
    }).filter((row) => !accountId || row.account.id === accountId)
      .sort((a, b) => a.entry.date.localeCompare(b.entry.date) || a.entry.created_at.localeCompare(b.entry.created_at) || a.account.code.localeCompare(b.account.code))

    const balances = new Map<string, number>()
    const withBalance: Row[] = all.map((row) => {
      const next = (balances.get(row.account.id) || 0) + Number(row.line.debit || 0) - Number(row.line.credit || 0)
      balances.set(row.account.id, next)
      return { ...row, running: next }
    })
    const q = reference.trim().toLocaleLowerCase("fr")
    const min = minAmount === "" ? null : Number(minAmount)
    const max = maxAmount === "" ? null : Number(maxAmount)
    return withBalance.filter(({ entry, line }) => {
      if (from && entry.date < from) return false
      if (to && entry.date > to) return false
      if (q && ![entry.reference, entry.piece, entry.label, entry.journal].some((value) => String(value || "").toLocaleLowerCase("fr").includes(q))) return false
      const amount = Math.max(Number(line.debit) || 0, Number(line.credit) || 0)
      if (min !== null && amount < min) return false
      if (max !== null && amount > max) return false
      return true
    }).reverse()
  }, [accounts, entries, lines, accountId, from, to, reference, minAmount, maxAmount])

  const totalDebit = rows.reduce((sum, row) => sum + (Number(row.line.debit) || 0), 0)
  const totalCredit = rows.reduce((sum, row) => sum + (Number(row.line.credit) || 0), 0)
  const exportCsv = () => {
    const head = ["Date", "Compte", "Journal", "N° pièce", "Référence", "Libellé", "Débit", "Crédit", "Solde cumulé"]
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const body = rows.map(({ entry, account, line, running }) => [entry.date, account.code, entry.journal, entry.piece, entry.reference, entry.label, line.debit, line.credit, running].map(quote).join(";"))
    const blob = new Blob(["\ufeff" + [head.join(";"), ...body].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "consultation-comptes.csv"
    a.click()
    URL.revokeObjectURL(url)
  }
  const selected = accounts.find((account) => account.id === accountId)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Consultation des comptes</h2>
      <p className="text-sm text-muted-foreground mb-4">Consultez le détail des mouvements par compte et filtrez les écritures par période, référence ou montant.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2 mb-4 print:hidden">
        <select className={inputCls + " lg:col-span-2"} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Tous les comptes</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
        </select>
        <label className="text-xs text-muted-foreground">Date de début<input aria-label="Date de début" type="date" className={inputCls} value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Date de fin<input aria-label="Date de fin" type="date" className={inputCls} value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <input className={inputCls + " lg:col-span-2"} placeholder="Référence, pièce, libellé…" value={reference} onChange={(event) => setReference(event.target.value)} />
        <input aria-label="Montant minimum" className={inputCls} type="number" min="0" placeholder="Montant min." value={minAmount} onChange={(event) => setMinAmount(event.target.value)} />
        <input aria-label="Montant maximum" className={inputCls} type="number" min="0" placeholder="Montant max." value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} />
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Exporter CSV</Button>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm mb-3">
        <span className="text-muted-foreground">{selected ? `${selected.code} — ${selected.name}` : "Tous les comptes"} · {rows.length} mouvement(s)</span>
        <span>Total filtré : Débit <strong>{n2(totalDebit)}</strong> · Crédit <strong>{n2(totalCredit)}</strong></span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="bg-muted text-xs text-muted-foreground"><tr>
            {["Date", "Compte", "Journal", "N° pièce", "Référence", "Libellé", "Débit", "Crédit", "Solde cumulé"].map((heading) => <th key={heading} className="px-3 py-2 text-left">{heading}</th>)}
          </tr></thead>
          <tbody>{rows.map(({ line, entry, account, running }) => (
            <tr key={line.id} className="border-t border-border hover:bg-muted/40">
              <td className="px-3 py-2 whitespace-nowrap">{new Date(entry.date + "T12:00:00Z").toLocaleDateString("fr-FR")}</td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="text-muted-foreground">{account.code}</span> {account.name}</td>
              <td className="px-3 py-2">{entry.journal}</td><td className="px-3 py-2">{entry.piece || "—"}</td><td className="px-3 py-2">{entry.reference || "—"}</td>
              <td className="px-3 py-2">{line.label || entry.label}</td><td className="px-3 py-2 text-right">{line.debit ? n2(line.debit) : "—"}</td><td className="px-3 py-2 text-right">{line.credit ? n2(line.credit) : "—"}</td><td className="px-3 py-2 text-right font-medium">{n2(running)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!rows.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucun mouvement ne correspond à ces filtres.</p>}
    </div>
  )
}
