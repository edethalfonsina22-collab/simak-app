import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profil, setProfil] = useState(undefined)

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

    // Jika belum ada profil, gunakan role guru tanpa akses khusus
    const profilDasar = data || {
      role: 'guru',
      guru_id: null,
    }

    // Ambil nama dan foto dari tabel guru
    if (profilDasar.guru_id) {
      const { data: guru } = await supabase
        .from('guru')
        .select('nama_lengkap, foto_profil_path')
        .eq('id', profilDasar.guru_id)
        .maybeSingle()

      setProfil({
        ...profilDasar,
        nama_lengkap: guru?.nama_lengkap || '',
        foto_profil_path: guru?.foto_profil_path || '',
      })
    } else {
      setProfil(profilDasar)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return

      setSession(data.session)
      loadProfil(data.session?.user?.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return

      setSession(newSession)
      loadProfil(newSession?.user?.id)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  function signIn(email, password) {
    return supabase.auth.signInWithPassword({
      email,
      password,
    })
  }

  function signUp(email, password) {
    return supabase.auth.signUp({
      email,
      password,
    })
  }

  function signOut() {
    return supabase.auth.signOut()
  }

  const isAdmin = profil?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        session,
        loading: session === undefined || profil === undefined,
        signIn,
        signUp,
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
