import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock3,
  X,
  UserCheck,
  UserPlus,
  MessageSquare,
  Pencil,
  KeyRound,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

export default function PersetujuanAkun() {
  const { isSuperAdmin, sekolahId } = useAuth()
  const [tab, setTab] = useState('menunggu')
  const [filterJabatan, setFilterJabatan] = useState('semua')
  const [daftarAkun, setDaftarAkun] = useState([])
  const [loading, setLoading] = useState(true)
  const [prosesId, setProsesId] = useState(null)
  const [modalGuru, setModalGuru] = useState(null) // akun yang sedang diproses link guru-nya
  const [modalEdit, setModalEdit] = useState(null) // akun yang sedang diedit datanya

  // Anak-anak dari akun orang tua yang AKUNNYA SUDAH AKTIF, yang baru
  // ditambahkan lewat fitur "Tambah Anak" (bukan anak pertama saat
  // pendaftaran) dan masih menunggu persetujuan. Ditampilkan di tab
  // terpisah karena tab "Menunggu" di atas hanya memfilter dari
  // profil.status_akun, tidak akan pernah menangkap baris ini.
  const [anakMenunggu, setAnakMenunggu] = useState([])
  const [loadingAnakMenunggu, setLoadingAnakMenunggu] = useState(true)

  async function muatData() {
    setLoading(true)
    let query = supabase
      .from('profil')
      .select(
        'id, role, jabatan, status_akun, nama_lengkap_pendaftar, email_pendaftar, catatan_admin, dibuat_pada, sekolah_id, guru_id, sekolah:sekolah_id(nama_sekolah)'
      )
      .order('dibuat_pada', { ascending: false })

    query = tab === 'menunggu' ? query.eq('status_akun', 'menunggu') : query.neq('status_akun', 'menunggu')

    if (!isSuperAdmin) {
      query = query.eq('sekolah_id', sekolahId)
    }

    if (filterJabatan === 'guru') {
      query = query.or('jabatan.eq.guru,and(jabatan.is.null,role.eq.guru)')
    } else if (filterJabatan === 'admin_kepsek') {
      query = query.or(
        'jabatan.in.(admin,kepala_sekolah),and(jabatan.is.null,role.in.(admin,kepala_sekolah,admin_utama))'
      )
    } else if (filterJabatan === 'orang_tua') {
      query = query.eq('jabatan', 'orang_tua')
    }

    const { data } = await query
    let akunList = data || []

    // Ambil data anak untuk setiap akun orang tua. Tidak bisa di-embed
    // langsung lewat FK karena profil.id dan orang_tua_siswa.orang_tua_id
    // sama-sama mengacu ke auth.users, bukan saling berelasi satu sama
    // lain — jadi diambil terpisah lalu digabung di sisi klien.
    const idOrangTua = akunList
      .filter((a) => (a.jabatan || a.role) === 'orang_tua')
      .map((a) => a.id)

    if (idOrangTua.length > 0) {
      const { data: relasi } = await supabase
        .from('orang_tua_siswa')
        .select('id, orang_tua_id, siswa_id, hubungan, status, siswa:siswa_id(nama_lengkap, nis)')
        .in('orang_tua_id', idOrangTua)

      akunList = akunList.map((a) =>
        (a.jabatan || a.role) === 'orang_tua'
          ? { ...a, relasiAnak: (relasi || []).filter((r) => r.orang_tua_id === a.id) }
          : a
      )
    }

    setDaftarAkun(akunList)
    setLoading(false)
  }

  // Ambil semua baris orang_tua_siswa berstatus 'menunggu' milik akun
  // orang tua yang AKUNNYA sudah 'aktif' — ini yang menandakan baris
  // tersebut hasil "Tambah Anak" belakangan, bukan anak pertama saat
  // pendaftaran (yang sudah tertangani lewat tab "Menunggu" di atas).
  async function muatAnakMenunggu() {
    setLoadingAnakMenunggu(true)

    const { data: relasi } = await supabase
      .from('orang_tua_siswa')
      .select(`
        id,
        orang_tua_id,
        siswa_id,
        hubungan,
        status,
        catatan_admin,
        dibuat_pada,
        siswa:siswa_id (nama_lengkap, nis, sekolah_id)
      `)
      .eq('status', 'menunggu')
      .order('dibuat_pada', { ascending: false })

    let daftar = relasi || []

    // Filter sekolah untuk admin non-superadmin (siswa.sekolah_id, karena
    // orang_tua_siswa sendiri tidak punya kolom sekolah_id)
    if (!isSuperAdmin) {
      daftar = daftar.filter((r) => r.siswa?.sekolah_id === sekolahId)
    }

    // Ambil nama akun orang tua terpisah (tidak ada FK profil <-> orang_tua_siswa)
    const idOrtu = [...new Set(daftar.map((r) => r.orang_tua_id))]
    let profilOrtu = []
    if (idOrtu.length > 0) {
      const { data } = await supabase
        .from('profil')
        .select('id, nama_lengkap_pendaftar, email_pendaftar, status_akun')
        .in('id', idOrtu)
      profilOrtu = data || []
    }

    // Hanya tampilkan baris dari akun ortu yang AKUNNYA SUDAH AKTIF —
    // relasi anak pertama (saat akun masih 'menunggu') sudah muncul & sudah
    // ditangani lewat tab "Menunggu" yang sudah ada, jadi tidak perlu dobel di sini.
    daftar = daftar
      .map((r) => ({ ...r, ortu: profilOrtu.find((p) => p.id === r.orang_tua_id) }))
      .filter((r) => r.ortu?.status_akun === 'aktif')

    setAnakMenunggu(daftar)
    setLoadingAnakMenunggu(false)
  }

  useEffect(() => {
    muatData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterJabatan])

  useEffect(() => {
    muatAnakMenunggu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ubahStatus(id, statusBaru, catatan = '', guruId = null) {
    setProsesId(id)
    const payload = { status_akun: statusBaru, catatan_admin: catatan || null }
    if (guruId) payload.guru_id = guruId
    await supabase.from('profil').update(payload).eq('id', id)

    // Kalau akun ini orang tua/wali, ikut sinkronkan status hubungan
    // dengan anaknya di tabel orang_tua_siswa supaya tidak "nyangkut"
    // di status menunggu walau akunnya sudah disetujui/ditolak.
    // Dibatasi hanya baris yang MASIH 'menunggu' (anak pertama saat
    // pendaftaran) — supaya tidak menimpa status anak lain yang sudah
    // diproses terpisah lewat tab "Anak Menunggu".
    const akun = daftarAkun.find((a) => a.id === id)
    if ((akun?.jabatan || akun?.role) === 'orang_tua') {
      const statusRelasi =
        statusBaru === 'aktif' ? 'aktif' : statusBaru === 'ditolak' ? 'ditolak' : 'menunggu'
      await supabase
        .from('orang_tua_siswa')
        .update({ status: statusRelasi })
        .eq('orang_tua_id', id)
        .eq('status', 'menunggu')
    }

    setProsesId(null)
    setModalGuru(null)
    muatData()
    muatAnakMenunggu()
  }

  function handleTolak(id) {
    const catatan = window.prompt('Catatan penolakan (opsional):') || ''
    ubahStatus(id, 'ditolak', catatan)
  }

  function isJabatanGuru(akun) {
    return (akun.jabatan || akun.role) === 'guru'
  }

  function handleSetujui(akun) {
    if (isJabatanGuru(akun)) {
      setModalGuru(akun) // buka modal, jangan langsung ubah status
    } else {
      ubahStatus(akun.id, 'aktif')
    }
  }

  // Kirim/edit pesan (catatan_admin) untuk akun yang sudah disetujui
  async function handlePesan(akun) {
    const pesanBaru = window.prompt(
      `Pesan untuk ${akun.nama_lengkap_pendaftar || 'pengguna ini'}:`,
      akun.catatan_admin || ''
    )
    if (pesanBaru === null) return // dibatalkan
    setProsesId(akun.id)
    const { error } = await supabase
      .from('profil')
      .update({ catatan_admin: pesanBaru })
      .eq('id', akun.id)
    setProsesId(null)
    if (error) {
      window.alert('Gagal menyimpan pesan: ' + error.message)
      return
    }
    muatData()
  }

  // Kirim link reset password ke email pengguna (via Supabase Auth)
  async function handleResetPassword(akun) {
    if (!akun.email_pendaftar) {
      window.alert('Akun ini tidak memiliki email terdaftar.')
      return
    }
    if (!window.confirm(`Kirim link reset password ke ${akun.email_pendaftar}?`)) return
    setProsesId(akun.id)
    const { error } = await supabase.auth.resetPasswordForEmail(akun.email_pendaftar)
    setProsesId(null)
    if (error) {
      window.alert('Gagal mengirim link reset password: ' + error.message)
      return
    }
    window.alert('Link reset password berhasil dikirim ke ' + akun.email_pendaftar)
  }

  // Kembalikan status akun ke "menunggu" — membatalkan keputusan setuju/tolak sebelumnya
  async function handleResetStatus(akun) {
    if (
      !window.confirm(
        `Kembalikan status akun "${akun.nama_lengkap_pendaftar || akun.email_pendaftar}" ke "Menunggu"? Keputusan sebelumnya akan dibatalkan.`
      )
    )
      return
    setProsesId(akun.id)
    const { error } = await supabase
      .from('profil')
      .update({ status_akun: 'menunggu', catatan_admin: null, guru_id: null })
      .eq('id', akun.id)

    // Sama seperti di ubahStatus(): hanya reset baris orang_tua_siswa yang
    // statusnya masih cerminan dari status akun SEBELUM direset ini (aktif
    // atau ditolak), supaya anak lain yang sudah diproses terpisah lewat
    // tab "Anak Menunggu" tidak ikut ter-reset tanpa sengaja.
    if (!error && (akun.jabatan || akun.role) === 'orang_tua') {
      await supabase
        .from('orang_tua_siswa')
        .update({ status: 'menunggu' })
        .eq('orang_tua_id', akun.id)
        .eq('status', akun.status_akun === 'aktif' ? 'aktif' : 'ditolak')
    }

    setProsesId(null)
    if (error) {
      window.alert('Gagal mereset status akun: ' + error.message)
      return
    }
    muatData()
    muatAnakMenunggu()
  }

  // Simpan perubahan data akun dari modal Edit
  async function handleSimpanEdit(id, dataBaru) {
    setProsesId(id)
    const { error } = await supabase.from('profil').update(dataBaru).eq('id', id)
    setProsesId(null)
    setModalEdit(null)
    if (error) {
      window.alert('Gagal menyimpan perubahan: ' + error.message)
      return
    }
    muatData()
  }

  // Hapus akun secara PERMANEN — profil, data guru terkait (jika ada), DAN
  // akun di Supabase Auth. Ini dikerjakan lewat Edge Function 'hapus-akun'
  // karena menghapus dari Auth butuh service role key yang tidak boleh
  // dipakai di frontend. Edge Function juga memverifikasi ulang bahwa
  // pemanggil memang berwenang (superadmin, atau admin_utama untuk
  // sekolahnya sendiri) sebelum menghapus apa pun.
  async function handleHapus(akun) {
    if (
      !window.confirm(
        `Hapus akun "${akun.nama_lengkap_pendaftar || akun.email_pendaftar}" secara permanen? Akun ini juga tidak akan bisa login lagi. Data guru terkait (jika ada) juga akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.`
      )
    )
      return
    setProsesId(akun.id)

    const { data, error } = await supabase.functions.invoke('hapus-akun', {
      body: { akun_id: akun.id, guru_id: akun.guru_id || null },
    })

    setProsesId(null)

    if (error || data?.error) {
      let pesan = data?.error || error?.message || 'Terjadi kesalahan tak terduga.'
      // Kalau supabase-js melempar FunctionsHttpError, body JSON asli ada di error.context
      if (error?.context?.json) {
        try {
          const body = await error.context.json()
          if (body?.error) pesan = body.error
        } catch {
          // abaikan, pakai pesan default di atas
        }
      }
      window.alert('Gagal menghapus akun: ' + pesan)
      return
    }

    muatData()
  }

  // Setujui satu baris anak (tab "Anak Menunggu") — hanya menyentuh baris
  // ini, tidak menyentuh baris anak lain atau status akun orang tuanya.
  async function setujuiAnak(relasiId) {
    setProsesId(relasiId)
    const { error } = await supabase
      .from('orang_tua_siswa')
      .update({ status: 'aktif' })
      .eq('id', relasiId)
    setProsesId(null)
    if (error) {
      window.alert('Gagal menyetujui: ' + error.message)
      return
    }
    muatAnakMenunggu()
  }

  // Tolak satu baris anak (tab "Anak Menunggu")
  async function tolakAnak(relasiId) {
    const catatan = window.prompt('Catatan penolakan (opsional):') || ''
    setProsesId(relasiId)
    const { error } = await supabase
      .from('orang_tua_siswa')
      .update({ status: 'ditolak', catatan_admin: catatan || null })
      .eq('id', relasiId)
    setProsesId(null)
    if (error) {
      window.alert('Gagal menolak: ' + error.message)
      return
    }
    muatAnakMenunggu()
  }

  return (
    <Layout
      title="Persetujuan Akun"
      subtitle={`Kelola pendaftaran akun admin baru${isSuperAdmin ? ' di seluruh sekolah' : ' di sekolah Anda'}.`}
    >
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('menunggu')}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
            tab === 'menunggu' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Menunggu
        </button>
        <button
          onClick={() => setTab('riwayat')}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
            tab === 'riwayat' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Riwayat
        </button>
        <button
          onClick={() => setTab('anak_menunggu')}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'anak_menunggu' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Anak Menunggu
          {anakMenunggu.length > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === 'anak_menunggu' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {anakMenunggu.length}
            </span>
          )}
        </button>
      </div>

      {tab !== 'anak_menunggu' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterJabatan('semua')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filterJabatan === 'semua' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Semua Jabatan
          </button>
          <button
            onClick={() => setFilterJabatan('admin_kepsek')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filterJabatan === 'admin_kepsek' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            Admin & Kepala Sekolah
          </button>
          <button
            onClick={() => setFilterJabatan('guru')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filterJabatan === 'guru' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
            }`}
          >
            Guru
          </button>
          <button
            onClick={() => setFilterJabatan('orang_tua')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filterJabatan === 'orang_tua' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            Orang Tua/Wali
          </button>
        </div>
      )}

      {tab !== 'anak_menunggu' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-slate-400 text-center">Memuat data...</p>
          ) : daftarAkun.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">
              {tab === 'menunggu'
                ? 'Tidak ada pendaftaran yang menunggu persetujuan.'
                : 'Belum ada riwayat.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Jabatan</th>
                  {isSuperAdmin && <th className="text-left px-4 py-3 font-medium">Sekolah</th>}
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftarAkun.map((akun) => (
                  <tr key={akun.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {akun.nama_lengkap_pendaftar || '—'}
                      {(akun.jabatan || akun.role) === 'orang_tua' && akun.relasiAnak?.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Anak:{' '}
                          {akun.relasiAnak
                            .map((r) => r.siswa?.nama_lengkap)
                            .filter(Boolean)
                            .join(', ')}
                          {akun.relasiAnak[0]?.hubungan ? ` (${akun.relasiAnak[0].hubungan})` : ''}
                        </p>
                      )}
                      {(akun.jabatan || akun.role) === 'orang_tua' && akun.relasiAnak?.length === 0 && (
                        <p className="text-[11px] text-red-400 mt-0.5">
                          Belum ada data anak terhubung
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{akun.email_pendaftar || '—'}</td>
                    <td className="px-4 py-3">
                      <JabatanBadge jabatan={akun.jabatan} role={akun.role} />
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-slate-500">{akun.sekolah?.nama_sekolah || '—'}</td>
                    )}
                    <td className="px-4 py-3">
                      <StatusBadge status={akun.status_akun} />
                      {akun.status_akun === 'aktif' && akun.catatan_admin && (
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] truncate" title={akun.catatan_admin}>
                          "{akun.catatan_admin}"
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1.5 flex-wrap">
                        {akun.status_akun === 'menunggu' && (
                          <>
                            <button
                              onClick={() => handleSetujui(akun)}
                              disabled={prosesId === akun.id}
                              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} /> Setujui
                            </button>
                            <button
                              onClick={() => handleTolak(akun.id)}
                              disabled={prosesId === akun.id}
                              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                            >
                              <XCircle size={14} /> Tolak
                            </button>
                          </>
                        )}

                        {akun.status_akun === 'aktif' && (
                          <button
                            onClick={() => handlePesan(akun)}
                            disabled={prosesId === akun.id}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-60"
                          >
                            <MessageSquare size={14} /> {akun.catatan_admin ? 'Edit Pesan' : 'Kirim Pesan'}
                          </button>
                        )}

                        {akun.status_akun !== 'menunggu' && (
                          <button
                            onClick={() => handleResetStatus(akun)}
                            disabled={prosesId === akun.id}
                            title="Kembalikan ke status Menunggu"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}

                        <button
                          onClick={() => setModalEdit(akun)}
                          disabled={prosesId === akun.id}
                          title="Edit data akun"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          onClick={() => handleResetPassword(akun)}
                          disabled={prosesId === akun.id}
                          title="Kirim link reset password"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 disabled:opacity-60"
                        >
                          <KeyRound size={14} />
                        </button>

                        <button
                          onClick={() => handleHapus(akun)}
                          disabled={prosesId === akun.id}
                          title="Hapus akun"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loadingAnakMenunggu ? (
            <p className="p-6 text-sm text-slate-400 text-center">Memuat data...</p>
          ) : anakMenunggu.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">
              Tidak ada permintaan tambah anak yang menunggu persetujuan.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Akun Orang Tua</th>
                  <th className="text-left px-4 py-3 font-medium">Anak</th>
                  <th className="text-left px-4 py-3 font-medium">Hubungan</th>
                  <th className="text-right px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anakMenunggu.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {r.ortu?.nama_lengkap_pendaftar || '—'}
                      <p className="text-[11px] text-slate-400">{r.ortu?.email_pendaftar}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.siswa?.nama_lengkap || '—'}
                      <p className="text-[11px] text-slate-400">NIS: {r.siswa?.nis || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{r.hubungan || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <button
                          onClick={() => setujuiAnak(r.id)}
                          disabled={prosesId === r.id}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-60"
                        >
                          <CheckCircle2 size={14} /> Setujui
                        </button>
                        <button
                          onClick={() => tolakAnak(r.id)}
                          disabled={prosesId === r.id}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                        >
                          <XCircle size={14} /> Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalGuru && (
        <ModalHubungkanGuru
          akun={modalGuru}
          onClose={() => setModalGuru(null)}
          onSelesai={(guruId) => ubahStatus(modalGuru.id, 'aktif', '', guruId)}
        />
      )}

      {modalEdit && (
        <ModalEditAkun
          akun={modalEdit}
          onClose={() => setModalEdit(null)}
          onSimpan={handleSimpanEdit}
        />
      )}
    </Layout>
  )
}

function ModalHubungkanGuru({ akun, onClose, onSelesai }) {
  const [daftarGuru, setDaftarGuru] = useState([])
  const [guruIdTerpilih, setGuruIdTerpilih] = useState('')
  const [loading, setLoading] = useState(true)
  const [memproses, setMemproses] = useState(false)
  const [mode, setMode] = useState('pilih') // 'pilih' | 'baru'

  useEffect(() => {
    async function muat() {
      // Guru di sekolah yang sama, yang BELUM terhubung ke akun profil manapun
      const { data: sudahTerhubung } = await supabase
        .from('profil')
        .select('guru_id')
        .not('guru_id', 'is', null)

      const idTerpakai = (sudahTerhubung || []).map((p) => p.guru_id)

      let query = supabase
        .from('guru')
        .select('id, nama_lengkap, nip, mata_pelajaran')
        .eq('sekolah_id', akun.sekolah_id)
        .order('nama_lengkap')

      const { data } = await query
      const belumTerhubung = (data || []).filter((g) => !idTerpakai.includes(g.id))
      setDaftarGuru(belumTerhubung)
      setLoading(false)
    }
    muat()
  }, [akun.sekolah_id])

  async function handleHubungkan() {
    if (!guruIdTerpilih) return
    setMemproses(true)
    onSelesai(guruIdTerpilih)
  }

  async function handleBuatBaru() {
    setMemproses(true)
    const { data: guruBaru, error } = await supabase
      .from('guru')
      .insert({
        nama_lengkap: akun.nama_lengkap_pendaftar,
        email: akun.email_pendaftar,
        sekolah_id: akun.sekolah_id,
        status: 'aktif',
      })
      .select('id')
      .single()

    setMemproses(false)
    if (error) {
      window.alert('Gagal membuat data guru baru: ' + error.message)
      return
    }
    onSelesai(guruBaru.id)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-800">Hubungkan Akun Guru</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {akun.nama_lengkap_pendaftar} ({akun.email_pendaftar}) perlu dihubungkan ke data Guru
          supaya muncul di Jadwal, Presensi, Nilai, dan fitur lain.
        </p>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-4">
          <button
            onClick={() => setMode('pilih')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
              mode === 'pilih' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
            }`}
          >
            <UserCheck size={14} /> Data Sudah Ada
          </button>
          <button
            onClick={() => setMode('baru')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
              mode === 'baru' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
            }`}
          >
            <UserPlus size={14} /> Buat Baru
          </button>
        </div>

        {mode === 'pilih' ? (
          <>
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-4">Memuat data guru...</p>
            ) : daftarGuru.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Tidak ada data guru yang belum terhubung di sekolah ini. Gunakan tab "Buat Baru".
              </p>
            ) : (
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4"
                value={guruIdTerpilih}
                onChange={(e) => setGuruIdTerpilih(e.target.value)}
              >
                <option value="">-- Pilih Data Guru --</option>
                {daftarGuru.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama_lengkap} {g.nip ? `(NIP: ${g.nip})` : ''} {g.mata_pelajaran ? `- ${g.mata_pelajaran}` : ''}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleHubungkan}
              disabled={!guruIdTerpilih || memproses}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
            >
              {memproses ? 'Memproses...' : 'Hubungkan & Setujui'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-4">
              Data guru baru akan dibuat otomatis dari nama & email pendaftaran. Lengkapi NIP, mata
              pelajaran, dll nanti di halaman Data Guru.
            </p>
            <button
              onClick={handleBuatBaru}
              disabled={memproses}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
            >
              {memproses ? 'Memproses...' : 'Buat Data Guru Baru & Setujui'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ModalEditAkun({ akun, onClose, onSimpan }) {
  const [nama, setNama] = useState(akun.nama_lengkap_pendaftar || '')
  const [email, setEmail] = useState(akun.email_pendaftar || '')
  const [jabatan, setJabatan] = useState(akun.jabatan || akun.role || 'guru')
  const [menyimpan, setMenyimpan] = useState(false)

  async function handleSimpan() {
    setMenyimpan(true)
    await onSimpan(akun.id, {
      nama_lengkap_pendaftar: nama,
      email_pendaftar: email,
      jabatan,
    })
    setMenyimpan(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Edit Data Akun</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nama Lengkap</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Catatan: mengubah email di sini hanya mengubah data tampilan, bukan email login akun.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Jabatan</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
            >
              <option value="guru">Guru</option>
              <option value="admin">Admin</option>
              <option value="kepala_sekolah">Kepala Sekolah</option>
              <option value="admin_utama">Admin Utama</option>
              <option value="orang_tua">Orang Tua/Wali</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSimpan}
          disabled={menyimpan || !nama || !email}
          className="w-full mt-5 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {menyimpan ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    menunggu: { label: 'Menunggu', cls: 'bg-amber-50 text-amber-600', icon: Clock3 },
    aktif: { label: 'Disetujui', cls: 'bg-green-50 text-green-600', icon: CheckCircle2 },
    ditolak: { label: 'Ditolak', cls: 'bg-red-50 text-red-600', icon: XCircle },
  }
  const item = map[status] || map.menunggu
  const Icon = item.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${item.cls}`}>
      <Icon size={12} /> {item.label}
    </span>
  )
}

function JabatanBadge({ jabatan, role }) {
  const map = {
    guru: { label: 'Guru', cls: 'bg-blue-50 text-blue-600' },
    admin: { label: 'Admin', cls: 'bg-purple-50 text-purple-600' },
    kepala_sekolah: { label: 'Kepala Sekolah', cls: 'bg-indigo-50 text-indigo-600' },
    admin_utama: { label: 'Admin Utama', cls: 'bg-indigo-50 text-indigo-600' },
    orang_tua: { label: 'Orang Tua/Wali', cls: 'bg-emerald-50 text-emerald-600' },
    superadmin: { label: 'Superadmin', cls: 'bg-slate-800 text-white' },
  }
  const key = jabatan || role
  const item = map[key] || { label: key || '—', cls: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${item.cls}`}>
      {item.label}
    </span>
  )
}
