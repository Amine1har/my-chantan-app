import type { ReactNode } from "react"
import { NavLink, Navigate, useLocation } from "react-router-dom"
import { BookOpen, BarChart3, TrendingUp, Boxes, LogOut, Megaphone, MessageCircle, History, LayoutTemplate, PackagePlus, Plug, ShieldCheck, ShoppingBag, Truck, Users, Wallet } from "lucide-react"
import { supabase } from "@/lib/chantan-db"
import { useAuth } from "@/lib/auth"
import { PAGES, usePerms } from "@/lib/perms"

function Item({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`
      }
    >
      {children}
      <span>{label}</span>
    </NavLink>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const { loading: pl, isOwner, member, can } = usePerms()
  const { pathname } = useLocation()
  if (loading || (session && pl)) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
  if (!session) return <Navigate to="/" replace />
  const seg = pathname.split("/")[1] || ""
  const first = PAGES.find((p) => can(p.k))
  if (!isOwner) {
    if (!first || !member?.active) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground p-6 text-center">
          <p>{member && !member.active ? "Votre compte est désactivé." : "Aucun accès n'a encore été attribué à votre compte."} Contactez l'administrateur.</p>
          <button className="underline" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
        </div>
      )
    }
    if (seg === "equipe" || (PAGES.some((p) => p.k === seg) && !can(seg))) return <Navigate to={`/${first.k}`} replace />
  }
  return (
    <div className="min-h-screen md:flex bg-background text-foreground">
      <aside className="md:w-60 md:min-h-screen shrink-0 border-b md:border-b-0 md:border-r border-border p-4 flex md:flex-col gap-4">
        <div className="hidden md:block px-3 pb-4 border-b border-border">
          <div className="text-xl font-bold tracking-tight">Cloud Brand</div>
          <div className="text-xs text-muted-foreground">{member ? member.name || member.email : "CRM · Gestion e-commerce"}</div>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible flex-1">
          {can("tableau-de-bord") && <Item to="/tableau-de-bord" label="Tableau de bord"><BarChart3 className="h-4 w-4" /></Item>}
          {can("commandes") && <Item to="/commandes" label="Commandes"><ShoppingBag className="h-4 w-4" /></Item>}
          {can("expedition") && <Item to="/expedition" label="Expédition"><PackagePlus className="h-4 w-4" /></Item>}
          {can("clients") && <Item to="/clients" label="Clients"><Users className="h-4 w-4" /></Item>}
          {can("transporteurs") && <Item to="/transporteurs" label="Transporteurs"><Truck className="h-4 w-4" /></Item>}
          {can("stock") && <Item to="/stock" label="Gestion de stock"><Boxes className="h-4 w-4" /></Item>}
          {can("kpis") && <Item to="/kpis" label="KPIs"><TrendingUp className="h-4 w-4" /></Item>}
          {can("comptabilite") && <Item to="/comptabilite" label="Comptabilité"><Wallet className="h-4 w-4" /></Item>}
          {can("comptabilite-generale") && <Item to="/comptabilite-generale" label="Comptabilité générale"><BookOpen className="h-4 w-4" /></Item>}
          {can("publicites") && <Item to="/publicites" label="Meta Ads"><Megaphone className="h-4 w-4" /></Item>}
          {can("marketing") && <Item to="/marketing" label="Marketing WhatsApp"><MessageCircle className="h-4 w-4" /></Item>}
          {can("studio") && (
            <div className="md:mt-2">
              <div className="hidden md:block px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CLAWS Studio</div>
              <div className="flex md:flex-col gap-1">
                <Item to="/studio/templates" label="Templates"><LayoutTemplate className="h-4 w-4" /></Item>
                <Item to="/studio/historique" label="Historique"><History className="h-4 w-4" /></Item>
              </div>
            </div>
          )}
          {can("integrations") && <Item to="/integrations" label="Intégrations"><Plug className="h-4 w-4" /></Item>}
          {isOwner && <Item to="/equipe" label="Équipe & accès"><ShieldCheck className="h-4 w-4" /></Item>}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Déconnexion</span>
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-5 md:p-10 max-w-6xl">{children}</main>
    </div>
  )
}
