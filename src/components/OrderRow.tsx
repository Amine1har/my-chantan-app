import { useEffect, useState } from "react"
import { AlertTriangle, MessageCircle, Plus, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "@/lib/chantan-db"
import { Carrier, feeFor, Item, Order, Product, ProductVariant, SHIPPING, STATUSES, dateTimeFr, findProduct, findVariant, itemIssue, money, waLink } from "@/lib/crm"

export function Cell({ value, onSave, placeholder, type = "text", className = "" }: { value: string | number | null | undefined; onSave: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  const [v, setV] = useState(String(value ?? ""))
  useEffect(() => setV(String(value ?? "")), [value])
  return (
    <input
      type={type} value={v} placeholder={placeholder} list={undefined}
      className={`h-8 w-full rounded-md border border-transparent bg-muted/40 px-2 text-xs outline-none transition-colors hover:border-border focus:border-ring focus:bg-background ${className}`}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== String(value ?? "")) onSave(v) }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
    />
  )
}

type Props = {
  x: Order; products: Product[]; variants: ProductVariant[]; carriers: Carrier[]
  badge: string
  onStatus: (x: Order, s: string) => void; onShipping: (x: Order, s: string) => void; onCarrier: (x: Order, s: string) => void
  onDetail: (x: Order) => void; reload: () => void
}

let pcCache: { id: string; name: string }[] | null = null
function useProfitCenters() {
  const [list, setList] = useState(pcCache || [])
  useEffect(() => {
    if (pcCache) return
    supabase.from("cost_centers").select("id,name").eq("kind", "profit").order("name").then(({ data }) => { pcCache = data || []; setList(pcCache) })
  }, [])
  return list
}

export default function OrderRow({ x, products, variants, carriers, badge, onStatus, onShipping, onCarrier, onDetail, reload }: Props) {
  const profitCenters = useProfitCenters()
  const patch = async (fields: Record<string, unknown>) => {
    const { error } = await supabase.from("orders").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", x.id)
    if (error) return toast.error(error.message)
    toast.success("Enregistré")
    reload()
  }
  const curCarrier = carriers.find((c) => c.name === x.carrier)
  const autoFee = curCarrier?.type === "nevada" || curCarrier?.type === "livcash"
  const setCity = (v: string) => {
    const fee = feeFor(curCarrier, v)
    patch({ city: v, ...(fee != null ? { delivery_fee: fee } : {}) })
  }
  const items = x.items || []
  const setItem = (i: number, f: Partial<Item>) => {
    const next = items.map((it, j) => {
      if (j !== i) return it
      const m = { ...it, ...f }
      const pr = findProduct(m, products)
      const vr = pr ? findVariant(m, pr, variants) : undefined
      return { ...m, product_id: pr?.id, variant_id: vr?.id }
    })
    const total = next.reduce((s, it) => s + it.price * it.qty, 0)
    patch({ items: next, ...(f.price != null || f.qty != null ? { total } : {}) })
  }
  const pickProduct = (i: number, id: string) => {
    const pr = products.find((p) => p.id === id)
    if (pr) setItem(i, { name: pr.name, cost: pr.cost, price: items[i].price || pr.price })
  }
  const toggleExchange = (i: number, on: boolean) => {
    const next = items.map((it, j) => (j === i ? { ...it, exchange: on } : it))
    const any = next.some((it) => it.exchange)
    patch({ items: next, is_exchange: any, ...(any ? {} : { exchange_of: null }) })
  }
  const addItem = () => patch({ items: [...items, { name: "", qty: 1, price: 0 }] })
  const sumItems = (arr: Item[]) => arr.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0)
  const delItem = (i: number) => { const next = items.filter((_, j) => j !== i); patch({ items: next, total: sumItems(next) }) }
  const itemsSum = sumItems(items)
  const gap = Math.round((x.total || 0) * 100) !== Math.round(itemsSum * 100)
  const cityList = [...new Set(((carriers.find((c) => c.name === x.carrier)?.cities) || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"))
  const issues = items.map((it) => itemIssue(it, products, variants))

  return (
    <div className="border-t border-border py-4 space-y-2 text-sm">
      <div className="grid md:grid-cols-12 gap-2 items-center">
        <button onClick={() => onDetail(x)} className="md:col-span-3 text-left hover:text-accent transition-colors">
          <span className="font-medium">{x.number}</span>
          <span className="text-xs text-muted-foreground"> · {dateTimeFr(x.created_at)} · {x.source}</span>
          {(x.is_exchange || items.some((it) => it.exchange)) && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Échange{x.exchange_of ? ` de ${x.exchange_of}` : ""}</span>}
        </button>
        <div className="md:col-span-1 font-medium">{money(x.total)}</div>
        <select className={`md:col-span-2 h-8 rounded-md px-2 text-xs ${badge}`} value={x.status} onChange={(e) => onStatus(x, e.target.value)}>
          {STATUSES.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
        </select>
        {carriers.some((c) => c.name === x.carrier && c.type !== "manuel") ? (
          <div className="md:col-span-2 text-xs font-medium truncate" title={SHIPPING.find((s) => s.k === x.shipping_status)?.l ?? x.shipping_status}>
            {SHIPPING.find((s) => s.k === x.shipping_status)?.l ?? x.shipping_status}
          </div>
        ) : (
          <select className="md:col-span-2 h-8 rounded-md border border-border bg-background px-2 text-xs" value={x.shipping_status} onChange={(e) => onShipping(x, e.target.value)}>
            {SHIPPING.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
            {!SHIPPING.some((s) => s.k === x.shipping_status) && <option value={x.shipping_status}>{x.shipping_status}</option>}
          </select>
        )}
        <select className="md:col-span-3 h-8 rounded-md border border-border bg-background px-2 text-xs" value={x.carrier || ""} onChange={(e) => onCarrier(x, e.target.value)}>
          <option value="">Transporteur…</option>
          {carriers.filter((c) => (c.type === "nevada" || c.type === "livcash") && (c.active || c.name === x.carrier)).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          {x.carrier && x.carrier !== "Autre" && !carriers.some((c) => c.name === x.carrier && (c.type === "nevada" || c.type === "livcash")) && <option value={x.carrier}>{x.carrier}</option>}
          <option value="Autre">Autre</option>
        </select>
        <a className="md:col-span-1 text-muted-foreground hover:text-success" href={waLink(x.phone, `Bonjour ${x.customer_name}, nous vous contactons de Cloud Brand au sujet de votre commande.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
      </div>

      <div className="grid md:grid-cols-12 gap-2 items-center">
        <div className="md:col-span-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Code suivi</span>
          <Cell value={x.tracking_number} placeholder="Code suivi (vide = à expédier)" onSave={(v) => patch({ tracking_number: v.trim() || null })} />
        </div>
        <div className="md:col-span-4 flex items-center gap-2">
          <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" title="Centre de profit" value={(x as Order & { profit_center_id?: string | null }).profit_center_id || ""} onChange={(e) => patch({ profit_center_id: e.target.value || null })}>
            <option value="">Centre de profit…</option>
            {profitCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Frais de livraison (DH)</span>
          <Cell type="number" value={x.delivery_fee} placeholder={autoFee ? "Auto selon la ville" : "Saisir le prix"} onSave={(v) => patch({ delivery_fee: v.trim() === "" ? null : Number(v) || 0 })} />
        </div>
      </div>
      <div className="grid md:grid-cols-12 gap-2">
        <div className="md:col-span-2"><Cell value={x.customer_name} placeholder="Nom" onSave={(v) => patch({ customer_name: v })} /></div>
        <div className="md:col-span-2"><Cell value={x.phone} placeholder="Téléphone" onSave={(v) => patch({ phone: v })} /></div>
        <div className="md:col-span-2">{cityList.length ? (
          <select className={`h-8 w-full rounded-md border bg-background px-2 text-xs ${x.city && !cityList.includes(x.city) ? "border-destructive" : "border-border"}`} value={x.city || ""} onChange={(e) => setCity(e.target.value)}>
            <option value="">Ville…</option>
            {x.city && !cityList.includes(x.city) && <option value={x.city}>{x.city} (hors liste)</option>}
            {cityList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : <Cell value={x.city} placeholder="Ville" onSave={setCity} />}</div>
        <div className="md:col-span-3"><Cell value={x.address} placeholder="Adresse" onSave={(v) => patch({ address: v })} /></div>
        <div className="md:col-span-3"><Cell value={x.customer_note} placeholder="Remarque du client" onSave={(v) => patch({ customer_note: v })} /></div>
      </div>

      <div className="space-y-1">
        <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="col-span-3">Produit</span><span className="col-span-2">Couleur</span><span className="col-span-2">Taille</span><span className="col-span-1">Qté</span><span className="col-span-2">Prix unitaire (DH)</span><span className="col-span-1">Échange</span>
        </div>
        {items.map((it, i) => {
          const pr = findProduct(it, products)
          const vs = pr ? variants.filter((v) => v.product_id === pr.id) : []
          const colors = [...new Set(vs.map((v) => v.color).filter(Boolean))]
          const sizes = [...new Set(vs.filter((v) => !it.color || v.color.toLowerCase() === it.color.toLowerCase()).map((v) => v.size).filter(Boolean))]
          return (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select className={`col-span-12 md:col-span-3 h-8 rounded-md border px-2 text-xs bg-background ${issues[i] === "produit" ? "border-destructive" : "border-border"}`} value={pr?.id || ""} onChange={(e) => pickProduct(i, e.target.value)}>
                {!pr && <option value="">{it.name || "Produit…"} (absent du stock)</option>}
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="col-span-4 md:col-span-2">
                {colors.length ? (
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={it.color || ""} onChange={(e) => setItem(i, { color: e.target.value })}>
                    <option value="">Couleur…</option>
                    {it.color && !colors.includes(it.color) && <option value={it.color}>{it.color}</option>}
                    {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : <Cell value={it.color} placeholder="Couleur" onSave={(v) => setItem(i, { color: v })} />}
              </div>
              <div className="col-span-4 md:col-span-2">
                {sizes.length ? (
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={it.size || ""} onChange={(e) => setItem(i, { size: e.target.value })}>
                    <option value="">Taille…</option>
                    {it.size && !sizes.includes(it.size) && <option value={it.size}>{it.size}</option>}
                    {sizes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : <Cell value={it.size} placeholder="Taille" onSave={(v) => setItem(i, { size: v })} />}
              </div>
              <div className="col-span-2 md:col-span-1"><Cell type="number" value={it.qty} onSave={(v) => setItem(i, { qty: Math.max(1, Number(v) || 1) })} /></div>
              <div className="col-span-2 md:col-span-2"><Cell type="number" value={it.price} onSave={(v) => setItem(i, { price: Number(v) || 0 })} /></div>
              <label className="col-span-6 md:col-span-1 flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" checked={!!it.exchange} onChange={(e) => toggleExchange(i, e.target.checked)} /><span className="md:hidden">Échange</span></label>
              <button className="col-span-6 md:col-span-1 text-muted-foreground hover:text-destructive justify-self-start" onClick={() => delItem(i)} aria-label="Supprimer la ligne"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )
        })}
        <button className="text-xs text-accent inline-flex items-center gap-1" onClick={addItem}><Plus className="h-3 w-3" /> Ajouter un produit</button>
        <div className={`text-xs ${gap ? "text-destructive" : "text-muted-foreground"}`}>
          Somme des produits (prix × qté) : <span className="font-medium">{money(itemsSum)}</span> · Total commande : <span className="font-medium">{money(x.total)}</span>
          {gap && <button className="ml-2 underline" onClick={() => patch({ total: itemsSum })}>Corriger le total ({money(itemsSum)})</button>}
        </div>
        {issues.some(Boolean) && (
          <Link to="/stock" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {issues.includes("produit") ? "Produit absent de la base de stock — cliquez pour le créer." : "Couleur/taille absente du stock — cliquez pour l’ajouter."}
          </Link>
        )}
      </div>
    </div>
  )
}
