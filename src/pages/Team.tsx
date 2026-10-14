import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import Shell from "@/components/Shell"
import { Empty, Field, Modal, PageHead } from "@/components/kit"
import { supabase } from "@/lib/chantan-db"
import { inputCls } from "@/lib/crm"
import { Member, PAGES, ROLES } from "@/lib/perms"

type Form = { id?: string; name: string; email: string; password: string; role: string; permissions: string[]; active: boolean }
const blank: Form = { name: "", email: "", password: "", role: "confirmation", permissions: ROLES[0].perms, active: true }

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("team-admin", { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export default function Team() {
  const [rows, setRows] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setRows((await call({ action: "list" })).members || []) } catch (e) { toast.error("Chargement impossible : " + (e as Error).message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const pickRole = (k: string) => setF((x) => x && { ...x, role: k, permissions: k === "personnalise" ? x.permissions : ROLES.find((r) => r.k === k)!.perms })
  const toggle = (k: string) => setF((x) => x && { ...x, role: "personnalise", permissions: x.permissions.includes(k) ? x.permissions.filter((p) => p !== k) : [...x.permissions, k] })

  const save = async () => {
    if (!f) return
    setBusy(true)
    try {
      if (f.id) await call({ action: "update", id: f.id, name: f.name, role: f.role, permissions: f.permissions, active: f.active, password: f.password || undefined })
      else await call({ action: "create", name: f.name, email: f.email, password: f.password, role: f.role, permissions: f.permissions })
      toast.success(f.id ? "Membre mis à jour" : "Compte créé")
      setF(null); load()
    } catch (e) { toast.error((e as Error).message) }
    setBusy(false)
  }
  const del = async (m: Member) => {
    if (!window.confirm(`Supprimer le compte de ${m.name || m.email} ?`)) return
    try { await call({ action: "delete", id: m.id }); toast.success("Compte supprimé"); load() } catch (e) { toast.error((e as Error).message) }
  }
  const roleLabel = (k: string) => ROLES.find((r) => r.k === k)?.l || k

  return (
    <Shell>
      <PageHead title="Équipe & accès" sub="Créez des comptes pour votre équipe et choisissez les pages auxquelles chaque membre a accès."
        actions={<button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-2" onClick={() => setF({ ...blank })}><Plus className="h-4 w-4" /> Nouveau membre</button>} />
      <div className="text-sm">
        {rows.map((m) => (
          <div key={m.id} className="border-t border-border py-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="font-medium">{m.name || m.email} {!m.active && <span className="text-xs text-destructive ml-2">Désactivé</span>}</div>
              <div className="text-xs text-muted-foreground">{m.email} · {roleLabel(m.role)}</div>
              <div className="text-xs text-muted-foreground mt-1">{m.permissions.map((p) => PAGES.find((x) => x.k === p)?.l || p).join(", ") || "Aucun accès"}</div>
            </div>
            <div className="flex gap-3 text-xs">
              <button className="underline" onClick={() => setF({ id: m.id, name: m.name, email: m.email, password: "", role: m.role, permissions: m.permissions, active: m.active })}>Modifier</button>
              <button className="underline text-destructive" onClick={() => del(m)}>Supprimer</button>
            </div>
          </div>
        ))}
        {!rows.length && <Empty text={loading ? "Chargement…" : "Aucun membre. Cliquez sur « Nouveau membre » pour créer un compte."} />}
      </div>
      {f && (
        <Modal title={f.id ? "Modifier le membre" : "Nouveau membre"} onClose={() => setF(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="E-mail (identifiant)"><input className={inputCls} type="email" disabled={!!f.id} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            </div>
            <Field label={f.id ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe (6 caractères min.)"}>
              <input className={inputCls} type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
            <Field label="Modèle d'accès">
              <select className={inputCls} value={f.role} onChange={(e) => pickRole(e.target.value)}>{ROLES.map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}</select>
            </Field>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Pages autorisées</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {PAGES.map((p) => <label key={p.k} className="flex items-center gap-2"><input type="checkbox" checked={f.permissions.includes(p.k)} onChange={() => toggle(p.k)} /> {p.l}</label>)}
              </div>
            </div>
            {f.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Compte actif</label>}
            <button disabled={busy} onClick={save} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </Modal>
      )}
    </Shell>
  )
}
