import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profil, setProfil] = useState(undefined)

  // Penanda "permintaan ke berapa" supaya kalau ada beberapa loadProfil()
  // berjalan bersamaan (misalnya event auth Supabase nembak beruntun saat
  // token di-refresh), hanya hasil dari permintaan PALING BARU yang boleh
  // mengubah state. Ini mencegah race condition yang sebelumnya bisa
  // memicu logout otomatis secara keliru.
  const profilRequestIdRef = useRef(0)

  async function loadProfil(userId) {
    const requestId = ++profilRequestIdRef.current

    if (!userId) {
      if (requestId === profilRequestIdRef.current) setProfil(null)
      return
    }

    const { data, error } = await supabase
      .from('profil')
      .select(`
        role,
        jabatan,
        guru_id,
        sekolah_id,
        status_akun,
        catatan_admin,
        nama_lengkap_pendaftar,
        email_pendaftar,
        foto_profil_path,
        nuptk,
        pangkat_golongan,
        no_hp,
        tanggal_lahir,
        pendidikan_terakhir,
        alamat
      `)
      .eq('id', userId)
      .maybeSingle()

    // Ada permintaan yang lebih baru sudah mulai berjalan setelah ini —
    // abaikan hasil yang telat ini supaya tidak menimpa state yang sudah
    // lebih baru/benar.
    if (requestId !== profilRequestIdRef.current) return

    if (error) {
      // PERBAIKAN: error jaringan/RLS sesaat (misalnya waktu koneksi lambat
      // atau token sedang di-refresh) BUKAN berarti sesi tidak valid.
      // Jangan logout paksa di sini — cukup catat errornya dan biarkan
      // profil lama tetap dipakai, supaya user tidak terlempar keluar
      // secara tiba-tiba hanya karena satu query telat/gagal.
      console.error('Gagal memuat profil (dibiarkan, tidak logout paksa):', error)
      return
    }

    // Profil benar-benar tidak ada di database (akun memang belum/tidak
    // terdaftar) — ini kasus yang sah untuk logout, bukan sekadar query
    // yang telat.
    if (!data) {
      console.warn('Profil tidak ditemukan untuk user ini, logout.')
      await supabase.auth.signOut()
      if (requestId === profilRequestIdRef.current) setProfil(null)
      return
    }

    // Ambil nama & foto dari tabel guru jika punya guru_id
    if (data.guru_id) {
      const { data: guru } = await supabase
        .from('guru')
        .select('nama_lengkap, foto_profil_path')
        .eq('id', data.guru_id)
        .maybeSingle()

      if (requestId !== profilRequestIdRef.current) return

      setProfil({
        ...data,
        nama_lengkap: guru?.nama_lengkap || data.nama_lengkap_pendaftar,
        foto_profil_path: guru?.foto_profil_path || data.foto_profil_path,
      })
    } else {
      setProfil({
        ...data,
        nama_lengkap: data.nama_lengkap_pendaftar,
      })
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
      data: listener,
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return

      // PERBAIKAN: event TOKEN_REFRESHED berarti sesi masih sah, cuma
      // token-nya diperbarui di belakang layar — tidak perlu query ulang
      // profil dari nol (ini salah satu sumber query bertumpuk yang
      // membuat aplikasi terasa macet saat banyak klik).
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession)
        return
      }

      setSession(newSession)
      loadProfil(newSession?.user?.id)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({
      email,
      password,
    })

  const signOut = () => supabase.auth.signOut()

  const refreshProfil = () => loadProfil(session?.user?.id)

  async function tandaiPesanDibaca() {
    if (!session?.user?.id) return

    await supabase
      .from('profil')
      .update({ catatan_admin: null })
      .eq('id', session.user.id)

    await loadProfil(session.user.id)
  }

  // =========================================================
  // REGISTRASI
  // =========================================================

  async function daftar({
    mode,
    email,
    password,
    namaLengkap,
    namaSekolah,
    sekolahId,
    jabatan,
    siswaId,
    hubungan,
  }) {
    // Orang tua hanya boleh bergabung ke sekolah yang sudah ada.
    if (jabatan === 'orang_tua' && mode !== 'gabung') {
      return {
        error: {
          message: 'Akun orang tua/wali hanya dapat bergabung ke sekolah yang sudah terdaftar.',
        },
      }
    }

    // Orang tua wajib memilih sekolah.
    if (jabatan === 'orang_tua' && !sekolahId) {
      return {
        error: {
          message: 'Silakan pilih sekolah terlebih dahulu.',
        },
      }
    }

    // Orang tua wajib memilih siswa.
    if (jabatan === 'orang_tua' && !siswaId) {
      return {
        error: {
          message: 'Silakan pilih siswa yang merupakan anak/wali Anda.',
        },
      }
    }

    // Orang tua wajib memilih hubungan.
    if (jabatan === 'orang_tua' && !hubungan) {
      return {
        error: {
          message: 'Silakan pilih hubungan dengan siswa.',
        },
      }
    }

    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email,
        password,
      })

    if (signUpError) {
      return { error: signUpError }
    }

    const userId = signUpData?.user?.id

    if (!userId) {
      return {
        error: {
          message: 'Pendaftaran gagal, silakan coba lagi.',
        },
      }
    }

    let targetSekolahId = sekolahId

    // Jabatan yang dipilih user.
    const jabatanDipilih = jabatan || 'guru'

    // Default role teknis mengikuti jabatan.
    let role = jabatanDipilih
    let statusAkunBaru = 'menunggu'

    // =======================================================
    // PENDAFTARAN SEKOLAH BARU
    // =======================================================

    if (mode === 'baru') {
      const { data: sekolahBaru, error: sekolahError } =
        await supabase
          .from('sekolah')
          .insert({
            nama_sekolah: namaSekolah,
          })
          .select('id')
          .single()

      if (sekolahError) {
        return { error: sekolahError }
      }

      targetSekolahId = sekolahBaru.id

      // Pendiri sekolah menjadi admin_utama.
      role = 'admin_utama'
      statusAkunBaru = 'menunggu'
    }

    // =======================================================
    // KHUSUS ORANG TUA
    // =======================================================

    if (jabatanDipilih === 'orang_tua') {
      role = 'orang_tua'
      statusAkunBaru = 'menunggu'
    }

    // =======================================================
    // BUAT PROFIL
    // =======================================================

    const { error: profilError } = await supabase
      .from('profil')
      .insert({
        id: userId,
        role,
        jabatan: jabatanDipilih,
        sekolah_id: targetSekolahId,
        status_akun: statusAkunBaru,
        nama_lengkap_pendaftar: namaLengkap,
        email_pendaftar: email,
      })

    if (profilError) {
      return { error: profilError }
    }

    // =======================================================
    // HUBUNGKAN ORANG TUA DENGAN SISWA
    // =======================================================

    if (jabatanDipilih === 'orang_tua') {
      // Pastikan siswa memang berasal dari sekolah yang dipilih.
      const { data: siswa, error: siswaError } = await supabase
        .from('siswa')
        .select('id, sekolah_id')
        .eq('id', siswaId)
        .maybeSingle()

      if (siswaError) {
        return { error: siswaError }
      }

      if (!siswa) {
        return {
          error: {
            message: 'Siswa tidak ditemukan.',
          },
        }
      }

      if (siswa.sekolah_id !== targetSekolahId) {
        return {
          error: {
            message: 'Siswa tersebut bukan bagian dari sekolah yang dipilih.',
          },
        }
      }

      const { error: hubunganError } = await supabase
        .from('orang_tua_siswa')
        .insert({
          orang_tua_id: userId,
          siswa_id: siswaId,
          hubungan,
          status: 'menunggu',
        })

      if (hubunganError) {
        return { error: hubunganError }
      }
    }

    return {
      error: null,
    }
  }

  // =========================================================
  // TAMBAH ANAK UNTUK AKUN ORANG TUA YANG SUDAH LOGIN
  // =========================================================

  async function tambahAnak({
    siswaId,
    hubungan = 'wali',
  }) {
    if (!session?.user?.id) {
      return {
        error: {
          message: 'Anda harus login terlebih dahulu.',
        },
      }
    }

    if (!isOrangTua) {
      return {
        error: {
          message: 'Fitur ini hanya tersedia untuk akun orang tua/wali.',
        },
      }
    }

    if (!siswaId) {
      return {
        error: {
          message: 'Silakan pilih siswa.',
        },
      }
    }

    // Pastikan siswa berada di sekolah yang sama.
    const { data: siswa, error: siswaError } = await supabase
      .from('siswa')
      .select('id, sekolah_id')
      .eq('id', siswaId)
      .maybeSingle()

    if (siswaError) {
      return { error: siswaError }
    }

    if (!siswa) {
      return {
        error: {
          message: 'Siswa tidak ditemukan.',
        },
      }
    }

    if (siswa.sekolah_id !== profil?.sekolah_id) {
      return {
        error: {
          message: 'Siswa tersebut bukan bagian dari sekolah Anda.',
        },
      }
    }

    const { error } = await supabase
      .from('orang_tua_siswa')
      .insert({
        orang_tua_id: session.user.id,
        siswa_id: siswaId,
        hubungan,
        status: 'menunggu',
      })

    return { error }
  }

  // =========================================================
  // AMBIL DATA ANAK ORANG TUA
  // =========================================================

  async function getAnakSaya() {
    if (!session?.user?.id) {
      return {
        data: [],
        error: null,
      }
    }

    if (!isOrangTua) {
      return {
        data: [],
        error: null,
      }
    }

    const { data, error } = await supabase
      .from('orang_tua_siswa')
      .select(`
        id,
        hubungan,
        status,
        catatan_admin,
        dibuat_pada,
        siswa (
          id,
          nis,
          nisn,
          nama_lengkap,
          jenis_kelamin,
          tempat_lahir,
          tanggal_lahir,
          foto_path,
          status,
          kelas (
            id,
            nama_kelas,
            tingkat,
            tahun_ajaran
          )
        )
      `)
      .eq('orang_tua_id', session.user.id)
      .order('dibuat_pada', {
        ascending: false,
      })

    return {
      data: data || [],
      error,
    }
  }

  // =========================================================
  // ROLE
  // =========================================================

  const isAdmin = [
    'admin',
    'admin_utama',
    'superadmin',
    'kepala_sekolah',
  ].includes(profil?.role)

  const isAdminUtama =
    profil?.role === 'admin_utama' ||
    profil?.role === 'superadmin'

  const isSuperAdmin =
    profil?.role === 'superadmin'

  const isOrangTua =
    profil?.role === 'orang_tua'

  return (
    <AuthContext.Provider
      value={{
        session,

        loading:
          session === undefined ||
          profil === undefined,

        signIn,
        signOut,

        daftar,
        refreshProfil,

        profil,

        isAdmin,
        isAdminUtama,
        isSuperAdmin,
        isOrangTua,

        tambahAnak,
        getAnakSaya,

        sekolahId:
          profil?.sekolah_id ?? null,

        statusAkun:
          profil?.status_akun ?? null,

        pesanAdmin:
          profil?.catatan_admin ?? null,

        tandaiPesanDibaca,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
