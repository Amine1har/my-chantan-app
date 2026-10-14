import { useEffect, useState } from "react"
import { supabase } from "@/lib/chantan-db"
import { useAuth } from "@/lib/auth"

export const PAGES = [
  { k: "tableau-de-bord", l: "Tableau de bord" },
  { k: "commandes", l: "Commandes" },
  { k: "expedition", l: "Expédition" },
  { k: "clients", l: "Clients" },
  { k: "transporteurs", l: "Transporteurs" },
  { k: "stock", l: "Gestion de stock" },
  { k: "kpis", l: "KPIs" },
  { k: "comptabilite", l: "Comptabilité" },
  { k: "comptabilite-generale", l: "Comptabilité générale" },
  { k: "publicites", l: "Meta Ads" },
  { k: "marketing", l: "Marketing WhatsApp" },
  { k: "studio", l: "CLAWS Studio" },
  { k: "integrations", l: "Intégrations" },
]

export const ROLES: { k: string; l: string; perms: string[] }[] = [
  { k: "confirmation", l: "Confirmation", perms: ["commandes", "clients", "expedition"] },
  { k: "logistique", l: "Logistique & stock", perms: ["commandes", "expedition", "transporteurs", "stock"] },
  { k: "marketing", l: "Marketing & Ads", perms: ["publicites", "marketing", "clients", "kpis"] },
  { k: "comptable", l: "Comptable", perms: ["tableau-de-bord", "comptabilite", "comptabilite-generale", "kpis"] },
  { k: "gestionnaire", l: "Gestionnaire (tout sauf intégrations)", perms: PAGES.map((p) => p.k).filter((k) => k !== "integrations") },
  { k: "personnalise", l: "Personnalisé", perms: [] },
]

export type Member = { id: string; user_id: string; email: string; name: string; role: string; permissions: string[]; active: boolean; created_at: string }

const cache = new Map<string, Member | null>()

// Pas de ligne dans team_members = propriétaire (accès total)
export function usePerms() {
  const { session } = useAuth()
  const uid = session?.user.id
  const [member, setMember] = useState<Member | null | undefined>(uid && cache.has(uid) ? cache.get(uid) : undefined)
  useEffect(() => {
    if (!uid) return
    supabase.from("team_members").select("*").eq("user_id", uid).maybeSingle().then(({ data }) => {
      cache.set(uid, (data as Member) || null)
      setMember((data as Member) || null)
    })
  }, [uid])
  const loading = member === undefined
  const isOwner = member === null
  const can = (k: string) => (isOwner ? true : !!member && member.active && member.permissions.includes(k))
  return { loading, isOwner, member: member || null, can }
}
