import { useState } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Empty, Field, Modal, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import SortSelect, { sortList } from "@/components/SortSelect"
import Variants from "@/components/Variants"
import MissingProducts from "@/components/MissingProducts"
import { Move, Order, Product, ProductVariant, dateFr, inputCls, matchQ, money, useRows } from "@/lib/crm"

const SORTS = [
  { k: "name_asc", l: "Nom : A → Z" },
  { k: "name_desc", l: "Nom : Z → A" },
  { k: "stock_asc", l: "Stock : plus bas d’abord" },
  { k: "stock_desc", l: "Stock : plus élevé d’abord" },
  { k: "price_asc", l: "Prix : croissant" },
  { k: "price_desc", l: "Prix : décroissant" },
  { k: "created_desc", l: "Ajoutés récemment" },
  { k: "created_asc", l: "Ajoutés en premier" },
]
const prodGet = (k: string) => (x: Product): unknown =>
  k.startsWith("name") ? x.name : k.startsWith("stock") ? x.stock : k.startsWith("price") ? x.price : x.created_at

export default function Stock() {
  const p = useRows<Product>("products", "name", true)
  const m = useRows<Move>("stock_movements")
  const v = useRows<ProductVariant>("product_variants")
  const o = useRows<Order>("orders")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState("name_asc")
  const [open, setOpen] = useState<string | null>(null)
  const [add, setAdd] = useState(false)
  const [adj, setAdj] = useState<Product | null>(null)
  const [edit, setEdit] = useState<Product | null>(null)
  const reload = () => { p.reload(); m.reload(); v.reload(); o.reload() }
  const sp = sortList(p.rows, prodGet(sort), sort.endsWith("_asc"))
  const name = (id: string) => p.rows.find((x) => x.id === id)?.name ?? "—"

  return (
    <Shell>
      <PageHead title="Gestion de stock" sub="Quantités, mouvements et alertes de rupture." actions={<Button onClick={() => setAdd(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau produit</Button>} />
      <MissingProducts orders={o.rows} products={p.rows} variants={v.rows} onDone={reload} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className={inputCls + " max-w-sm"} placeholder="Rechercher un produit : nom, référence, mot-clé, couleur, taille…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SortSelect value={sort} onChange={setSort} options={SORTS} />
      </div>
      <div className="hidden md:grid grid-cols-12 gap-3 text-xs text-muted-foreground pb-2">
        <span className="col-span-4">Produit</span><span className="col-span-2">Prix / Coût</span><span className="col-span-2">Stock</span><span className="col-span-2">Seuil d’alerte</span><span className="col-span-2" />
      </div>
      {sp.filter((x) => matchQ(q, x.name, x.sku, x.keywords, x.price, x.cost, x.stock, v.rows.filter((r) => r.product_id === x.id).map((r) => `${r.color} ${r.size}`))).map((x) => (
        <div key={x.id} className="border-t border-border py-3 grid md:grid-cols-12 gap-3 items-center text-sm">
          <div className="md:col-span-4"><div className="font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{x.sku}</div>
            {x.keywords && <div className="text-[11px] text-muted-foreground">Mots-clés : {x.keywords}</div>}
            <div className="mt-1 flex flex-wrap gap-1">{v.rows.filter((r) => r.product_id === x.id).map((r) => <span key={r.id} className={`rounded-full border px-2 py-0.5 text-[11px] ${r.stock === 0 ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"}`}>{[r.color, r.size].filter(Boolean).join(" / ")} : {r.stock}</span>)}</div></div>
          <div className="md:col-span-2">{money(x.price)} / {money(x.cost)}</div>
          <div className={`md:col-span-2 font-medium ${x.stock === 0 ? "text-destructive" : x.stock <= x.alert_threshold ? "text-amber-600" : ""}`}>
            {x.stock} {x.stock === 0 ? "· Rupture" : x.stock <= x.alert_threshold ? "· Stock bas" : ""}
          </div>
          <div className="md:col-span-2">{x.alert_threshold}</div>
          <div className="md:col-span-2 flex flex-col items-start gap-1 text-sm">
            <button className="text-accent" onClick={() => setEdit(x)}>Modifier le produit</button>
            <button className="text-accent" onClick={() => setAdj(x)}>Mouvement de stock</button>
            <button className="text-accent" onClick={() => setOpen(open === x.id ? null : x.id)}>Variantes ({v.rows.filter((r) => r.product_id === x.id).length})</button>
          </div>
          {open === x.id && <Variants product={x} variants={v.rows.filter((r) => r.product_id === x.id)} onDone={reload} />}
        </div>
      ))}
      {!p.rows.length && <Empty text="Aucun produit. Ajoutez votre premier produit." />}
      {!!p.rows.length && !!q && !p.rows.some((x) => matchQ(q, x.name, x.sku, x.keywords, x.price, x.cost, x.stock, v.rows.filter((r) => r.product_id === x.id).map((r) => `${r.color} ${r.size}`))) && <Empty text="Aucun produit ne correspond à votre recherche." />}

      <h2 className="text-lg font-semibold mt-12 mb-3">Historique des mouvements</h2>
      {m.rows.slice(0, 30).map((x) => (
        <div key={x.id} className="border-t border-border py-2 text-sm flex justify-between gap-3">
          <span>{name(x.product_id)} <span className="text-muted-foreground">· {x.note || x.type}</span></span>
          <span className={x.type === "sortie" ? "text-destructive" : "text-success"}>{x.type === "sortie" ? "−" : "+"}{x.quantity} · {dateFr(x.created_at)}</span>
        </div>
      ))}
      {!m.rows.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucun mouvement pour le moment.</p>}

      {add && <AddProduct onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload() }} />}
      {edit && <EditProduct product={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload() }} />}
      {adj && <Adjust product={adj} onClose={() => setAdj(null)} onDone={() => { setAdj(null); reload() }} />}
    </Shell>
  )
}

function AddProduct({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", sku: "", price: "", cost: "", stock: "0", alert_threshold: "5" })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.name) return toast.error("Nom requis")
    const { data, error } = await supabase.from("products").insert({ name: f.name, sku: f.sku, price: Number(f.price) || 0, cost: Number(f.cost) || 0, stock: Number(f.stock) || 0, alert_threshold: Number(f.alert_threshold) || 0 }).select("id").single()
    if (error) return toast.error(error.message)
    if (Number(f.stock) > 0) await supabase.from("stock_movements").insert({ product_id: data.id, type: "entree", quantity: Number(f.stock), note: "Stock initial" })
    toast.success("Produit ajouté")
    onDone()
  }
  return (
    <Modal title="Nouveau produit" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Nom"><input className={inputCls} value={f.name} onChange={set("name")} /></Field></div>
        <Field label="Référence (SKU)"><input className={inputCls} value={f.sku} onChange={set("sku")} /></Field>
        <Field label="Prix de vente (DH)"><input className={inputCls} type="number" value={f.price} onChange={set("price")} /></Field>
        <Field label="Coût d’achat (DH)"><input className={inputCls} type="number" value={f.cost} onChange={set("cost")} /></Field>
        <Field label="Stock initial"><input className={inputCls} type="number" value={f.stock} onChange={set("stock")} /></Field>
        <Field label="Seuil d’alerte"><input className={inputCls} type="number" value={f.alert_threshold} onChange={set("alert_threshold")} /></Field>
      </div>
      <Button className="mt-5 w-full" onClick={save}>Ajouter</Button>
    </Modal>
  )
}

function EditProduct({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: product.name, sku: product.sku || "", price: String(product.price), cost: String(product.cost), alert_threshold: String(product.alert_threshold), keywords: product.keywords || "" })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [kws, setKws] = useState<string[]>((product.keywords || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))
  const [kwDraft, setKwDraft] = useState("")
  const addKws = (raw = kwDraft) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return kws
    const next = [...kws]
    for (const k of parts) if (!next.some((x) => x.toLowerCase() === k.toLowerCase())) next.push(k)
    setKws(next)
    setKwDraft("")
    return next
  }
  const remove = async () => {
    setBusy(true)
    try {
      const a = await supabase.from("product_variants").delete().eq("product_id", product.id)
      if (a.error) throw a.error
      const b = await supabase.from("stock_movements").delete().eq("product_id", product.id)
      if (b.error) throw b.error
      const c = await supabase.from("products").delete().eq("id", product.id)
      if (c.error) throw c.error
      toast.success("Produit supprimé")
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (!f.name) return toast.error("Nom requis")
    const { error } = await supabase.from("products").update({ name: f.name, sku: f.sku, price: Number(f.price) || 0, cost: Number(f.cost) || 0, alert_threshold: Number(f.alert_threshold) || 0, keywords: addKws().join(", ") }).eq("id", product.id)
    if (error) return toast.error(error.message)
    toast.success("Produit modifié")
    onDone()
  }
  return (
    <Modal title={`Modifier — ${product.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Nom"><input className={inputCls} value={f.name} onChange={set("name")} /></Field></div>
        <Field label="Référence (SKU)"><input className={inputCls} value={f.sku} onChange={set("sku")} /></Field>
        <Field label="Seuil d’alerte"><input className={inputCls} type="number" value={f.alert_threshold} onChange={set("alert_threshold")} /></Field>
        <Field label="Prix de vente (DH)"><input className={inputCls} type="number" value={f.price} onChange={set("price")} /></Field>
        <Field label="Coût d’achat (DH)"><input className={inputCls} type="number" value={f.cost} onChange={set("cost")} /></Field>
      </div>
      <div className="mt-3">
        <Field label="Mots-clés associés (autant que vous voulez)">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="ex. veste metro promotion été" value={kwDraft} onChange={(e) => setKwDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKws() } }} />
            <Button type="button" variant="outline" onClick={() => addKws()}>Ajouter</Button>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kws.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs">{k}
              <button type="button" aria-label="Retirer" onClick={() => setKws(kws.filter((x) => x !== k))}><X className="h-3 w-3" /></button>
            </span>
          ))}
          {!kws.length && <span className="text-xs text-muted-foreground">Aucun mot-clé pour le moment.</span>}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Toute commande Shopify dont le nom contient l’un de ces mots-clés sera rattachée à ce produit, sans en créer un nouveau.</p>
      <p className="mt-3 text-xs text-muted-foreground">Les couleurs, tailles et quantités se modifient dans « Variantes » sous le produit.</p>
      <Button className="mt-5 w-full" onClick={save}>Enregistrer</Button>
      <div className="mt-6 border-t border-border pt-4">
        {!confirmDel ? (
          <button className="text-sm text-destructive hover:underline" onClick={() => setConfirmDel(true)}>Supprimer le produit</button>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">Supprimer définitivement « {product.name} » avec toutes ses variantes et son historique de mouvements ? Les commandes existantes ne sont pas supprimées.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Suppression…" : "Oui, supprimer"}</Button>
              <Button variant="outline" onClick={() => setConfirmDel(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Adjust({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState("entree")
  const [qty, setQty] = useState("1")
  const [note, setNote] = useState("")
  const save = async () => {
    const q = Math.abs(Number(qty)) || 0
    if (!q) return toast.error("Quantité invalide")
    const stock = type === "entree" ? product.stock + q : Math.max(0, product.stock - q)
    const { error } = await supabase.from("products").update({ stock }).eq("id", product.id)
    if (error) return toast.error(error.message)
    await supabase.from("stock_movements").insert({ product_id: product.id, type, quantity: q, note: note || null })
    toast.success("Stock mis à jour")
    onDone()
  }
  return (
    <Modal title={`Mouvement — ${product.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Type"><select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}><option value="entree">Entrée (réception)</option><option value="sortie">Sortie (perte, casse…)</option></select></Field>
        <Field label="Quantité"><input className={inputCls} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <Button className="mt-5 w-full" onClick={save}>Valider</Button>
    </Modal>
  )
}
