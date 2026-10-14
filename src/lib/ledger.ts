import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/chantan-db"

export type Account = { id: string; code: string; name: string; kind: string }
export type Period = { id: string; name: string; start_date: string; end_date: string; closed: boolean; closed_at: string | null }
export type Entry = { id: string; date: string; journal: string; reference: string | null; piece?: string | null; label: string; exercice?: number | null; periode?: number | null; created_at?: string }
export type Line = { id: string; entry_id: string; account_id: string; debit: number; credit: number; cost_center_id: string | null; cc2_id?: string | null; profit_center_id?: string | null; project_id?: string | null; label: string | null }
export type Center = { id: string; name: string; kind: string }

export const lineCenters = (l: Line) => [l.cost_center_id, l.cc2_id, l.profit_center_id, l.project_id].filter(Boolean) as string[]
export const KINDS: Record<string, string> = { actif: "Actif", passif: "Passif", capitaux: "Capitaux", charge: "Charge", produit: "Produit" }
export const JOURNALS: Record<string, string> = { AN: "À nouveau (soldes initiaux)", AC: "Achats", VE: "Ventes", BQ: "Banque", CA: "Caisse", OD: "Opérations diverses", CLO: "Clôture" }
export const n2 = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function fetchAll<T>(table: string, order: string): Promise<T[]> {
  const all: T[] = []
  for (let f = 0; f < 200000; f += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order).order("id").range(f, f + 999)
    if (error) { toast.error("Chargement impossible : " + error.message); break }
    all.push(...((data as T[]) || []))
    if (!data || data.length < 1000) break
  }
  return all
}

export function useLedger() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const [a, p, e, l, c] = await Promise.all([
      fetchAll<Account>("acc_accounts", "code"),
      fetchAll<Period>("acc_periods", "start_date"),
      fetchAll<Entry>("acc_entries", "date"),
      fetchAll<Line>("acc_lines", "created_at"),
      fetchAll<Center>("cost_centers", "name"),
    ])
    setAccounts(a); setPeriods(p); setEntries(e)
    setLines(l.map((x) => ({ ...x, debit: Number(x.debit) || 0, credit: Number(x.credit) || 0 })))
    setCenters(c); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  return { accounts, periods, entries, lines, centers, loading, reload: load }
}

export const closedPeriodFor = (periods: Period[], date: string) => periods.find((p) => p.closed && date >= p.start_date && date <= p.end_date)
