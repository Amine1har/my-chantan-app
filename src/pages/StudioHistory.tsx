import { useCallback, useEffect, useState } from "react"
import { Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Empty, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { dateTimeFr, inputCls } from "@/lib/crm"

type Gen = { image_url?: string | null; id: string; template_name: string | null; category: string | null; prompt: string | null; result: string | null; model: string | null; favorite: boolean; created_at: string }
const PAGE = 30

export default function StudioHistory() {
  const [rows, setRows] = useState<Gen[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [favOnly, setFavOnly] = useState(false)
  const [q, setQ] = useState("")
  const [dq, setDq] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(0) }, [favOnly, dq])

  const load = useCallback(async () => {
    setLoading(true)
    let qb = supabase.from("studio_generations").select("*", { count: "exact" })
    if (favOnly) qb = qb.eq("favorite", true)
    const c = dq.replace(/[%,()*\\]/g, "")
    if (c) qb = qb.or(`template_name.ilike.%${c}%,result.ilike.%${c}%`)
    const { data, count, error } = await qb.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) toast.error("Chargement impossible : " + error.message)
    setRows((data as Gen[]) || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, favOnly, dq])
  useEffect(() => { load() }, [load])

  const toggle = async (g: Gen) => { await supabase.from("studio_generations").update({ favorite: !g.favorite }).eq("id", g.id); load() }
  const del = async (g: Gen) => {
    if (!window.confirm("Supprimer cette génération ?")) return
    await supabase.from("studio_generations").delete().eq("id", g.id); load()
  }

  return (
    <Shell>
      <PageHead title="Historique" sub="CLAWS Studio : toutes les générations, rattachées à leur template." />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className={inputCls + " max-w-xs"} placeholder="Rechercher dans l’historique…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => setFavOnly(!favOnly)} className={`px-3 py-1 rounded-full text-xs border ${favOnly ? "bg-primary text-primary-foreground" : "border-border"}`}>Favoris uniquement</button>
      </div>
      {rows.map((g) => (
        <div key={g.id} className="border-t border-border py-3 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">{g.template_name || "Template supprimé"} <span className="text-xs text-muted-foreground font-normal">· {g.category} · {dateTimeFr(g.created_at)}</span></div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(g.result || "").then(() => toast.success("Copié"))}>Copier</Button>
              <Button size="sm" variant="outline" aria-label="Favori" onClick={() => toggle(g)}><Star className={`h-3.5 w-3.5 ${g.favorite ? "fill-current" : ""}`} /></Button>
              <Button size="sm" variant="outline" aria-label="Supprimer" onClick={() => del(g)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          {g.image_url && <a href={g.image_url} target="_blank" rel="noreferrer"><img src={g.image_url} alt="" className="h-40 rounded-md border border-border" loading="lazy" /></a>}
          <p className="text-sm whitespace-pre-wrap line-clamp-6">{g.result}</p>
        </div>
      ))}
      {!rows.length && <Empty text={loading ? "Chargement…" : "Aucune génération pour le moment."} />}
      {total > PAGE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">{page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} sur {total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total || loading} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </Shell>
  )
}
