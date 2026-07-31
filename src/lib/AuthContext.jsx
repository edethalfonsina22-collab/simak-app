import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = tidak login
  const [profil, setProfil] = useState(undefined) // { role: 'admin'|'guru', guru_id } | null

  async function loadProfil(userId) {
    if (!userId) {
      setProfil(null)
      return
    }
    const { data } = await supabase
      .from('profil')
      .select('role, guru_id')
      .eq('id', userId)
      .maybeSingle()
    // Kalau belum ada baris profil, anggap 'guru' tanpa akses khusus
    setProfil(data || { role: 'guru', guru_id: null })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfil(data.session?.user?.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadProfil(newSession?.user?.id)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const isAdmin = profil?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        session,
        loading: session === undefined || profil === undefined,
        signIn,
        signOut,
        profil,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
