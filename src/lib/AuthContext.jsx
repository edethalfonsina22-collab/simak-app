import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profil, setProfil] = useState(undefined)
  const [registrationStatus, setRegistrationStatus] =
    useState(undefined)

  const loadProfil = useCallback(async (userId) => {
    if (!userId) {
      setProfil(null)
      setRegistrationStatus(null)
      return
    }

    const [profilResult, registrationResult] = await Promise.all([
      supabase
        .from('profil')
        .select('role, guru_id')
        .eq('id', userId)
        .maybeSingle(),

      supabase
        .from('permohonan_akun')
        .select('status, nama_lengkap, email, role')
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    const profilData = profilResult.data
    const registrationData = registrationResult.data

    setRegistrationStatus(registrationData?.status || null)

    const profilDasar = profilData || {
      role: registrationData?.role || 'guru',
      guru_id: null,
    }

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
      setProfil({
        ...profilDasar,
        nama_lengkap: registrationData?.nama_lengkap || '',
        foto_profil_path: '',
      })
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setSession(null)
        setProfil(null)
        setRegistrationStatus(null)
        return
      }

      const currentSession = data.session

      setSession(currentSession)
      await loadProfil(currentSession?.user?.id)
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return

        setSession(newSession)

        if (newSession) {
          setProfil(undefined)
          setRegistrationStatus(undefined)
        } else {
          setProfil(null)
          setRegistrationStatus(null)
        }

        setTimeout(() => {
          if (mounted) {
            loadProfil(newSession?.user?.id)
          }
        }, 0)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfil])

  async function signIn(email, password) {
    const result = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (result.error || !result.data?.user) {
      return result
    }

    const { data: permohonan, error: statusError } =
      await supabase
        .from('permohonan_akun')
        .select('status')
        .eq('user_id', result.data.user.id)
        .maybeSingle()

    // Jika akun lama belum memiliki permohonan, izinkan login.
    if (statusError || !permohonan) {
      return result
    }

    if (permohonan.status === 'pending') {
      await supabase.auth.signOut()

      return {
        data: null,
        error: {
          message:
            'Akun Anda masih menunggu persetujuan Admin.',
        },
      }
    }

    if (permohonan.status === 'rejected') {
      await supabase.auth.signOut()

      return {
        data: null,
        error: {
          message:
            'Pendaftaran akun Anda ditolak oleh Admin.',
        },
      }
    }

    return result
  }

  function signUp(email, password, options = {}) {
    return supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options,
    })
  }

  function signOut() {
    return supabase.auth.signOut()
  }

  const isAdmin = profil?.role === 'admin'

  const isApproved =
    registrationStatus === null ||
    registrationStatus === 'approved'

  const loading =
    session === undefined || profil === undefined

  return (
    <AuthContext.Provider
      value={{
        session,
        profil,
        loading,
        isAdmin,
        isApproved,
        registrationStatus,
        signIn,
        signUp,
        signOut,
        loadProfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
