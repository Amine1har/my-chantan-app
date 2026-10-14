import { useMemo, useState } from "react"
import { MessageCircle } from "lucide-react"
import { toast } from "sonner"
import Shell from "@/components/Shell"
import { Field, PageHead } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/chantan-db"
import { Customer, Order, Promo, dateFr, inputCls, matchQ, phoneKey, useRows, waLink } from "@/lib/crm"

const AUDIENCES = [
  { k: "tous", l: "Tous les clients" },
  { k: "livres", l: "Clients déjà livrés" },
  { k: "inactifs", l: "Inactifs depuis 60 jours" },
]

export default function Marketing() {
  const c = useRows<Customer>("customers")
  const o = useRows<Order>("orders")
  const pr = useRows<Promo>("promo_campaigns")
  const [f, setF] = useState({ name: "", audience: "tous", message: "Bonjour {prenom} ! Cloud Brand vous offre -15 % sur votre prochaine commande avec le code CLOUD15. Valable cette semaine." })
  const [active, setActive] = useState<Promo | null>(null)
  const [q, setQ] = useState("")
  const [qc, setQc] = useState("")

  const audience = (k: string) =>
    c.rows.filter((x) => {
      if (!phoneKey(x.phone)) return false
      const mine = o.rows.filter((r) => phoneKey(r.phone) === phoneKey(x.phone))
      if (k === "livres") return mine.some((r) => r.status === "livree")
      if (k === "inactifs") return !mine.some((r) => Date.now() - new Date(r.created_at).getTime() < 60 * 86400000)
      return true
    })
  const targets = useMemo(() => (active ? audience(active.audience) : []), [active, c.rows, o.rows])
  const count = audience(f.audience).length

  const create = async () => {
    if (!f.name || !f.message) return toast.error("Nom et message requis")
    const { error } = await supabase.from("promo_campaigns").insert(f)
    if (error) return toast.error(error.message)
    setF({ ...f, name: "" })
    pr.reload()
  }
  const sent = async (cu: Customer) => {
    if (!active) return
    window.open(waLink(cu.phone, active.message.replace("{prenom}", cu.name.split(" ")[0])), "_blank")
    await supabase.from("promo_campaigns").update({ sent_count: active.sent_count + 1 }).eq("id", active.id)
    setActive({ ...active, sent_count: active.sent_count + 1 })
    pr.reload()
  }

  return (
    <Shell>
      <PageHead title="Marketing WhatsApp" sub="Relancez vos anciens clients avec une offre. Chaque envoi s’ouvre dans WhatsApp, un clic par client." />
      <div className="grid md:grid-cols-12 gap-10">
        <section className="md:col-span-5 space-y-3">
          <h2 className="text-lg font-semibold">Nouvelle campagne</h2>
          <Field label="Nom"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Promo rentrée" /></Field>
          <Field label="Audience">
            <select className={inputCls} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>{AUDIENCES.map((a) => <option key={a.k} value={a.k}>{a.l}</option>)}</select>
          </Field>
          <Field label="Message ({prenom} sera remplacé)">
            <textarea className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-28" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          </Field>
          <p className="text-xs text-muted-foreground">{count} client(s) dans cette audience.</p>
          <Button onClick={create}>Créer la campagne</Button>
        </section>
        <section className="md:col-span-7">
          <h2 className="text-lg font-semibold mb-3">Campagnes</h2>
          <input className={inputCls + " mb-2"} placeholder="Rechercher une campagne…" value={q} onChange={(e) => setQ(e.target.value)} />
          {pr.rows.filter((x) => matchQ(q, x.name, x.message, AUDIENCES.find((a) => a.k === x.audience)?.l, dateFr(x.created_at))).map((x) => (
            <button key={x.id} onClick={() => setActive(x)} className={`w-full text-left border-t border-border py-3 text-sm flex justify-between hover:text-accent transition-colors ${active?.id === x.id ? "text-accent" : ""}`}>
              <span><span className="font-medium">{x.name}</span> <span className="text-muted-foreground">· {AUDIENCES.find((a) => a.k === x.audience)?.l} · {dateFr(x.created_at)}</span></span>
              <span>{x.sent_count} envoyé(s)</span>
            </button>
          ))}
          {!pr.rows.length && <p className="text-sm text-muted-foreground border-t border-border pt-3">Aucune campagne créée.</p>}
          {active && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Envoyer « {active.name} »</h3>
              <input className={inputCls + " mb-2"} placeholder="Rechercher un client : nom, téléphone, ville…" value={qc} onChange={(e) => setQc(e.target.value)} />
              <div className="max-h-80 overflow-y-auto">
                {targets.filter((cu) => matchQ(qc, cu.name, cu.phone, cu.phone?.replace(/\D/g, "").slice(-9), cu.city)).map((cu) => (
                  <div key={cu.id} className="flex items-center justify-between border-t border-border py-2 text-sm">
                    <span>{cu.name} <span className="text-muted-foreground">{cu.phone}</span></span>
                    <button className="flex items-center gap-1 text-success" onClick={() => sent(cu)}><MessageCircle className="h-4 w-4" /> Envoyer</button>
                  </div>
                ))}
                {!targets.length && <p className="text-sm text-muted-foreground">Aucun client dans cette audience.</p>}
              </div>
            </div>
          )}
        </section>
      </div>
      <section className="mt-14 border-t border-border pt-4">
        <h2 className="text-lg font-semibold mb-2">Bientôt disponible</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Instagram</strong><br />Publication et suivi des messages directs.</p>
          <p><strong className="text-foreground">TikTok</strong><br />Connexion du compte et suivi des performances.</p>
          <p><strong className="text-foreground">Studio vidéo</strong><br />Préparer et programmer vos vidéos.</p>
        </div>
      </section>
    </Shell>
  )
}
