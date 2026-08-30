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
      .select('role, jabatan, guru_id, sekolah_id, status_akun')
      .eq('id', userId)
      .maybeSingle()

    // PENTING: kalau tidak ada baris profil untuk user ini, JANGAN anggap
    // sebagai akun aktif. Ini terjadi ketika superadmin menghapus akun lewat
    // Persetujuan Akun (baris 'profil' dihapus, tapi akun di Supabase Auth
    // masih ada). Sebelumnya kode ini malah men-default-kan user tanpa
    // profil jadi { role: 'guru', status_akun: 'aktif' } — yang artinya
    // akun yang sudah "dihapus" tetap bisa login dan dianggap aktif.
    // Sekarang: langsung sign out & anggap tidak login sama sekali.
    if (!data) {
      await supabase.auth.signOut()
      setProfil(null)
      return
    }

    // Ambil nama & foto dari tabel guru (dipakai di Sidebar untuk avatar)
    if (data.guru_id) {
      const { data: guru } = await supabase
        .from('guru')
        .select('nama_lengkap, foto_profil_path')
        .eq('id', data.guru_id)
        .maybeSingle()
      setProfil({ ...data, nama_lengkap: guru?.nama_lengkap, foto_profil_path: guru?.foto_profil_path })
    } else {
      setProfil(data)
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
  //  - mode 'baru'   : user membuat sekolah baru, jadi admin_utama TAPI tetap
  //                    menunggu persetujuan Superadmin (sekolah baru belum
  //                    punya admin siapa pun yang bisa menyetujui sendiri).
  //  - mode 'gabung' : user bergabung ke sekolah yang sudah ada, menunggu
  //                    persetujuan admin utama sekolah tersebut.
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
    // 'jabatan' adalah label yang dipilih pendaftar sendiri di form
    // ('guru' | 'admin' | 'kepala_sekolah') — dipakai untuk tampilan di
    // Persetujuan Akun, terpisah dari 'role' teknis di bawah.
    const jabatanDipilih = jabatan || 'guru'
    // Untuk mode 'gabung', role teknis mengikuti jabatan yang dipilih.
    let role = jabatanDipilih
    let statusAkunBaru = 'menunggu'

    if (mode === 'baru') {
      const { data: sekolahBaru, error: sekolahError } = await supabase
        .from('sekolah')
        .insert({ nama_sekolah: namaSekolah })
        .select('id')
        .single()
      if (sekolahError) return { error: sekolahError }

      targetSekolahId = sekolahBaru.id
      // Pendiri sekolah tetap perlu jadi admin_utama secara TEKNIS supaya nanti
      // (setelah disetujui Superadmin) dia bisa mengelola & menyetujui akun lain
      // di sekolahnya sendiri — jabatan yang dia pilih (Admin/Kepala Sekolah)
      // hanya jadi label, disimpan terpisah di kolom 'jabatan'.
      role = 'admin_utama'
      statusAkunBaru = 'menunggu' // tetap menunggu persetujuan Superadmin
    }

    const { error: profilError } = await supabase.from('profil').insert({
      id: userId,
      role,
      jabatan: jabatanDipilih,
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
