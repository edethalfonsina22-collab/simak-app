import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = tidak login
  const [profil, setProfil] = useState(undefined)
  // profil: { role: 'guru'|'admin'|'kepala_sekolah'|'admin_utama'|'superadmin', guru_id, sekolah_id, status_akun, nama_lengkap, foto_profil_path } | null

  async function loadProfil(userId) {
    if (!userId) {
      setProfil(null)
      return
    }
    const { data } = await supabase
      .from('profil')
      .select('role, guru_id, sekolah_id, status_akun')
      .eq('id', userId)
      .maybeSingle()

    // Kalau belum ada baris profil, anggap 'guru' tanpa akses khusus & otomatis dianggap aktif
    const profilDasar = data || { role: 'guru', guru_id: null, sekolah_id: null, status_akun: 'disetujui' }

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

  // Ambil ulang profil user saat ini — dipakai di halaman MenungguPersetujuan
  // untuk mengecek apakah status akun sudah berubah (misal baru saja disetujui admin utama).
  const refreshProfil = () => loadProfil(session?.user?.id)

  // Registrasi akun baru — dua mode:
  //  - mode 'baru'   : user membuat sekolah baru, langsung jadi admin_utama & status disetujui otomatis
  //  - mode 'gabung' : user bergabung ke sekolah yang sudah ada, jadi admin biasa & menunggu persetujuan
  async function daftar({ mode, email, password, namaLengkap, namaSekolah, sekolahId, jabatan }) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (signUpError) return { error: signUpError }

    const userId = signUpData?.user?.id
    if (!userId) {
      return { error: { message: 'Pendaftaran gagal, silakan coba lagi.' } }
    }

    let targetSekolahId = sekolahId
    // Untuk mode 'gabung', jabatan dipilih sendiri oleh pendaftar saat mengisi form
    // ('guru' | 'admin' | 'kepala_sekolah'). Default ke 'guru' kalau tidak diisi.
    let role = jabatan || 'guru'
    let statusAkunBaru = 'menunggu'

    if (mode === 'baru') {
      const { data: sekolahBaru, error: sekolahError } = await supabase
        .from('sekolah')
        .insert({ nama_sekolah: namaSekolah })
        .select('id')
        .single()
      if (sekolahError) return { error: sekolahError }

      targetSekolahId = sekolahBaru.id
      role = 'admin_utama'
      statusAkunBaru = 'disetujui' // pembuat sekolah otomatis jadi admin utama yang aktif
    }

    const { error: profilError } = await supabase.from('profil').insert({
      id: userId,
      role,
      sekolah_id: targetSekolahId,
      status_akun: statusAkunBaru,
      nama_lengkap_pendaftar: namaLengkap,
      email_pendaftar: email,
    })
    if (profilError) return { error: profilError }

    return { error: null }
  }

  const isAdmin = ['admin', 'admin_utama', 'superadmin', 'kepala_sekolah'].includes(profil?.role)
  const isAdminUtama = profil?.role === 'admin_utama' || profil?.role === 'superadmin'
  const isSuperAdmin = profil?.role === 'superadmin'

  return (
    <AuthContext.Provider
      value={{
        session,
        loading: session === undefined || profil === undefined,
        signIn,
        signOut,
        daftar,
        refreshProfil,
        profil,
        isAdmin,
        isAdminUtama,
        isSuperAdmin,
        sekolahId: profil?.sekolah_id ?? null,
        statusAkun: profil?.status_akun ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
