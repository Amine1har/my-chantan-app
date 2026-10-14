import { useState } from "react"
import { PackagePlus } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Cell } from "@/components/OrderRow"
import { Empty, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Carrier, Order, dateTimeFr, inputCls, matchQ, money, useRows } from "@/lib/crm"

export default function Expedition() {
  const o = useRows<Order>("orders")
  const c = useRows<Carrier>("carriers", "created_at", true)
  const [sel, setSel] = useState<string[]>([])
  const [carrierId, setCarrierId] = useState("")
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)

  const livcash = c.rows.filter((x) => (x.type === "livcash" || x.type === "nevada") && x.active)
  const cid = carrierId || livcash[0]?.id || ""
  const cur = livcash.find((x) => x.id === cid)
  const isNevada = cur?.type === "nevada"
  const nrm = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  const zoneList = String(cur?.cities || "").split(/[\n,]/).map(nrm).filter(Boolean)
  const casaRe = /casa|mohammedia|bouskoura|nouaceur|mediouna|dar bouazza|berrechid|settat|benslimane|ain harrouda|tit mellil|bernoussi|ain sebaa|sidi maarouf|ain chock|had soualem/
  const inZone = (city: string) => { const n = nrm(city); return !!n && (zoneList.length ? zoneList.some((z) => n.includes(z) || z.includes(n)) : casaRe.test(n)) }
  const nevadaNames = c.rows.filter((x) => x.type === "nevada").map((x) => x.name)
  const base = o.rows.filter((x) => x.status === "confirmee")
  const scoped = isNevada
    ? base.filter((x) => !(x.tracking_number || "").trim() && (x.carrier === cur?.name || (!(x.carrier || "").trim() && inZone(x.city || ""))))
    : base.filter((x) => !(x.tracking_number || "").trim() && !nevadaNames.includes(x.carrier || "") && x.carrier !== "Autre")
  const list = scoped.filter((x) => matchQ(q, x.number, x.customer_name, x.phone, x.city, x.address))
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]))
  const allSel = list.length > 0 && list.every((x) => sel.includes(x.id))

  const setCode = async (x: Order, v: string) => {
    const { error } = await supabase.from("orders").update({ tracking_number: v.trim() || null, updated_at: new Date().toISOString() }).eq("id", x.id)
    if (error) return toast.error(error.message)
    toast.success("Code suivi enregistré")
    o.reload()
  }
  const send = async () => {
    if (!cid) return toast.error("Ajoutez d’abord un transporteur actif (page Transporteurs)")
    if (!sel.length) return toast.error("Sélectionnez au moins une commande")
    setBusy(true)
    const { data, error } = await supabase.functions.invoke("carrier-sync", { body: { carrier_id: cid, push: true, order_ids: sel } })
    setBusy(false)
    if (error || data?.error) return toast.error(error?.message || data.error)
    if (data.errors?.length) toast.error(data.errors.join(" | "))
    if (data.pushed) toast.success(isNevada ? `${data.pushed} commande(s) envoyée(s) au Sheet ${cur?.name}` : `${data.pushed} colis ajouté(s) à Livcash`)
    setSel([]); o.reload()
  }

  return (
    <Shell>
      <PageHead title="Expédition" sub="Choisissez le transporteur (Livcash ou Nivada), sélectionnez les commandes confirmées puis envoyez-les." />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className={inputCls + " max-w-sm"} placeholder="Rechercher : n°, nom, téléphone, ville…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls + " max-w-[220px]"} value={cid} onChange={(e) => setCarrierId(e.target.value)}>
          {!livcash.length && <option value="">Aucun transporteur (Livcash / Nivada)</option>}
          {livcash.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <Button disabled={busy || !sel.length} onClick={send}><PackagePlus className="h-4 w-4 mr-1" /> {isNevada ? "Envoyer vers le Sheet" : "Ajouter colis"} ({sel.length})</Button>
      </div>
      {list.length > 0 && (
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : list.map((x) => x.id))} /> Tout sélectionner ({list.length})
        </label>
      )}
      {list.map((x) => (
        <div key={x.id} className="border-t border-border py-3 grid md:grid-cols-12 gap-2 items-center text-sm">
          <input type="checkbox" className="md:col-span-1 justify-self-start" checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />
          <div className="md:col-span-3"><div className="font-medium">{x.number}</div><div className="text-xs text-muted-foreground">{dateTimeFr(x.created_at)}</div></div>
          <div className="md:col-span-3">{x.customer_name}<div className="text-xs text-muted-foreground">{x.phone} · {x.city}</div></div>
          <div className="md:col-span-2 font-medium">{money(x.total)}</div>
          <div className="md:col-span-3"><Cell value="" placeholder="Code suivi manuel" onSave={(v) => setCode(x, v)} /></div>
        </div>
      ))}
      {!list.length && <Empty text={isNevada ? "Aucune commande confirmée de Casablanca et environs à envoyer." : "Aucune commande confirmée sans code suivi."} />}
    </Shell>
  )
}
