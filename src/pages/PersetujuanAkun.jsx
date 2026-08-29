import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock3, X, UserCheck, UserPlus } from 'lucide-react'
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

  async function muatData() {
    setLoading(true)
    let query = supabase
      .from('profil')
      .select(
        'id, role, jabatan, status_akun, nama_lengkap_pendaftar, email_pendaftar, catatan_admin, dibuat_pada, sekolah_id, sekolah:sekolah_id(nama_sekolah)'
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
    }

    const { data } = await query
    setDaftarAkun(data || [])
    setLoading(false)
  }

  useEffect(() => {
    muatData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterJabatan])

  async function ubahStatus(id, statusBaru, catatan = '', guruId = null) {
    setProsesId(id)
    const payload = { status_akun: statusBaru, catatan_admin: catatan || null }
    if (guruId) payload.guru_id = guruId
    await supabase.from('profil').update(payload).eq('id', id)
    setProsesId(null)
    setModalGuru(null)
    muatData()
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
      </div>

      <div className="flex gap-2 mb-4">
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
      </div>

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
                {tab === 'menunggu' && <th className="text-right px-4 py-3 font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftarAkun.map((akun) => (
                <tr key={akun.id}>
                  <td className="px-4 py-3 text-slate-700">{akun.nama_lengkap_pendaftar || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{akun.email_pendaftar || '—'}</td>
                  <td className="px-4 py-3">
                    <JabatanBadge jabatan={akun.jabatan} role={akun.role} />
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-slate-500">{akun.sekolah?.nama_sekolah || '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    <StatusBadge status={akun.status_akun} />
                  </td>
                  {tab === 'menunggu' && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
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
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalGuru && (
        <ModalHubungkanGuru
          akun={modalGuru}
          onClose={() => setModalGuru(null)}
          onSelesai={(guruId) => ubahStatus(modalGuru.id, 'aktif', '', guruId)}
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
