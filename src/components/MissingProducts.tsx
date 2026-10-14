import { useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Field, Modal } from "@/components/kit"
import { inputCls } from "@/lib/crm"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Order, Product, ProductVariant, findProduct, findVariant, itemIssue } from "@/lib/crm"

type Group = { name: string; price: number; orders: number; combos: { color: string; size: string }[]; kind: "produit" | "variante"; productId?: string }

export function missingGroups(orders: Order[], products: Product[], variants: ProductVariant[]) {
  const g = new Map<string, Group>()
  for (const o of orders) {
    if (["annulee", "retournee"].includes(o.status)) continue
    for (const it of o.items || []) {
      const issue = itemIssue(it, products, variants)
      if (!issue || !it.name) continue
      const key = it.name.toLowerCase()
      const cur = g.get(key) || { name: it.name, price: it.price, orders: 0, combos: [], kind: issue, productId: findProduct(it, products)?.id }
      cur.orders++
      const c = { color: it.color || "", size: it.size || "" }
      if ((c.color || c.size) && !cur.combos.some((x) => x.color.toLowerCase() === c.color.toLowerCase() && x.size.toLowerCase() === c.size.toLowerCase())) cur.combos.push(c)
      g.set(key, cur)
    }
  }
  return [...g.values()]
}

export default function MissingProducts({ orders, products, variants, onDone }: { orders: Order[]; products: Product[]; variants: ProductVariant[]; onDone: () => void }) {
  const groups = missingGroups(orders, products, variants)
  const [edit, setEdit] = useState<Group | null>(null)
  const [d, setD] = useState({ name: "", price: "0", cost: "0", combos: [] as { color: string; size: string; stock: string }[] })
  if (!groups.length && !edit) return null

  const openEdit = (g: Group) => {
    setD({ name: g.name, price: String(g.price), cost: "0", combos: g.combos.length ? g.combos.map((c) => ({ ...c, stock: "0" })) : [{ color: "", size: "", stock: "0" }] })
    setEdit(g)
  }
  const setCombo = (i: number, k: "color" | "size" | "stock", v: string) => setD({ ...d, combos: d.combos.map((c, j) => (j === i ? { ...c, [k]: v } : c)) })

  const create = async (g: Group, custom?: typeof d) => {
    let pid = g.productId
    const combos = custom ? custom.combos.filter((c) => c.color || c.size).map((c) => ({ color: c.color.trim(), size: c.size.trim(), stock: Math.max(0, Number(c.stock) || 0) })) : g.combos.map((c) => ({ ...c, stock: 0 }))
    if (!pid) {
      const { data, error } = await supabase.from("products").insert({ name: custom?.name.trim() || g.name, price: custom ? Number(custom.price) || 0 : g.price, cost: custom ? Number(custom.cost) || 0 : 0, stock: combos.reduce((s, c) => s + c.stock, 0), alert_threshold: 5 }).select("id").single()
      if (error) return toast.error(error.message)
      pid = data.id as string
    }
    const existing = variants.filter((v) => v.product_id === pid)
    const toAdd = combos.filter((c) => !existing.some((v) => v.color.toLowerCase() === c.color.toLowerCase() && v.size.toLowerCase() === c.size.toLowerCase()))
    if (toAdd.length) {
      const { error } = await supabase.from("product_variants").insert(toAdd.map((c) => ({ product_id: pid, color: c.color, size: c.size, stock: c.stock })))
      if (error) return toast.error(error.message)
      if (existing.length) await supabase.from("products").update({ stock: existing.reduce((s, v) => s + v.stock, 0) + toAdd.reduce((s, c) => s + c.stock, 0) }).eq("id", pid)
    }
    // Relier les commandes concernées au produit et aux variantes
    const { data: pv } = await supabase.from("product_variants").select("*").eq("product_id", pid)
    const { data: pr } = await supabase.from("products").select("*").eq("id", pid).single()
    for (const o of orders) {
      let changed = false
      const items = (o.items || []).map((it0) => {
        let it = it0
        if (it.name.toLowerCase() !== g.name.toLowerCase()) return it
        if (custom && custom.name.trim()) it = { ...it, name: custom.name.trim() }
        const vr = findVariant(it, pr as Product, (pv || []) as ProductVariant[])
        changed = true
        return { ...it, product_id: pid, variant_id: vr?.id, cost: (pr as Product).cost }
      })
      if (changed) await supabase.from("orders").update({ items }).eq("id", o.id)
    }
    toast.success(`« ${custom?.name || g.name} » ajouté au stock`)
    setEdit(null)
    onDone()
  }

  return (
    <div className="mb-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 font-medium text-destructive mb-3"><AlertTriangle className="h-4 w-4" /> Alerte : {groups.length} produit(s) / variante(s) de commandes absents de votre base de stock</div>
      {groups.map((g) => (
        <div key={g.name} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-2 text-sm">
          <div>
            <div className="font-medium">{g.name} <span className="text-xs text-muted-foreground">· {g.orders} commande(s) · {g.kind === "produit" ? "produit inconnu" : "variante inconnue"}</span></div>
            {g.combos.length > 0 && <div className="text-xs text-muted-foreground">{g.combos.map((c) => [c.color, c.size].filter(Boolean).join(" / ")).join(" · ")}</div>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(g)}>Modifier avant de créer</Button>
            <Button size="sm" onClick={() => create(g)}>{g.kind === "produit" ? "Créer le produit" : "Ajouter les variantes"}</Button>
          </div>
        </div>
      ))}
      {edit && (
        <Modal title={`Créer « ${edit.name} »`} onClose={() => setEdit(null)} wide>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3"><Field label="Nom du produit"><input className={inputCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field></div>
            <Field label="Prix de vente (DH)"><input className={inputCls} type="number" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} /></Field>
            <Field label="Coût d’achat (DH)"><input className={inputCls} type="number" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} /></Field>
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Variantes (couleur / taille / quantité) — ajoutez-en autant que nécessaire</div>
            {d.combos.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input className={inputCls + " col-span-4"} placeholder="Couleur" value={c.color} onChange={(e) => setCombo(i, "color", e.target.value)} />
                <input className={inputCls + " col-span-3"} placeholder="Taille" value={c.size} onChange={(e) => setCombo(i, "size", e.target.value)} />
                <input className={inputCls + " col-span-3"} type="number" min={0} placeholder="Stock" value={c.stock} onChange={(e) => setCombo(i, "stock", e.target.value)} />
                <button className="col-span-2 justify-self-start text-muted-foreground hover:text-destructive" onClick={() => setD({ ...d, combos: d.combos.filter((_, j) => j !== i) })} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button className="text-xs text-accent" onClick={() => setD({ ...d, combos: [...d.combos, { color: "", size: "", stock: "0" }] })}>+ Ajouter une couleur / taille</button>
          </div>
          <Button className="mt-5 w-full" onClick={() => create(edit, d)}>Créer le produit</Button>
        </Modal>
      )}
    </div>
  )
}
