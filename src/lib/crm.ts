import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/chantan-db"

export type Item = { product_id?: string; variant_id?: string; name: string; color?: string; size?: string; qty: number; price: number; cost?: number; exchange?: boolean }
export type ProductVariant = { id: string; product_id: string; color: string; size: string; stock: number; created_at: string }
export type Order = {
  id: string; number: string | null; customer_name: string; phone: string | null; city: string | null
  address: string | null; items: Item[]; total: number; status: string; source: string
  shipping_status: string; tracking_number: string | null; carrier: string | null; notes: string | null
  shopify_id: string | null; ad_campaign: string | null; customer_note: string | null; delivery_fee?: number | null; is_exchange?: boolean; exchange_of?: string | null; created_at: string
}
export type Product = { id: string; name: string; sku: string | null; price: number; cost: number; stock: number; alert_threshold: number; keywords?: string | null; created_at: string }
export type Customer = { id: string; name: string; phone: string | null; email: string | null; city: string | null; address: string | null; source: string | null; created_at: string }
export type Expense = { id: string; label: string; category: string; amount: number; date: string; created_at: string; cost_center_id?: string | null }
export type Ad = { id: string; name: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number; date: string; meta_id: string | null; product_id?: string | null }
export type Promo = { id: string; name: string; message: string; audience: string; sent_count: number; created_at: string }
export type Move = { id: string; product_id: string; type: string; quantity: number; note: string | null; created_at: string }

export type Carrier = { id: string; name: string; type: string; api_url: string | null; api_key_header: string | null; api_key: string | null; status_path: string | null; sheet_url: string | null; tracking_col: string | null; status_col: string | null; cities?: string | null; delivery_fees?: string | null; delivery_statuses?: string | null; active: boolean; last_sync: string | null; created_at: string }

type StatusDef = { k: string; l: string; cls: string; sys?: boolean }
export const STATUSES: StatusDef[] = [
  { k: "confirmee", l: "Confirmé", cls: "bg-emerald-100 text-emerald-800" },
  { k: "annulee", l: "Annulé", cls: "bg-red-100 text-red-800" },
  { k: "appel_whatsapp", l: "Appel + Message Whatssap", cls: "bg-orange-100 text-orange-800" },
  { k: "appel_1", l: "Appel 1", cls: "bg-orange-100 text-orange-800" },
  { k: "appel_2", l: "Appel 2", cls: "bg-orange-100 text-orange-800" },
  { k: "appel_3", l: "Appel 3", cls: "bg-orange-100 text-orange-800" },
  { k: "boite_vocale", l: "Boîte Vocal", cls: "bg-sky-100 text-sky-800" },
  { k: "doublon", l: "Doublon", cls: "bg-gray-200 text-gray-700" },
  { k: "fake_order", l: "Fake order", cls: "bg-red-100 text-red-800" },
  { k: "injoignable", l: "Injoignable", cls: "bg-amber-100 text-amber-800" },
  { k: "pas_de_reponse", l: "Pas de réponse", cls: "bg-yellow-100 text-yellow-800" },
  { k: "pas_serieux", l: "Pas sérieux", cls: "bg-rose-100 text-rose-800" },
  { k: "reporte", l: "Reporté", cls: "bg-violet-100 text-violet-800" },
  { k: "solde_out", l: "Solde out.", cls: "bg-stone-200 text-stone-700" },
  { k: "nouvelle", l: "Nouvelle", cls: "bg-slate-100 text-slate-700", sys: true },
  { k: "expediee", l: "Expédiée", cls: "bg-indigo-100 text-indigo-800", sys: true },
  { k: "livree", l: "Livrée", cls: "bg-emerald-100 text-emerald-800", sys: true },
  { k: "retournee", l: "Retournée", cls: "bg-rose-100 text-rose-800", sys: true },
]
export const CONFIRM_STATUSES = STATUSES.filter((s) => !s.sys)
export const SHIPPING = [
  { k: "en_attente", l: "En attente" },
  { k: "en_transit", l: "En cours de livraison" },
  { k: "livre", l: "Livré" },
  { k: "non_livre", l: "Non livré" },
  { k: "retourne", l: "Retourné" },
]
export const CATEGORIES = [
  { k: "publicite", l: "Publicité" }, { k: "salaires", l: "Salaires" }, { k: "livraison", l: "Livraison" },
  { k: "achat", l: "Achat marchandise" }, { k: "loyer", l: "Loyer & abonnements" }, { k: "autre", l: "Autre" },
]
export const statusLabel = (k: string) => STATUSES.find((s) => s.k === k)?.l ?? k
export const catLabel = (k: string) => CATEGORIES.find((s) => s.k === k)?.l ?? k
export const money = (n: number) => `${Math.round(n || 0).toLocaleString("fr-FR")} DH`
export const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
export const dateTimeFr = (d: string) => {
  const t = new Date(d)
  const day = t.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Casablanca" })
  const hm = t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })
  return `${day} à ${hm}`
}
export const inputCls = "w-full h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"

export const waLink = (phone: string | null, text = "") => {
  let d = (phone || "").replace(/\D/g, "")
  if (d.startsWith("00")) d = d.slice(2)
  else if (d.startsWith("0")) d = "212" + d.slice(1)
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}
const sn = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
// Recherche multi-mots, insensible aux accents/majuscules, sur toutes les valeurs données
export const matchQ = (q: string, ...vals: unknown[]) => {
  const t = sn(q).split(/\s+/).filter(Boolean)
  if (!t.length) return true
  const h = sn(vals.map((v) => (Array.isArray(v) ? v.join(" ") : v)).join(" "))
  const digits = h.replace(/[^\d ]/g, "")
  return t.every((w) => h.includes(w) || digits.includes(w.replace(/^0+/, "")))
}
// Tarifs « Ville: prix » (une ligne par ville ; « Défaut: prix » pour les autres cas)
export function feeFor(c: Carrier | undefined, city: string | null | undefined): number | null {
  if (!c || !(c.type === "nevada" || c.type === "livcash")) return null
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  const map = new Map<string, number>()
  for (const l of String(c.delivery_fees || "").split(/\r?\n/)) {
    const m = l.match(/^(.+?)\s*[:=;]\s*(\d+(?:[.,]\d+)?)/)
    if (m) map.set(n(m[1]), Number(m[2].replace(",", ".")))
  }
  const k = n(city || "")
  if (k && map.has(k)) return map.get(k)!
  for (const d of ["defaut", "autre", "*"]) if (map.has(d)) return map.get(d)!
  return null
}
export const phoneKey = (p: string | null) => (p || "").replace(/\D/g, "").slice(-9)
export const inRange = (d: string, days: number) => days === 0 || Date.now() - new Date(d).getTime() <= days * 86400000

export function useRows<T>(table: string, orderBy = "created_at", asc = false) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    // Le serveur limite chaque requête à 1000 lignes : on charge par pages
    const all: T[] = []
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: asc }).order("id").range(from, from + 999)
      if (error) { toast.error("Chargement impossible : " + error.message); break }
      all.push(...((data as T[]) || []))
      if (!data || data.length < 1000) break
    }
    setRows(all)
    setLoading(false)
  }, [table, orderBy, asc])
  useEffect(() => { load() }, [load])
  return { rows, loading, reload: load }
}

const nk = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
export const kwList = (p: Product) => (p.keywords || "").split(/[,;\n]/).map(nk).filter(Boolean)
export const findProduct = (it: Item, products: Product[]) =>
  products.find((p) => p.id === it.product_id) ||
  products.find((p) => p.name.toLowerCase() === (it.name || "").toLowerCase()) ||
  products.find((p) => kwList(p).some((k) => nk(it.name || "") === k || nk(it.name || "").includes(k)))
export const findVariant = (it: Item, pr: Product, variants: ProductVariant[]) =>
  variants.find((v) => v.product_id === pr.id && (v.color || "").toLowerCase() === (it.color || "").toLowerCase() && (v.size || "").toLowerCase() === (it.size || "").toLowerCase())
// Détecte une ligne de commande qui n'existe pas dans le stock
export function itemIssue(it: Item, products: Product[], variants: ProductVariant[]): "produit" | "variante" | null {
  const pr = findProduct(it, products)
  if (!pr) return "produit"
  if (variants.some((v) => v.product_id === pr.id) && !findVariant(it, pr, variants)) return "variante"
  return null
}

// Audit de cohérence : quantités, montants et répartition des prix incohérents
export function logicIssues(o: Pick<Order, "items" | "total" | "status">): string[] {
  const out: string[] = []
  const items = o.items || []
  const total = Number(o.total) || 0
  if (!items.length) out.push("Aucun produit")
  if (items.some((it) => (Number(it.qty) || 0) >= 10)) out.push("Quantité anormale (≥ 10)")
  if (items.some((it) => (Number(it.qty) || 0) <= 0)) out.push("Quantité nulle ou négative")
  if (total >= 5000 || items.some((it) => (Number(it.price) || 0) >= 3000)) out.push("Montant astronomique")
  if (total <= 0) out.push("Total nul")
  if (items.length > 1) {
    const priced = items.filter((it) => (Number(it.price) || 0) > 0).length
    if (priced === 1) out.push("Un seul produit porte tout le prix, les autres à 0")
    else if (priced === 0 && total > 0) out.push("Tous les produits à 0 DH")
  }
  const sum = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0)
  if (items.length && total > 0 && Math.abs(sum - total) > 1) out.push(`Total ≠ somme des produits (${Math.round(sum)} vs ${Math.round(total)})`)
  return out
}

export function itemCost(it: Item, products: Product[]) {
  if (it.cost != null) return it.cost
  return findProduct(it, products)?.cost ?? 0
}

export function computePnl(orders: Order[], products: Product[], ads: Ad[], expenses: Expense[]) {
  const delivered = orders.filter((o) => o.status === "livree")
  const revenue = delivered.reduce((s, o) => s + o.total, 0)
  const cogs = delivered.reduce((s, o) => s + (o.items || []).reduce((a, it) => a + itemCost(it, products) * it.qty, 0), 0)
  const adSpend = ads.reduce((s, a) => s + a.spend, 0)
  const charges = expenses.reduce((s, e) => s + e.amount, 0)
  return { revenue, cogs, adSpend, charges, gross: revenue - cogs, net: revenue - cogs - adSpend - charges }
}
