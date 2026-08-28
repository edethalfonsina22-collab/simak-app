import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = tidak login
  const [profil, setProfil] = useState(undefined) // { role: 'admin'|'guru', guru_id, nama_lengkap, foto_profil_path } | null
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
    const profilDasar = data || { role: 'guru', guru_id: null }

    // Ambil nama & foto dari tabel guru (dipakai di Sidebar untuk avatar)
    if (profilDasar.guru_id) {
      const { data: guru } = await supabase
        .from('guru')
        .select('nama_lengkap, foto_profil_path')
        .eq('id', profilDasar.guru_id)
        .maybeSingle()
      setProfil({ ...profilDasar, nama_lengkap: guru?.nama_lengkap, foto_profil_path: guru?.foto_profil_path })
    } else {
      setProfil(profilDasar)
    }
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
