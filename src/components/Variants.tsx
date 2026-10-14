import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Product, ProductVariant, inputCls } from "@/lib/crm"
import { Cell } from "@/components/OrderRow"

export default function Variants({ product, variants, onDone }: { product: Product; variants: ProductVariant[]; onDone: () => void }) {
  const [f, setF] = useState({ color: "", size: "", stock: "0" })

  const syncTotal = async (list: ProductVariant[]) => {
    if (!list.length) return
    await supabase.from("products").update({ stock: list.reduce((s, v) => s + v.stock, 0) }).eq("id", product.id)
  }
  const setStock = async (v: ProductVariant, val: string) => {
    const n = Math.max(0, Number(val) || 0)
    const { error } = await supabase.from("product_variants").update({ stock: n }).eq("id", v.id)
    if (error) return toast.error(error.message)
    const diff = n - v.stock
    if (diff) await supabase.from("stock_movements").insert({ product_id: product.id, type: diff > 0 ? "entree" : "sortie", quantity: Math.abs(diff), note: `Ajustement ${[v.color, v.size].filter(Boolean).join(" / ")}` })
    await syncTotal(variants.map((x) => (x.id === v.id ? { ...x, stock: n } : x)))
    onDone()
  }
  const setField = async (v: ProductVariant, k: "color" | "size", val: string) => {
    const { error } = await supabase.from("product_variants").update({ [k]: val }).eq("id", v.id)
    if (error) return toast.error(error.message)
    onDone()
  }
  const del = async (v: ProductVariant) => {
    await supabase.from("product_variants").delete().eq("id", v.id)
    await syncTotal(variants.filter((x) => x.id !== v.id))
    onDone()
  }
  const add = async () => {
    if (!f.color && !f.size) return toast.error("Indiquez une couleur ou une taille")
    if (variants.some((v) => v.color.toLowerCase() === f.color.toLowerCase() && v.size.toLowerCase() === f.size.toLowerCase())) return toast.error("Cette variante existe déjà")
    const stock = Math.max(0, Number(f.stock) || 0)
    const { data, error } = await supabase.from("product_variants").insert({ product_id: product.id, color: f.color, size: f.size, stock }).select("*").single()
    if (error) return toast.error(error.message)
    if (stock) await supabase.from("stock_movements").insert({ product_id: product.id, type: "entree", quantity: stock, note: `Stock initial ${[f.color, f.size].filter(Boolean).join(" / ")}` })
    await syncTotal([...variants, data as ProductVariant])
    setF({ color: "", size: "", stock: "0" })
    onDone()
  }

  return (
    <div className="md:col-span-12 rounded-md bg-muted/40 p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Variantes de « {product.name} » (couleur / taille / stock)</div>
      {variants.map((v) => (
        <div key={v.id} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-4"><Cell value={v.color} placeholder="Couleur" onSave={(x) => setField(v, "color", x)} /></div>
          <div className="col-span-3"><Cell value={v.size} placeholder="Taille" onSave={(x) => setField(v, "size", x)} /></div>
          <div className="col-span-3"><Cell type="number" value={v.stock} onSave={(x) => setStock(v, x)} /></div>
          <button className="col-span-2 justify-self-start text-muted-foreground hover:text-destructive" onClick={() => del(v)} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="grid grid-cols-12 gap-2 items-center pt-1">
        <input className={inputCls + " col-span-4"} placeholder="Couleur (ex. Noir)" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        <input className={inputCls + " col-span-3"} placeholder="Taille (ex. M)" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} />
        <input className={inputCls + " col-span-2"} type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
        <Button size="sm" className="col-span-3" onClick={add}>Ajouter</Button>
      </div>
    </div>
  )
}
