import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Download, ImagePlus, Pencil, Play, Plus, Trash2, X, Copy as Dup } from "lucide-react"
import { blobToDataUrl, uploadStudioImage, urlToDataUrl } from "@/lib/studioImg"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Empty, Field, Modal, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { chantanAI } from "@/lib/chantan-ai"
import { Product, inputCls, money, useRows } from "@/lib/crm"

export type Var = { key: string; label: string; type: "text" | "long" | "choice" | "number" | "product"; options?: string; default?: string }
export type Tpl = {
  id: string; name: string; category: string; description: string | null; system_prompt: string | null; prompt: string
  variables: Var[]; model: string | null; temperature: number | null; max_tokens: number | null; provider: string; created_at: string
  image_url?: string | null; mode?: string | null
}
const GEM_TEXT = [{ k: "", l: "Gemini 3.8 Flash (par défaut)" }]
const GEM_IMG = [
  { k: "", l: "Nano Banana 2 · gemini-3.1-flash-image (par défaut)" },
  { k: "gemini-nano-banana-2.1", l: "Nano Banana 2.1 (meilleure qualité, texte dans l’image)" },
  { k: "gemini-3.1-flash-lite-image", l: "Nano Banana 2 Lite (économique)" },
]
// Lit le vrai message d'erreur d'une fonction serveur
async function callStudioAI(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("studio-ai", { body })
  if (error) {
    let msg = error.message
    try { const j = await (error as unknown as { context: Response }).context.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data as { text: string; image: string | null; used: number; limit: number }
}

function Quota() {
  const [u, setU] = useState<{ used: number; limit: number; hasKey: boolean } | null>(null)
  const [lim, setLim] = useState("")
  const load = useCallback(async () => {
    try { const d = await callStudioAI({ action: "usage" }) as unknown as { used: number; limit: number; hasKey: boolean }; setU(d); setLim(String(d.limit)) } catch { setU(null) }
  }, [])
  useEffect(() => { load() }, [load])
  const save = async () => {
    try { await callStudioAI({ action: "set_limit", limit: Number(lim) }); toast.success("Quota enregistré"); load() } catch (e) { toast.error((e as Error).message) }
  }
  if (!u) return null
  const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0
  return (
    <div className="mb-5 rounded-md border border-border p-3 flex flex-wrap items-center gap-4 text-sm">
      <div className="min-w-48">
        <div className="font-medium">Google AI Studio (Gemini)</div>
        <div className="text-xs text-muted-foreground">{u.hasKey ? `${u.used} / ${u.limit || "∞"} requêtes aujourd’hui` : "Clé API non enregistrée"}</div>
        {u.limit > 0 && <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${pct >= 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground">Quota par jour (0 = illimité)</span>
        <input type="number" min={0} className={inputCls + " w-24"} value={lim} onChange={(e) => setLim(e.target.value)} />
        <Button size="sm" variant="outline" onClick={save}>Enregistrer</Button>
      </div>
    </div>
  )
}
const CATS = ["Meta Ads", "WhatsApp", "Produit", "Idées de contenu", "Autre"]
const MODELS = [
  { k: "", l: "Modèle par défaut (rapide, économique)" },
  { k: "google/gemini-2.5-flash", l: "Gemini Flash (rapide)" },
  { k: "anthropic/claude-sonnet-4.5", l: "Claude Sonnet (plus puissant)" },
]
const TYPES = [{ k: "text", l: "Texte court" }, { k: "long", l: "Texte long" }, { k: "choice", l: "Liste de choix" }, { k: "number", l: "Nombre" }, { k: "product", l: "Produit du stock" }]

const varsIn = (s: string) => [...new Set([...s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))]
const fill = (s: string, vals: Record<string, string>) => s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vals[k] ?? "")

export default function StudioTemplates() {
  const [rows, setRows] = useState<Tpl[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState("all")
  const [q, setQ] = useState("")
  const [edit, setEdit] = useState<Partial<Tpl> | null>(null)
  const [run, setRun] = useState<Tpl | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("studio_templates").select("*").order("created_at", { ascending: false })
    if (error) toast.error("Chargement impossible : " + error.message)
    setRows((data as Tpl[]) || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const list = rows.filter((t) => (cat === "all" || t.category === cat) && (!q || (t.name + " " + t.prompt).toLowerCase().includes(q.toLowerCase())))
  const remove = async (t: Tpl) => {
    if (!window.confirm(`Supprimer le template « ${t.name} » ?`)) return
    const { error } = await supabase.from("studio_templates").delete().eq("id", t.id)
    if (error) return toast.error(error.message)
    toast.success("Template supprimé"); load()
  }
  const dup = async (t: Tpl) => {
    const { id, created_at, ...rest } = t
    const { error } = await supabase.from("studio_templates").insert({ ...rest, name: t.name + " (copie)" })
    if (error) return toast.error(error.message)
    toast.success("Template dupliqué"); load()
  }

  return (
    <Shell>
      <PageHead title="Templates" sub="CLAWS Studio : créez vos templates avec vos propres prompts et paramètres, puis exécutez-les." actions={<Button onClick={() => setEdit({ category: "Produit", provider: "gemini", mode: "text", temperature: 0.7, max_tokens: 1000, variables: [], prompt: "" })}><Plus className="h-4 w-4 mr-1" /> Nouveau template</Button>} />
      <Quota />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input className={inputCls + " max-w-xs"} placeholder="Rechercher un template…" value={q} onChange={(e) => setQ(e.target.value)} />
        {["all", ...CATS].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1 rounded-full text-xs border ${cat === c ? "bg-primary text-primary-foreground" : "border-border"}`}>{c === "all" ? "Tous" : c}</button>
        ))}
      </div>
      {list.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
          <div className="min-w-0 flex items-center gap-3">
            {t.image_url && <img src={t.image_url} alt="" className="h-12 w-12 rounded-md object-cover border border-border" />}
            <div className="min-w-0">
            <div className="font-medium">{t.name} <span className="ml-2 text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">{t.category}</span></div>
            <div className="text-xs text-muted-foreground truncate max-w-xl">{t.description || t.prompt.slice(0, 120)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{varsIn(t.prompt).length} paramètre(s) · {t.provider === "gemini" ? (t.mode === "image" ? "Gemini · image" : "Gemini · texte") : MODELS.find((m) => m.k === (t.model || ""))?.l.split(" (")[0] || t.model}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => setRun(t)}><Play className="h-3.5 w-3.5 mr-1" /> Utiliser</Button>
            <Button size="sm" variant="outline" aria-label="Modifier" onClick={() => setEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" aria-label="Dupliquer" onClick={() => dup(t)}><Dup className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" aria-label="Supprimer" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
      {!list.length && <Empty text={loading ? "Chargement…" : "Aucun template. Cliquez sur « Nouveau template » pour écrire votre premier prompt."} />}
      {edit && <Editor t={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load() }} />}
      {run && <Runner t={run} onClose={() => setRun(null)} />}
    </Shell>
  )
}

function Editor({ t, onClose, onDone }: { t: Partial<Tpl>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: t.name || "", category: t.category || "Autre", description: t.description || "", system_prompt: t.system_prompt || "", prompt: t.prompt || "", model: t.model || "", temperature: t.temperature ?? 0.7, max_tokens: t.max_tokens ?? 1000, provider: t.provider || "chantan", mode: t.mode || "text", image_url: t.image_url || "" })
  const pickImg = async (file?: File) => {
    if (!file) return
    try { const u = await uploadStudioImage(await (await fetch(await blobToDataUrl(file, 1600))).blob(), "templates"); setF((x) => ({ ...x, image_url: u })) } catch (e) { toast.error("Import impossible : " + (e as Error).message) }
  }
  const [vars, setVars] = useState<Var[]>(t.variables || [])
  const [busy, setBusy] = useState(false)
  const detected = useMemo(() => varsIn(f.system_prompt + " " + f.prompt), [f.system_prompt, f.prompt])
  useEffect(() => {
    setVars((vs) => {
      const keep = vs.filter((v) => detected.includes(v.key))
      const add = detected.filter((k) => !keep.some((v) => v.key === k)).map((k) => ({ key: k, label: k.replace(/_/g, " "), type: "text" as const }))
      return add.length || keep.length !== vs.length ? [...keep, ...add] : vs
    })
  }, [detected])
  const updVar = (i: number, p: Partial<Var>) => setVars((vs) => vs.map((v, j) => (j === i ? { ...v, ...p } : v)))
  const save = async () => {
    if (!f.name.trim() || !f.prompt.trim()) return toast.error("Nom et prompt requis")
    setBusy(true)
    const body = { ...f, model: f.model || null, image_url: f.image_url || null, mode: f.provider === "gemini" ? f.mode : "text", variables: vars, updated_at: new Date().toISOString() }
    const { error } = t.id ? await supabase.from("studio_templates").update(body).eq("id", t.id) : await supabase.from("studio_templates").insert(body)
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success("Template enregistré"); onDone()
  }
  return (
    <Modal title={t.id ? "Modifier le template" : "Nouveau template"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom du template"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Catégorie"><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <div className="col-span-2"><Field label="Image de référence (optionnel)">
          {f.image_url ? (
            <div className="relative inline-block"><img src={f.image_url} alt="" className="h-28 rounded-md border border-border" /><button type="button" aria-label="Retirer" className="absolute -top-2 -right-2 rounded-full bg-background border border-border p-1" onClick={() => setF({ ...f, image_url: "" })}><X className="h-3 w-3" /></button></div>
          ) : (
            <label className="flex items-center gap-2 h-20 justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:bg-muted/40"><ImagePlus className="h-4 w-4" /> Importer une image<input type="file" accept="image/*" className="hidden" onChange={(e) => { pickImg(e.target.files?.[0]); e.target.value = "" }} /></label>
          )}
        </Field></div>
        <div className="col-span-2"><Field label="Description (optionnel)"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
        <div className="col-span-2"><Field label="Instructions système (optionnel)"><textarea className={inputCls + " h-20 py-2"} value={f.system_prompt} onChange={(e) => setF({ ...f, system_prompt: e.target.value })} placeholder="Ex : Tu es le community manager de CLAWS Brand…" /></Field></div>
        <div className="col-span-2"><Field label="Prompt — utilisez {{variable}} pour créer un paramètre"><textarea className={inputCls + " h-40 py-2 font-mono"} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} placeholder="Écris une légende Instagram pour {{produit}} avec un ton {{ton}}." /></Field></div>
      </div>
      {vars.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Paramètres détectés</div>
          {vars.map((v, i) => (
            <div key={v.key} className="grid grid-cols-12 gap-2 items-center">
              <code className="col-span-3 text-xs truncate">{`{{${v.key}}}`}</code>
              <input className={inputCls + " col-span-3"} value={v.label} onChange={(e) => updVar(i, { label: e.target.value })} aria-label="Libellé" />
              <select className={inputCls + " col-span-3"} value={v.type} onChange={(e) => updVar(i, { type: e.target.value as Var["type"] })}>{TYPES.map((x) => <option key={x.k} value={x.k}>{x.l}</option>)}</select>
              {v.type === "choice" ? <input className={inputCls + " col-span-3"} placeholder="Choix séparés par des virgules" value={v.options || ""} onChange={(e) => updVar(i, { options: e.target.value })} /> : v.type !== "product" ? <input className={inputCls + " col-span-3"} placeholder="Valeur par défaut" value={v.default || ""} onChange={(e) => updVar(i, { default: e.target.value })} /> : <span className="col-span-3 text-xs text-muted-foreground">Nom, prix et mots-clés repris du stock</span>}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="IA qui exécute le template"><select className={inputCls} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value, model: "", mode: e.target.value === "gemini" ? f.mode : "text" })}><option value="gemini">Google AI Studio (Gemini)</option><option value="chantan">IA intégrée Chantan</option><option value="copie">Copier le prompt seulement</option></select></Field>
        {f.provider === "gemini" && <Field label="Ce que le template génère"><select className={inputCls} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value, model: "" })}><option value="text">Du texte</option><option value="image">Une image</option></select></Field>}
        <Field label="Modèle"><select className={inputCls} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })}>{(f.provider === "gemini" ? (f.mode === "image" ? GEM_IMG : GEM_TEXT) : MODELS).map((m) => <option key={m.k} value={m.k}>{m.l}</option>)}</select></Field>
        <Field label={`Créativité (${f.temperature})`}><input type="range" min={0} max={1} step={0.1} className="w-full" value={f.temperature} onChange={(e) => setF({ ...f, temperature: Number(e.target.value) })} /></Field>
        <Field label="Longueur max. (tokens)"><input type="number" className={inputCls} value={f.max_tokens} onChange={(e) => setF({ ...f, max_tokens: Number(e.target.value) || 1000 })} /></Field>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Gemini utilise votre clé Google AI Studio, avec le quota journalier réglé en haut de la page.</p>
      <Button className="mt-5 w-full" disabled={busy} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer le template"}</Button>
    </Modal>
  )
}

function Runner({ t, onClose }: { t: Tpl; onClose: () => void }) {
  const products = useRows<Product>("products", "name", true)
  const keys = varsIn(t.system_prompt + " " + t.prompt)
  const defs = keys.map((k) => t.variables.find((v) => v.key === k) || { key: k, label: k, type: "text" as const })
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(defs.map((d) => [d.key, d.default || (d.type === "choice" ? (d.options || "").split(",")[0]?.trim() || "" : "")])))
  const [result, setResult] = useState("")
  const [busy, setBusy] = useState(false)
  const [genId, setGenId] = useState<string | null>(null)
  const [userImg, setUserImg] = useState<string | null>(null)
  const [resultImg, setResultImg] = useState<string | null>(null)
  const isGem = t.provider === "gemini"
  const resolved = useMemo(() => {
    const out: Record<string, string> = {}
    for (const d of defs) {
      if (d.type === "product") {
        const p = products.rows.find((x) => x.id === vals[d.key])
        out[d.key] = p ? `${p.name} (prix : ${money(p.price)}${p.keywords ? `, mots-clés : ${p.keywords}` : ""})` : ""
      } else out[d.key] = vals[d.key] || ""
    }
    return out
  }, [vals, products.rows])
  const finalPrompt = fill(t.prompt, resolved)
  const finalSystem = t.system_prompt ? fill(t.system_prompt, resolved) : ""

  const save = async (text: string, image_url: string | null = null) => {
    const { data } = await supabase.from("studio_generations").insert({ template_id: t.id, template_name: t.name, category: t.category, inputs: resolved, prompt: finalPrompt, result: text, image_url, model: t.model || (isGem ? (t.mode === "image" ? "gemini-image" : "gemini-flash") : "défaut") }).select("id").maybeSingle()
    setGenId((data as { id: string } | null)?.id || null)
  }
  const generate = async () => {
    setBusy(true); setGenId(null); setResultImg(null)
    try {
      if (isGem) {
        const image = userImg || (t.image_url ? await urlToDataUrl(t.image_url) : undefined)
        const r = await callStudioAI({ action: "generate", mode: t.mode || "text", model: t.model || undefined, system: finalSystem, prompt: finalPrompt, temperature: Number(t.temperature ?? 0.7), max_tokens: t.max_tokens || 1000, image })
        setResult(r.text || "")
        let url: string | null = null
        if (r.image) { setResultImg(r.image); try { url = await uploadStudioImage(r.image, "generations") } catch { toast.error("Image générée mais non archivée dans l’historique") } }
        await save(r.text || "", url)
        return
      }
      const messages = [...(finalSystem ? [{ role: "system" as const, content: finalSystem }] : []), { role: "user" as const, content: finalPrompt }]
      const r = await chantanAI.chat({ messages, ...(t.model ? { model: t.model } : {}), temperature: Number(t.temperature ?? 0.7), max_tokens: t.max_tokens || 1000 })
      setResult(r.text)
      await save(r.text)
    } catch (e) {
      toast.error((e as Error).message?.toLowerCase().includes("credit") ? "Crédits IA insuffisants" : (isGem ? "" : "Génération impossible : ") + (e as Error).message)
    } finally { setBusy(false) }
  }
  const copy = (s: string, m: string) => navigator.clipboard.writeText(s).then(() => toast.success(m))
  const fav = async () => {
    if (!genId) return
    await supabase.from("studio_generations").update({ favorite: true }).eq("id", genId)
    toast.success("Ajouté aux favoris")
  }
  return (
    <Modal title={t.name} onClose={onClose} wide>
      <div className="space-y-3">
        {defs.map((d) => (
          <Field key={d.key} label={d.label}>
            {d.type === "long" ? <textarea className={inputCls + " h-24 py-2"} value={vals[d.key] || ""} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })} />
              : d.type === "choice" ? <select className={inputCls} value={vals[d.key] || ""} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })}>{(d.options || "").split(",").map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}</select>
              : d.type === "product" ? <select className={inputCls} value={vals[d.key] || ""} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })}><option value="">Choisir un produit…</option>{products.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              : <input className={inputCls} type={d.type === "number" ? "number" : "text"} value={vals[d.key] || ""} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })} />}
          </Field>
        ))}
        {!defs.length && <p className="text-sm text-muted-foreground">Ce template n’a aucun paramètre.</p>}
        {isGem && (
          <Field label={t.image_url ? "Image à envoyer (remplace l’image du template)" : "Image à envoyer (optionnel)"}>
            {userImg || t.image_url ? (
              <div className="flex items-center gap-3"><img src={userImg || t.image_url || ""} alt="" className="h-20 rounded-md border border-border" />{userImg && <Button size="sm" variant="outline" onClick={() => setUserImg(null)}>Retirer</Button>}</div>
            ) : null}
            <label className="mt-2 inline-flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground"><ImagePlus className="h-4 w-4" /> Importer une image<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setUserImg(await blobToDataUrl(f)) } catch (er) { toast.error((er as Error).message) } } }} /></label>
          </Field>
        )}
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{finalPrompt}</div>
      <div className="flex gap-2 mt-3">
        {t.provider !== "copie" && <Button className="flex-1" disabled={busy} onClick={generate}>{busy ? "Génération…" : result ? "Régénérer" : "Générer"}</Button>}
        <Button variant="outline" className={t.provider === "copie" ? "flex-1" : ""} onClick={() => copy((finalSystem ? finalSystem + "\n\n" : "") + finalPrompt, "Prompt copié")}><Copy className="h-4 w-4 mr-1" /> Copier le prompt rempli</Button>
      </div>
      {(result || resultImg) && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Résultat</div>
          {resultImg && <img src={resultImg} alt="Image générée" className="w-full max-h-96 object-contain rounded-md border border-border" />}
          {result && <div className="rounded-md border border-border p-3 text-sm whitespace-pre-wrap max-h-72 overflow-y-auto">{result}</div>}
          <div className="flex gap-2">
            {result && <Button size="sm" variant="outline" onClick={() => copy(result, "Résultat copié")}>Copier</Button>}
            {resultImg && <a href={resultImg} download="claws-studio.png"><Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> Télécharger</Button></a>}
            <Button size="sm" variant="outline" disabled={!genId} onClick={fav}>Mettre en favori</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
