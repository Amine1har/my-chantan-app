import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Account, Center } from "@/lib/ledger"

const HEAD = ["ecriture", "date", "journal", "piece", "reference", "libelle", "exercice", "periode", "compte", "debit", "credit", "centre_cout", "cc2", "centre_profit", "centre_projet"]
const EXAMPLE = [
  HEAD.join(";"),
  "1;2026-01-01;AN;;Solde initial;Capital de départ;2026;1;5141;50000;;;;;",
  "1;2026-01-01;AN;;Solde initial;Capital de départ;2026;1;1111;;50000;;;;",
  "2;2026-01-15;AC;FAC-001;Facture fournisseur;Achat tissus;2026;1;6111;1200;;Production;;;",
  "2;2026-01-15;AC;FAC-001;Facture fournisseur;Achat tissus;2026;1;5141;;1200;;;;",
  "3;15/02/2026;VE;;;Vente en ligne;;;5141;350;;;;Boutique;",
  "3;15/02/2026;VE;;;Vente en ligne;;;7111;;350;;;Boutique;",
].join("\n")

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "")
const num = (s: string) => Number(String(s || "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0
const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X")

function parseCsv(text: string) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const first = text.split("\n")[0] || ""
  const sep = first.split(";").length >= first.split(",").length ? ";" : ","
  const rows: string[][] = []
  let cur = "", row: string[] = [], q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
    else if (ch === '"') q = true
    else if (ch === sep) { row.push(cur); cur = "" }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = "" }
    else if (ch !== "\r") cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}
function toDate(s: string) {
  const t = (s || "").trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return new Date().toISOString().slice(0, 10)
}
const kindOf = (code: string) => ({ "1": "capitaux", "6": "charge", "7": "produit" } as Record<string, string>)[code[0]] || "actif"

export default function ImportCsv({ accounts, centers, reload }: { accounts: Account[]; centers: Center[]; reload: () => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const download = () => {
    const blob = new Blob(["\ufeff" + EXAMPLE], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "exemple-ecritures.csv"
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const run = async (f: File) => {
    setBusy(true)
    try {
      const rows = parseCsv(await f.text())
      if (rows.length < 2) throw new Error("fichier vide")
      const head = rows[0].map(norm)
      const ix = (...n: string[]) => head.findIndex((h) => n.includes(h))
      const c = {
        grp: ix("ecriture", "numecriture", "groupe", "id"), date: ix("date"), jr: ix("journal"), piece: ix("piece", "npiece", "numpiece"), ref: ix("reference", "ref"),
        lab: ix("libelle", "label"), ex: ix("exercice"), per: ix("periode"), acc: ix("compte", "account"), d: ix("debit"), cr: ix("credit"),
        cc: ix("centrecout", "centredecout", "cout"), cc2: ix("cc2"), pf: ix("centreprofit", "centredeprofit", "profit"), pj: ix("centreprojet", "centredeprojet", "projet"),
      }
      const g = (r: string[], i: number) => (i >= 0 ? (r[i] || "").trim() : "")

      // Comptes : créés à la volée s'ils n'existent pas
      const accMap = new Map(accounts.map((a) => [a.code.trim(), a.id]))
      const need = new Map<string, string>()
      const body = rows.slice(1)
      for (const r of body) { const code = g(r, c.acc) || "000"; if (!accMap.has(code)) need.set(code, kindOf(code)) }
      if (need.size) {
        const ins = [...need].map(([code, kind]) => ({ code, name: code === "000" ? "Compte non affecté" : `Compte ${code}`, kind }))
        const { data, error } = await supabase.from("acc_accounts").insert(ins).select("id,code")
        if (error) throw error
        ;(data || []).forEach((a: any) => accMap.set(a.code, a.id))
      }
      // Centres : créés à la volée
      const cMap = new Map(centers.map((x) => [x.kind + "|" + x.name.trim().toLowerCase(), x.id]))
      const newC = new Map<string, { name: string; kind: string }>()
      const cols: [number, string][] = [[c.cc, "cout"], [c.cc2, "cc2"], [c.pf, "profit"], [c.pj, "projet"]]
      for (const r of body) for (const [i, kind] of cols) { const v = g(r, i); if (v && !cMap.has(kind + "|" + v.toLowerCase())) newC.set(kind + "|" + v.toLowerCase(), { name: v, kind }) }
      if (newC.size) {
        const { data, error } = await supabase.from("cost_centers").insert([...newC.values()]).select("id,name,kind")
        if (error) throw error
        ;(data || []).forEach((x: any) => cMap.set(x.kind + "|" + x.name.toLowerCase(), x.id))
      }
      const cid = (r: string[], i: number, kind: string) => { const v = g(r, i); return v ? cMap.get(kind + "|" + v.toLowerCase()) || null : null }

      // Regroupement en écritures
      const groups = new Map<string, string[][]>()
      body.forEach((r, n) => {
        const key = g(r, c.grp) || g(r, c.piece) || `${g(r, c.date)}|${g(r, c.jr)}|${g(r, c.lab)}|${c.grp < 0 && c.piece < 0 ? "" : n}`
        groups.set(key, [...(groups.get(key) || []), r])
      })
      const { data: ex } = await supabase.from("acc_entries").select("piece").limit(100000)
      const used = new Set((ex || []).map((e: any) => e.piece).filter(Boolean))
      const entries: any[] = [], lines: any[] = []
      for (const rs of groups.values()) {
        const r0 = rs[0]
        const date = toDate(g(r0, c.date))
        const journal = (g(r0, c.jr) || "OD").toUpperCase()
        let piece = g(r0, c.piece)
        if (!piece || used.has(piece)) piece = `${journal}-${date.replace(/-/g, "")}-${rnd()}`
        used.add(piece)
        const id = crypto.randomUUID()
        entries.push({ id, date, journal, piece, reference: g(r0, c.ref) || null, label: g(r0, c.lab) || "Import CSV",
          exercice: Number(g(r0, c.ex)) || Number(date.slice(0, 4)), periode: Number(g(r0, c.per)) || Number(date.slice(5, 7)) || 1 })
        for (const r of rs) lines.push({ entry_id: id, account_id: accMap.get(g(r, c.acc) || "000"), debit: num(g(r, c.d)), credit: num(g(r, c.cr)),
          cost_center_id: cid(r, c.cc, "cout"), cc2_id: cid(r, c.cc2, "cc2"), profit_center_id: cid(r, c.pf, "profit"), project_id: cid(r, c.pj, "projet") })
      }
      for (let i = 0; i < entries.length; i += 200) { const { error } = await supabase.from("acc_entries").insert(entries.slice(i, i + 200)); if (error) throw error }
      for (let i = 0; i < lines.length; i += 500) { const { error } = await supabase.from("acc_lines").insert(lines.slice(i, i + 500)); if (error) throw error }
      toast.success(`${entries.length} écriture(s) importée(s) (${lines.length} lignes)`)
      reload()
    } catch (e) {
      toast.error("Import impossible : " + ((e as Error).message || String(e)))
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ""
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Import CSV des écritures</h2>
      <p className="text-sm text-muted-foreground mb-4">Importez plusieurs écritures en une seule fois. Aucun contrôle bloquant : les cellules vides sont acceptées (date du jour, journal OD, libellé « Import CSV », N° pièce généré). Les comptes et centres inconnus sont créés automatiquement. Les lignes qui ont le même numéro dans la colonne « ecriture » forment une même écriture.</p>
      <div className="flex flex-wrap gap-3 mb-6">
        <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
        <Button onClick={() => file.current?.click()} disabled={busy}><Upload className="h-4 w-4 mr-1" />{busy ? "Import en cours…" : "Importer un fichier CSV"}</Button>
        <Button variant="outline" onClick={download}><Download className="h-4 w-4 mr-1" />Télécharger l’exemple CSV</Button>
      </div>
      <h3 className="text-sm font-semibold mb-2">Colonnes du fichier (séparateur ; ou ,)</h3>
      <div className="overflow-x-auto"><pre className="text-xs bg-muted p-3 rounded-md whitespace-pre">{EXAMPLE}</pre></div>
    </div>
  )
}
