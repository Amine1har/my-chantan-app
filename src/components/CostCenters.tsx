import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { inputCls, money } from "@/lib/crm"

export type CostCenter = { id: string; name: string; kind: string; description: string | null; created_at: string }

export default function CostCenters({ centers, totals, reload }: { centers: CostCenter[]; totals: Record<string, number>; reload: () => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState("cout")
  const [description, setDescription] = useState("")
  const add = async () => {
    if (!name.trim()) return toast.error("Nom requis")
    const { error } = await supabase.from("cost_centers").insert({ name: name.trim(), kind, description: description.trim() || null })
    if (error) return toast.error(error.message)
    setName(""); setDescription("")
    toast.success("Centre ajouté")
    reload()
  }
  const del = async (c: CostCenter) => {
    await supabase.from("expenses").update({ cost_center_id: null }).eq("cost_center_id", c.id)
    const { error } = await supabase.from("cost_centers").delete().eq("id", c.id)
    if (error) return toast.error(error.message)
    reload()
  }
  const Block = ({ k, title }: { k: string; title: string }) => (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {centers.filter((c) => c.kind === k).map((c) => (
        <div key={c.id} className="border-t border-border py-2 flex items-center justify-between gap-3 text-sm">
          <span>{c.name}{c.description && <span className="text-muted-foreground"> · {c.description}</span>}</span>
          <span className="flex items-center gap-3">
            <span className="font-medium">{money(totals[c.id] || 0)}</span>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => del(c)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
          </span>
        </div>
      ))}
      {!centers.some((c) => c.kind === k) && <p className="text-sm text-muted-foreground border-t border-border pt-2">Aucun centre pour le moment.</p>}
    </div>
  )
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold mb-1">Centres de coûts et de profit</h2>
      <p className="text-sm text-muted-foreground mb-3">Créez autant de centres de coût que nécessaire (ex. Publicité, Logistique, Salaires) et un ou plusieurs centres de profit et de projet. Affectez ensuite chaque charge à un centre. Les montants affichés correspondent aux charges du mois.</p>
      <div className="grid md:grid-cols-12 gap-2 border-t border-border pt-4 mb-6">
        <input className={inputCls + " md:col-span-4"} placeholder="Nom du centre" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputCls + " md:col-span-3"} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="cout">Centre de coût</option>
          <option value="cc2">CC2</option>
          <option value="profit">Centre de profit</option>
          <option value="projet">Centre de projet</option>
        </select>
        <input className={inputCls + " md:col-span-4"} placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button className="md:col-span-1" onClick={add}>OK</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-10">
        <Block k="cout" title="Centres de coût" />
        <Block k="cc2" title="CC2" />
        <Block k="profit" title="Centres de profit" />
        <Block k="projet" title="Centres de projet" />
      </div>
    </section>
  )
}
