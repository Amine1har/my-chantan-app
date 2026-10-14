import { useState } from "react"
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import SortSelect, { sortList } from "@/components/SortSelect"
import { Empty, Field, Modal, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { NEVADA_SCRIPT } from "@/lib/nevadaScript"
import { Carrier, dateFr, inputCls, matchQ, useRows } from "@/lib/crm"

const TYPES = [
  { k: "manuel", l: "Manuel (sans suivi automatique)" },
  { k: "google_sheet", l: "Google Sheet (suivi livreur)" },
  { k: "api", l: "API du transporteur" },
  { k: "livcash", l: "Livcash (API intégrée)" },
  { k: "nevada", l: "Google Sheet bidirectionnel (Nivada)" },
]
const LIVCASH_URL = "https://app.livcash.com/clients/api-parcels"
const SORTS = [
  { k: "name_asc", l: "Nom : A → Z" },
  { k: "name_desc", l: "Nom : Z → A" },
  { k: "created_desc", l: "Ajoutés récemment" },
  { k: "created_asc", l: "Ajoutés en premier" },
  { k: "sync_desc", l: "Dernière synchro : récente" },
  { k: "sync_asc", l: "Dernière synchro : ancienne" },
  { k: "active_desc", l: "Actifs d’abord" },
  { k: "type_asc", l: "Type de suivi" },
]
const carGet = (k: string) => (x: Carrier): unknown =>
  k.startsWith("name") ? x.name : k.startsWith("created") ? x.created_at : k.startsWith("sync") ? x.last_sync : k.startsWith("active") ? (x.active ? 1 : 0) : x.type
const empty = { name: "", type: "google_sheet", api_url: "", api_key_header: "", api_key: "", status_path: "status", cities: "", delivery_fees: "", delivery_statuses: "", sheet_url: "", tracking_col: "Tracking", status_col: "Statut", active: true }

export default function Carriers() {
  const c = useRows<Carrier>("carriers", "created_at", true)
  const [edit, setEdit] = useState<(Partial<Carrier> & typeof empty) | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState("")
  const [sort, setSort] = useState("name_asc")

  const sync = async (id?: string, push = false) => {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke("carrier-sync", { body: { carrier_id: id, push } })
    setBusy(false)
    if (error || data?.error) return toast.error(error?.message || data.error)
    if (data.errors?.length) toast.error(data.errors.join(" | "))
    toast.success(push ? `${data.pushed} colis envoyé(s) à Livcash` : `${data.updated} commande(s) mise(s) à jour`)
    c.reload()
  }
  const save = async () => {
    if (!edit?.name) return toast.error("Nom requis")
    const { id, created_at, last_sync, ...rest } = edit as Record<string, unknown>
    if (rest.type === "livcash") { rest.api_url = LIVCASH_URL; if (!rest.api_key) return toast.error("Clé API requise") }
    const { error } = id ? await supabase.from("carriers").update(rest).eq("id", id as string) : await supabase.from("carriers").insert(rest)
    if (error) return toast.error(error.message)
    toast.success("Transporteur enregistré"); setEdit(null); c.reload()
  }
  const del = async (x: Carrier) => {
    const { error } = await supabase.from("carriers").delete().eq("id", x.id)
    if (error) return toast.error(error.message)
    c.reload()
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEdit({ ...edit!, [k]: e.target.value })

  return (
    <Shell>
      <PageHead
        title="Transporteurs"
        sub="Ajoutez vos sociétés de livraison, reliez leur API ou un Google Sheet de suivi."
        actions={<>
          <Button variant="outline" disabled={busy} onClick={() => sync()}><RefreshCw className="h-4 w-4 mr-1" /> Synchroniser le suivi</Button>
          <Button onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Nouveau transporteur</Button>
        </>}
      />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className={inputCls + " max-w-sm"} placeholder="Rechercher un transporteur…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SortSelect value={sort} onChange={setSort} options={SORTS} />
      </div>
      {sortList(c.rows, carGet(sort), sort.endsWith("_asc")).filter((x) => matchQ(q, x.name, TYPES.find((t) => t.k === x.type)?.l, x.sheet_url, x.api_url, x.active ? "actif" : "inactif")).map((x) => (
        <div key={x.id} className="border-t border-border py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <button className="text-left hover:text-accent" onClick={() => setEdit({ ...empty, ...x } as never)}>
            <div className="font-medium">{x.name} {!x.active && <span className="text-xs text-muted-foreground">(inactif)</span>}</div>
            <div className="text-xs text-muted-foreground">{TYPES.find((t) => t.k === x.type)?.l}{x.last_sync ? ` · dernière synchro ${dateFr(x.last_sync)}` : ""}</div>
          </button>
          <div className="flex gap-2">
            {x.type === "nevada" && <Button size="sm" variant="outline" disabled={busy} onClick={() => sync(x.id, true)}>Envoyer vers le Sheet</Button>}
            {x.type === "livcash" && <Button size="sm" variant="outline" disabled={busy} onClick={() => sync(x.id, true)}>Envoyer les commandes confirmées</Button>}
            {x.type !== "manuel" && <Button size="sm" variant="outline" disabled={busy} onClick={() => sync(x.id)}>Synchroniser le suivi</Button>}
            <Button size="sm" variant="ghost" onClick={() => del(x)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
      {!c.rows.length && <Empty text="Aucun transporteur. Ajoutez-en un." />}

      {edit && (
        <Modal title={edit.id ? "Modifier le transporteur" : "Nouveau transporteur"} onClose={() => setEdit(null)} wide>
          <div className="space-y-3">
            <Field label="Nom"><input className={inputCls} value={edit.name} onChange={set("name")} /></Field>
            <Field label="Type de suivi">
              <select className={inputCls} value={edit.type} onChange={set("type")}>{TYPES.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}</select>
            </Field>
            {edit.type === "google_sheet" && <>
              <Field label="Lien du Google Sheet (partagé « tous ceux qui ont le lien »)"><input className={inputCls} value={edit.sheet_url || ""} onChange={set("sheet_url")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Colonne du n° de suivi"><input className={inputCls} value={edit.tracking_col || ""} onChange={set("tracking_col")} /></Field>
                <Field label="Colonne du statut"><input className={inputCls} value={edit.status_col || ""} onChange={set("status_col")} /></Field>
              </div>
            </>}
            {edit.type === "nevada" && <>
              <Field label="URL de l’application web Google (Apps Script)"><input className={inputCls} placeholder="https://script.google.com/macros/s/.../exec" value={edit.sheet_url || ""} onChange={set("sheet_url")} /></Field>
              <Field label="Clé secrète (la même que dans le script)"><input className={inputCls} type="password" value={edit.api_key || ""} onChange={set("api_key")} /></Field>
              <div className="rounded-md border border-border p-3 text-xs space-y-2">
                <p className="font-medium">Installation (une seule fois)</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                  <li>Ouvrez le Google Sheet Nivada → Extensions → Apps Script.</li>
                  <li>Collez le script ci-dessous, remplacez la clé secrète par la vôtre.</li>
                  <li>Déployer → Nouveau déploiement → Application Web → Exécuter en tant que « Moi », accès « Tout le monde ».</li>
                  <li>Copiez l’URL de l’application web ici, et la même clé secrète.</li>
                </ol>
                <textarea readOnly className={inputCls + " h-40 py-2 font-mono"} value={NEVADA_SCRIPT} onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(NEVADA_SCRIPT); toast.success("Script copié") }}>Copier le script</Button>
                <p className="text-muted-foreground">Les commandes de Casablanca et environs sont envoyées avec leur ID. L’équipe remplit la colonne « Statut livraison » (ex. Livré, Non livré) ; « Synchroniser le suivi » la récupère.</p>
              </div>
            </>}
            {edit.type === "livcash" && <>
              <Field label="URL de l’API (déjà configurée)"><input className={inputCls} readOnly value={LIVCASH_URL} /></Field>
              <Field label="Clé API Livcash"><input className={inputCls} type="password" value={edit.api_key || ""} onChange={set("api_key")} /></Field>
            </>}
            {edit.type === "api" && <>
              <Field label="URL de l’API (utilisez {tracking} pour le n° de suivi)"><input className={inputCls} placeholder="https://api.transporteur.com/track/{tracking}" value={edit.api_url || ""} onChange={set("api_url")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="En-tête de clé (ex. Authorization)"><input className={inputCls} value={edit.api_key_header || ""} onChange={set("api_key_header")} /></Field>
                <Field label="Clé API (ex. Bearer xxx)"><input className={inputCls} type="password" value={edit.api_key || ""} onChange={set("api_key")} /></Field>
              </div>
              <Field label="Champ du statut dans la réponse (ex. data.status)"><input className={inputCls} value={edit.status_path || ""} onChange={set("status_path")} /></Field>
            </>}
            <Field label="Liste des villes du transporteur (une par ligne ou séparées par des virgules, exactement comme dans son système)">
              <textarea className={inputCls + " h-32 py-2"} value={edit.cities || ""} onChange={(e) => setEdit({ ...edit, cities: e.target.value })} placeholder={"Casablanca\nRabat\nMarrakech"} />
            </Field>
            {(edit.type === "livcash" || edit.type === "nevada") && <Field label="Frais de livraison par ville (une ligne « Ville: prix » ; « Défaut: prix » pour les autres cas)">
              <textarea className={inputCls + " h-28 py-2"} value={edit.delivery_fees || ""} onChange={(e) => setEdit({ ...edit, delivery_fees: e.target.value })} placeholder={"Casablanca: 20\nRabat: 35\nDéfaut: 40"} />
              <p className="mt-1 text-xs text-muted-foreground">Le champ « Frais de livraison » des commandes se remplit automatiquement avec ces tarifs.</p>
            </Field>}
            {edit.type === "livcash" && <Field label="Statuts de livraison Livcash (un par ligne)">
              <textarea className={inputCls + " h-32 py-2"} value={edit.delivery_statuses || ""} onChange={(e) => setEdit({ ...edit, delivery_statuses: e.target.value })} placeholder={"En cours\nLivré\nRetourné"} />
              <p className="mt-1 text-xs text-muted-foreground">La liste se complète automatiquement avec les statuts renvoyés par l’API lors de la synchronisation du suivi. Vous pouvez aussi la modifier ici.</p>
            </Field>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Actif</label>
          </div>
          <Button className="mt-5 w-full" onClick={save}>Enregistrer</Button>
        </Modal>
      )}
    </Shell>
  )
}
