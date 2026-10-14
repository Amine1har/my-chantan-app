// chantan:role=admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  try {
    const b = await req.json().catch(() => ({}))
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const perms = Array.isArray(b.permissions) ? b.permissions.map(String) : []

    if (b.action === "list") {
      const { data, error } = await db.from("team_members").select("*").order("created_at", { ascending: false })
      if (error) return json({ error: error.message }, 400)
      return json({ members: data })
    }

    if (b.action === "create") {
      const email = String(b.email || "").trim().toLowerCase()
      const password = String(b.password || "")
      if (!email.includes("@")) return json({ error: "Adresse e-mail invalide" }, 400)
      if (password.length < 6) return json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, 400)
      const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
      if (error || !u?.user) return json({ error: error?.message || "Création du compte impossible" }, 400)
      const { error: e2 } = await db.from("team_members").insert({ user_id: u.user.id, email, name: String(b.name || ""), role: String(b.role || "personnalise"), permissions: perms, active: true })
      if (e2) { await db.auth.admin.deleteUser(u.user.id); return json({ error: e2.message }, 400) }
      return json({ ok: true })
    }

    const { data: row } = await db.from("team_members").select("*").eq("id", b.id).maybeSingle()
    if (!row) return json({ error: "Membre introuvable" }, 404)

    if (b.action === "update") {
      const patch: Record<string, unknown> = {}
      if (b.name !== undefined) patch.name = String(b.name)
      if (b.role !== undefined) patch.role = String(b.role)
      if (b.permissions !== undefined) patch.permissions = perms
      if (b.active !== undefined) patch.active = !!b.active
      const { error } = await db.from("team_members").update(patch).eq("id", row.id)
      if (error) return json({ error: error.message }, 400)
      const auth: Record<string, unknown> = {}
      if (b.password) { if (String(b.password).length < 6) return json({ error: "Mot de passe trop court (6 caractères min.)" }, 400); auth.password = String(b.password) }
      if (b.active !== undefined) auth.ban_duration = b.active ? "none" : "876000h"
      if (Object.keys(auth).length) {
        const { error: e3 } = await db.auth.admin.updateUserById(row.user_id, auth)
        if (e3) return json({ error: e3.message }, 400)
      }
      return json({ ok: true })
    }

    if (b.action === "delete") {
      await db.auth.admin.deleteUser(row.user_id)
      await db.from("team_members").delete().eq("id", row.id)
      return json({ ok: true })
    }
    return json({ error: "Action inconnue" }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
