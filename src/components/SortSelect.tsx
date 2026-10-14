import { ArrowUpDown } from "lucide-react"
import { inputCls } from "@/lib/crm"

export type SortOpt = { k: string; l: string }

const nrm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

// Compare deux valeurs : nombres ou texte (A→Z, insensible aux accents), vides toujours à la fin
export const cmpVals = (a: unknown, b: unknown, asc: boolean) => {
  const ea = a === null || a === undefined || a === ""
  const eb = b === null || b === undefined || b === ""
  if (ea && eb) return 0
  if (ea) return 1
  if (eb) return -1
  const r = typeof a === "number" && typeof b === "number" ? a - b : nrm(a).localeCompare(nrm(b), "fr", { numeric: true })
  return asc ? r : -r
}

export const sortList = <T,>(rows: T[], get: (x: T) => unknown, asc: boolean) => [...rows].sort((x, y) => cmpVals(get(x), get(y), asc))

export default function SortSelect({ value, onChange, options }: { value: string; onChange: (k: string) => void; options: SortOpt[] }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowUpDown className="h-4 w-4" />
      <span className="hidden sm:inline">Trier par</span>
      <select className={inputCls + " w-auto min-w-48 text-foreground"} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
      </select>
    </label>
  )
}
