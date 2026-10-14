import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/lib/chantan-db"

type Sess = { user: { id: string; email?: string } } | null
const Ctx = createContext<{ session: Sess; loading: boolean }>({ session: null, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Sess>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s as Sess)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session as Sess)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>
}
