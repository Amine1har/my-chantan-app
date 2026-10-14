import { useState } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "@/lib/chantan-db"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/kit"
import { inputCls } from "@/lib/crm"
import { MotionItem, MotionReveal } from "@/components/MotionReveal"

const Index = () => {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!loading && session) return <Navigate to="/tableau-de-bord" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError("Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.")
    } catch {
      setError("Connexion impossible pour le moment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MotionReveal delay={0} className="px-6 md:px-12 pt-10 md:pt-14">
        <MotionItem><h1 className="font-bold tracking-tighter leading-[0.9] text-[clamp(3.5rem,14vw,12rem)]">Cloud Brand<span className="text-accent">.</span></h1></MotionItem>
        <MotionItem className="mt-4 flex flex-wrap justify-between gap-2 border-t border-foreground pt-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span>CRM interne</span><span>Commandes · Stock · Comptabilité · Meta Ads · WhatsApp</span>
        </MotionItem>
      </MotionReveal>
      <MotionReveal delay={0.15} className="px-6 md:px-12 py-12 grid md:grid-cols-12 gap-10 flex-1">
        <MotionItem className="md:col-span-6"><p className="text-xl md:text-2xl leading-snug max-w-xl">
          Confirmez, expédiez, encaissez. Tout le suivi de la boutique au même endroit, du premier appel de confirmation jusqu’au bénéfice net.
        </p></MotionItem>
        <MotionItem className="md:col-span-4 md:col-start-9"><form onSubmit={submit} className="space-y-4">
          <Field label="E-mail"><input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Mot de passe"><input className={inputCls} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Connexion…" : "Se connecter"}</Button>
        </form></MotionItem>
      </MotionReveal>
    </div>
  )
}

export default Index
