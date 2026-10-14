// AUTO-GENERATED — DO NOT MODIFY
// ChanTan Database Client (BYO Supabase mode)
// Connected to: REPLACE_ME__see_README
// Data flows directly to your Supabase — Chantan never sees your rows.

import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'

const SUPABASE_URL = 'REPLACE_ME__see_README'
const SUPABASE_ANON_KEY = 'REPLACE_ME__see_README'
const PROJECT_ID = 'c87be6b2-9e72-49eb-94d1-60758230e644'
const TABLE = 'chantan_app_data'

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: typeof window !== 'undefined' ? window.localStorage : undefined },
})

interface AuthUser {
  id: string
  email: string
  display_name: string | null
  role: string
  created_at: string
  last_login: string | null
  metadata: Record<string, any>
}

interface AuthResponse {
  user: AuthUser | null
  token: string | null
  error: string | null
}

function supabaseUserToAuthUser(u: SupabaseUser | null): AuthUser | null {
  if (!u) return null
  return {
    id: u.id,
    email: u.email || '',
    display_name: (u.user_metadata?.display_name as string) || null,
    role: (u.app_metadata?.role as string) || 'user',
    created_at: u.created_at || new Date().toISOString(),
    last_login: u.last_sign_in_at || null,
    metadata: u.user_metadata || {},
  }
}

async function currentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser()
  return supabaseUserToAuthUser(data.user)
}

export const chantanDB = {
  async insert(table: string, data: Record<string, any>) {
    const user = await currentUser()
    if (!user) throw new Error('You must be signed in to save data. Please log in or sign up first.')
    const row = {
      project_id: PROJECT_ID,
      table_name: table,
      data,
      user_id: user.id,
    }
    const { data: result, error } = await supabase.from(TABLE).insert(row).select().single()
    if (error) {
      if (/row-level security|RLS/i.test(error.message)) {
        throw new Error('Could not save data: your session is invalid. Please log out and log in again.')
      }
      throw new Error(error.message)
    }
    return { id: result.id, ...result.data, user_id: result.user_id, created_at: result.created_at }
  },

  async select(
    table: string,
    filter: Record<string, any> = {},
    options: { orderBy?: string; desc?: boolean; limit?: number } = {}
  ) {
    const user = await currentUser()
    let q = supabase.from(TABLE).select('*').eq('project_id', PROJECT_ID).eq('table_name', table)
    if (user) q = q.eq('user_id', user.id)
    for (const [k, v] of Object.entries(filter)) {
      if (k === 'user_id') continue // server-enforced scoping
      q = q.eq(`data->>${k}`, String(v))
    }
    if (options.orderBy) q = q.order(options.orderBy, { ascending: !options.desc })
    if (options.limit) q = q.limit(Math.min(options.limit, 1000))
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data || []).map((r: any) => ({ id: r.id, ...r.data, user_id: r.user_id, created_at: r.created_at, updated_at: r.updated_at }))
  },

  async update(table: string, filter: Record<string, any>, data: Record<string, any>) {
    const user = await currentUser()
    if (!user) throw new Error('Must be signed in to update')
    // Find matching rows, merge data JSONB, write back
    let q = supabase.from(TABLE).select('id,data').eq('project_id', PROJECT_ID).eq('table_name', table).eq('user_id', user.id)
    for (const [k, v] of Object.entries(filter)) {
      if (k === 'user_id') continue
      q = q.eq(`data->>${k}`, String(v))
    }
    const { data: rows, error: selErr } = await q
    if (selErr) throw new Error(selErr.message)
    if (!rows || rows.length === 0) return { updated: 0 }
    for (const r of rows) {
      const merged = { ...(r.data as object), ...data }
      const { error: upErr } = await supabase.from(TABLE).update({ data: merged, updated_at: new Date().toISOString() }).eq('id', r.id)
      if (upErr) throw new Error(upErr.message)
    }
    return { updated: rows.length }
  },

  async delete(table: string, filter: Record<string, any>) {
    const user = await currentUser()
    if (!user) throw new Error('Must be signed in to delete')
    let q = supabase.from(TABLE).delete({ count: 'exact' }).eq('project_id', PROJECT_ID).eq('table_name', table).eq('user_id', user.id)
    for (const [k, v] of Object.entries(filter)) {
      if (k === 'user_id') continue
      q = q.eq(`data->>${k}`, String(v))
    }
    const { error, count } = await q
    if (error) throw new Error(error.message)
    return { deleted: count || 0 }
  },

  async count(table: string, filter: Record<string, any> = {}) {
    const user = await currentUser()
    let q = supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('project_id', PROJECT_ID).eq('table_name', table)
    if (user) q = q.eq('user_id', user.id)
    for (const [k, v] of Object.entries(filter)) {
      if (k === 'user_id') continue
      q = q.eq(`data->>${k}`, String(v))
    }
    const { count, error } = await q
    if (error) throw new Error(error.message)
    return count || 0
  },

  auth: {
    async signUp(email: string, password: string, metadata: Record<string, any> = {}): Promise<AuthResponse> {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } })
      if (error) return { user: null, token: null, error: error.message }
      return { user: supabaseUserToAuthUser(data.user), token: data.session?.access_token || null, error: null }
    },
    async signIn(email: string, password: string): Promise<AuthResponse> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { user: null, token: null, error: error.message }
      return { user: supabaseUserToAuthUser(data.user), token: data.session?.access_token || null, error: null }
    },
    async signOut() { await supabase.auth.signOut() },
    async getUser(): Promise<AuthUser | null> { return currentUser() },
    async user(): Promise<AuthUser | null> { return currentUser() },
    async isAuthenticated(): Promise<boolean> {
      const { data } = await supabase.auth.getSession()
      return !!data.session
    },
  },

  // File uploads — BYO mode uses the user's own Supabase Storage directly.
  // Requires a bucket named "chantan-public" in your Supabase project.
  // Run the Setup SQL in the Database tab to create it automatically.
  storage: {
    async upload(file: File | Blob, options: { private?: boolean; fileName?: string } = {}): Promise<{ url: string; path: string; size: number }> {
      const fileName = options.fileName || (file instanceof File ? file.name : `upload-${Date.now()}.bin`)
      const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${Date.now()}-${safe}`
      const bucket = options.private ? 'chantan-private' : 'chantan-public'
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
      if (upErr) throw new Error(upErr.message)
      const size = (file as any).size || 0
      if (options.private) {
        const { data: signed, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
        if (sErr) throw new Error(sErr.message)
        return { url: signed?.signedUrl || '', path, size }
      } else {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
        return { url: pub.publicUrl, path, size }
      }
    },

    async delete(path: string, options: { private?: boolean } = {}): Promise<void> {
      const bucket = options.private ? 'chantan-private' : 'chantan-public'
      const { error } = await supabase.storage.from(bucket).remove([path])
      if (error) throw new Error(error.message)
    },

    async list(prefix: string = ''): Promise<Array<{ name: string; size: number; mime: string; url: string | null; created_at: string }>> {
      const { data, error } = await supabase.storage.from('chantan-public').list(prefix, { limit: 100 })
      if (error) throw new Error(error.message)
      return (data || []).map((f: any) => ({
        name: f.name,
        size: f.metadata?.size || 0,
        mime: f.metadata?.mimetype || 'application/octet-stream',
        url: supabase.storage.from('chantan-public').getPublicUrl(`${prefix ? prefix + '/' : ''}${f.name}`).data.publicUrl,
        created_at: f.created_at,
      }))
    },
  },

  // users.list / update / delete require the service_role key and are not
  // available in BYO mode. Users manage app users from their Supabase dashboard.
  users: {
    async list(): Promise<AuthUser[]> {
      throw new Error('User management is only available in Chantan-hosted DB mode. Manage users from your Supabase dashboard → Authentication → Users.')
    },
    async update(_userId: string, _data: any) {
      throw new Error('User management is only available in Chantan-hosted DB mode.')
    },
    async delete(_userId: string) {
      throw new Error('User management is only available in Chantan-hosted DB mode.')
    },
  },

  // Edge-function invocation. Use for any feature that calls a Supabase
  // edge function from the frontend (LLM analysis, payments, webhooks).
  // The user session JWT is auto-attached. NEVER re-import @supabase/
  // supabase-js to do this — the project configured client is already
  // here and the env vars used elsewhere do not exist in this build.
  //
  // Example:
  //   const { data, error } = await chantanDB.functions.invoke("generate-ad-copy", { body: { mediaUrl: url } })
  functions: {
    async invoke<T = unknown>(slug: string, opts?: { body?: any; headers?: Record<string, string> }): Promise<{ data: T | null; error: string | null }> {
      const { data, error } = await supabase.functions.invoke(slug, opts as any)
      return { data: (data as T) ?? null, error: error ? (error.message || String(error)) : null }
    },
  },
}

// NATIVE SUPABASE (BYO mode): the real supabase-js client is exported so
// app code can use the user's own Supabase to its full power — real tables
// (supabase.from), realtime (supabase.channel), rpc, storage, auth, and edge
// functions. Import it with: import { supabase } from "@/lib/chantan-db"
// (do NOT re-import @supabase/supabase-js elsewhere — this configured client
// is the only one whose env/keys exist).
export { supabase }

export default chantanDB
