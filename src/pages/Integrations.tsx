import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { phoneKey } from "@/lib/crm"

// Lecture CSV (export Google Sheets : Fichier > Télécharger > .csv) — gère les guillemets et les retours à la ligne
function parseCsv(text: string) {
  const rows: string[][] = []
  let cur = "", row: string[] = [], q = false
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const sep = text.split("\n").slice(0, 5).join("\n").split(";").length > text.split("\n").slice(0, 5).join("\n").split(",").length ? ";" : ","
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
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
const num = (s: string) => Number(String(s || "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0

function parseDate(s: string): string | null {
  const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  const p = (x: string | undefined) => String(x || "0").padStart(2, "0")
  const d = new Date(`${m[3]}-${p(m[1])}-${p(m[2])}T${p(m[4])}:${p(m[5])}:${p(m[6])}+01:00`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
function confStatus(raw: string): string | null {
  const s = norm(raw)
  if (!s) return null
  if (/annul|cancel/.test(s)) return "annulee"
  if (/confirm/.test(s)) return "confirmee"
  if (/whats/.test(s)) return "appel_whatsapp"
  if (/appel\s*1/.test(s)) return "appel_1"
  if (/appel\s*2/.test(s)) return "appel_2"
  if (/appel\s*3/.test(s)) return "appel_3"
  if (/boite|vocal|messagerie/.test(s)) return "boite_vocale"
  if (/doublon|double/.test(s)) return "doublon"
  if (/fake|faux|gofozi|fausse/.test(s)) return "fake_order"
  if (/injoign/.test(s)) return "injoignable"
  if (/pas de rep|no rep|ne repond/.test(s)) return "pas_de_reponse"
  if (/serieux/.test(s)) return "pas_serieux"
  if (/report/.test(s)) return "reporte"
  if (/solde/.test(s)) return "solde_out"
  return null
}
function shipStatus(raw: string): string | null {
  const s = norm(raw)
  if (!s) return null
  if (/non\s*livr|pas\s*livr|refus|injoign|echec/.test(s)) return "non_livre"
  if (/retour/.test(s)) return "retourne"
  if (/livr|deliver/.test(s)) return "livre"
  if (/transit|cours|expedi|ramass|sortie|shipped|distribution/.test(s)) return "en_transit"
  return null
}

export default function Integrations() {
  const [busy, setBusy] = useState("")
  const [sample, setSample] = useState("")
  const [showSample, setShowSample] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { fetch("/exemple-commandes.csv").then((r) => r.text()).then(setSample).catch(() => {}) }, [])
  const file = useRef<HTMLInputElement>(null)

  const run = async (slug: string, label: string) => {
    setBusy(slug)
    try {
      const { data, error } = await supabase.functions.invoke(slug)
      if (error || data?.error) throw new Error(data?.error || error?.message)
      toast.success(`${label} : ${data.orders ?? data.rows ?? 0} élément(s) synchronisé(s)`)
    } catch (e) {
      toast.error(`${label} impossible : ${(e as Error).message}`)
    } finally {
      setBusy("")
    }
  }

  const importCsv = async (f: File) => {
    setBusy("csv")
    try {
      const rows = parseCsv(await f.text())
      const hi = rows.findIndex((r) => r.some((c) => norm(c) === "order id"))
      if (hi < 0) throw new Error("ligne d'en-têtes « Order ID » introuvable")
      const head = rows[hi].map(norm)
      const ix = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n))
      const c = {
        id: ix("order id"), date: ix("order date"), store: ix("store name"), name: ix("name"),
        city: ix("city"), addr: ix("street address"), prod: ix("product name"), color: ix("color"), size: ix("size"),
        price: ix("price"), qty: ix("total quantity"), rem: ix("remarque"), conf: ix("status de confirmation"),
        carrier: ix("societe de livraison"), suivi: ix("suivie remarque"), deliv: ix("statut de livraison"),
        track: ix("tracking number"), exp: ix("status expeditions"), ret: ix("vrai returned"), camp: ix("compaign"),
      }
      const phoneI = c.name + 1
      if (c.id < 0 || c.name < 0) throw new Error("colonnes « Order ID » / « Name » introuvables")
      const g = (r: string[], i: number) => (i >= 0 ? (r[i] || "").trim() : "")

      // Regroupe les lignes par ID de commande (plusieurs produits = plusieurs lignes)
      const map = new Map<string, any>()
      for (const r of rows.slice(hi + 1)) {
        const id = g(r, c.id)
        if (!id) continue
        const qty = Math.max(1, num(g(r, c.qty)) || 1)
        const line = num(g(r, c.price))
        const item = { name: g(r, c.prod) || "Produit", color: g(r, c.color), size: g(r, c.size), qty, price: Math.round((line / qty) * 100) / 100 }
        const ex = map.get(id)
        if (ex) { ex.items.push(item); ex.total += line; continue }
        const confRaw = g(r, c.conf), delivRaw = g(r, c.deliv), expRaw = g(r, c.exp), retRaw = g(r, c.ret)
        const ss = shipStatus(delivRaw) || shipStatus(expRaw)
        const returned = /true|oui|yes|1|x|retour/i.test(retRaw) && !/false|non|0/i.test(retRaw)
        let status = confStatus(confRaw) || "nouvelle"
        if (ss === "livre") status = "livree"
        else if (ss === "retourne" || returned) status = "retournee"
        else if ((ss === "en_transit" || g(r, c.track)) && status === "nouvelle") status = "expediee"
        const notes = [g(r, c.rem), confRaw && !confStatus(confRaw) ? `Confirmation : ${confRaw}` : "", g(r, c.suivi)].filter(Boolean).join(" — ")
        map.set(id, {
          number: id, customer_name: g(r, c.name) || "Client", phone: g(r, phoneI), city: g(r, c.city), address: g(r, c.addr),
          items: [item], total: line, status,
          source: /shopify/i.test(g(r, c.store)) ? "shopify" : "whatsapp",
          shipping_status: ss || (delivRaw || expRaw || "en_attente").trim() || "en_attente",
          tracking_number: g(r, c.track) || null, carrier: g(r, c.carrier) || null,
          notes: notes || null, ad_campaign: g(r, c.camp) || null,
          created_at: parseDate(g(r, c.date)) || new Date().toISOString(),
        })
      }
      const all = [...map.values()]

      // Évite les doublons : ID de commande déjà présents
      const existing = new Set<string>()
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("orders").select("number").range(from, from + 999)
        if (error) throw error
        ;(data || []).forEach((o: any) => o.number && existing.add(o.number))
        if (!data || data.length < 1000) break
      }
      const fresh = all.filter((o) => !existing.has(o.number))
      for (let i = 0; i < fresh.length; i += 200) {
        const { error } = await supabase.from("orders").insert(fresh.slice(i, i + 200))
        if (error) throw error
      }

      // Clients : un profil par téléphone (9 derniers chiffres)
      const { data: cs } = await supabase.from("customers").select("phone").limit(10000)
      const seen = new Set((cs || []).map((x: any) => phoneKey(x.phone)).filter(Boolean))
      const customers: any[] = []
      for (const o of all) {
        const k = phoneKey(o.phone)
        if (!k || seen.has(k)) continue
        seen.add(k)
        customers.push({ name: o.customer_name, phone: o.phone, city: o.city, address: o.address, source: "sheets" })
      }
      for (let i = 0; i < customers.length; i += 200) await supabase.from("customers").insert(customers.slice(i, i + 200))
      toast.success(`${fresh.length} commande(s) importées, ${all.length - fresh.length} déjà présente(s) ignorée(s), ${customers.length} client(s) ajouté(s)`)
    } catch (e) {
      toast.error("Import impossible : " + ((e as Error).message || String(e)))
    } finally {
      setBusy("")
      if (file.current) file.current.value = ""
    }
  }

  const getExample = async () => (await fetch("/exemple-commandes.csv")).text()
  const downloadExample = async () => {
    try {
      const blob = new Blob(["\ufeff" + (await getExample())], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "exemple-commandes.csv"
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch { toast.error("Téléchargement impossible, utilisez « Copier l'exemple »") }
  }
  const copyExample = () => {
    // Le texte est déjà chargé : la copie reste liée au clic (nécessaire pour Safari)
    setShowSample(true)
    setTimeout(() => {
      const el = area.current
      if (!el) return
      el.focus(); el.select(); el.setSelectionRange(0, el.value.length)
      let ok = false
      try { ok = document.execCommand("copy") } catch { ok = false }
      if (ok) toast.success("Exemple copié : collez-le dans Google Sheets")
      else toast.message("Texte sélectionné : faites Cmd+C (ou Ctrl+C) pour le copier")
    }, 50)
  }

  const Row = ({ title, text, children }: { title: string; text: string; children: React.ReactNode }) => (
    <div className="border-t border-border py-5 grid md:grid-cols-12 gap-4 items-center">
      <div className="md:col-span-8"><div className="font-medium">{title}</div><p className="text-sm text-muted-foreground mt-1">{text}</p></div>
      <div className="md:col-span-4 md:justify-self-end">{children}</div>
    </div>
  )

  return (
    <Shell>
      <PageHead title="Intégrations" sub="Connectez Shopify, Meta, Google Sheets et vos transporteurs." />
      <Row title="Shopify" text="Importe les commandes et clients de votre boutique (les statuts déjà modifiés dans le CRM ne sont pas écrasés).">
        <Button onClick={() => run("shopify-sync", "Shopify")} disabled={busy === "shopify-sync"}>{busy === "shopify-sync" ? "Synchronisation…" : "Synchroniser Shopify"}</Button>
      </Row>
      <Row title="Google Sheets — historique des commandes" text="Exportez votre feuille « Gestion des Commandes » en CSV puis importez-la ici. Les lignes d'une même commande sont regroupées par Order ID, les commandes déjà présentes (même ID) sont ignorées, et produits, couleurs, tailles, statuts, suivi et transporteur sont repris tels quels.">
        <div className="flex flex-col items-start md:items-end gap-2">
          <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <Button variant="outline" onClick={() => file.current?.click()} disabled={busy === "csv"}>{busy === "csv" ? "Import en cours…" : "Importer un fichier CSV"}</Button>
          <div className="flex gap-3">
            <button type="button" onClick={downloadExample} className="text-sm underline text-muted-foreground hover:text-foreground">Télécharger un exemple CSV</button>
            <button type="button" onClick={copyExample} className="text-sm underline text-muted-foreground hover:text-foreground">Copier l'exemple</button>
          </div>
          {showSample && <textarea ref={area} readOnly value={sample} onFocus={(e) => e.currentTarget.select()} className="w-full md:w-96 h-40 rounded-md border border-border bg-background p-2 text-xs font-mono" />}
        </div>
      </Row>
      <Row title="Meta Ads Manager" text="Récupère dépenses, clics et achats des 30 derniers jours par campagne.">
        <Button onClick={() => run("meta-sync", "Meta Ads")} disabled={busy === "meta-sync"}>{busy === "meta-sync" ? "Synchronisation…" : "Synchroniser Meta"}</Button>
      </Row>
      <Row title="Transporteurs (suivi automatique)" text="Configurez vos transporteurs dans la page Transporteurs.">
        <span className="text-sm text-muted-foreground">À configurer</span>
      </Row>
    </Shell>
  )
}
