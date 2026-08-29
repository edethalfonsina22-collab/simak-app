import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock3 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

export default function PersetujuanAkun() {
  const { isSuperAdmin, sekolahId } = useAuth()
  const [tab, setTab] = useState('menunggu') // 'menunggu' | 'riwayat'
  const [filterJabatan, setFilterJabatan] = useState('semua') // 'semua' | 'guru' | 'admin_kepsek'
  const [daftarAkun, setDaftarAkun] = useState([])
  const [loading, setLoading] = useState(true)
  const [prosesId, setProsesId] = useState(null)

  async function muatData() {
    setLoading(true)
    let query = supabase
      .from('profil')
      .select(
        'id, role, status_akun, nama_lengkap_pendaftar, email_pendaftar, catatan_admin, dibuat_pada, sekolah_id, sekolah:sekolah_id(nama_sekolah)'
      )
      .order('dibuat_pada', { ascending: false })

    query = tab === 'menunggu' ? query.eq('status_akun', 'menunggu') : query.neq('status_akun', 'menunggu')

    // Admin utama hanya melihat pendaftar di sekolahnya sendiri; superadmin melihat semua sekolah.
    if (!isSuperAdmin) {
      query = query.eq('sekolah_id', sekolahId)
    }

    // Filter jabatan: pisahkan pendaftar Guru dari pendaftar Admin/Kepala Sekolah
    if (filterJabatan === 'guru') {
      query = query.eq('role', 'guru')
    } else if (filterJabatan === 'admin_kepsek') {
      query = query.in('role', ['admin', 'kepala_sekolah', 'admin_utama'])
    }

    const { data } = await query
    setDaftarAkun(data || [])
    setLoading(false)
  }

  useEffect(() => {
    muatData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterJabatan])

  async function ubahStatus(id, statusBaru, catatan = '') {
    setProsesId(id)
    await supabase
      .from('profil')
      .update({ status_akun: statusBaru, catatan_admin: catatan || null })
      .eq('id', id)
    setProsesId(null)
    muatData()
  }

  function handleTolak(id) {
    const catatan = window.prompt('Catatan penolakan (opsional):') || ''
    ubahStatus(id, 'ditolak', catatan)
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
                    <JabatanBadge role={akun.role} />
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
                          onClick={() => ubahStatus(akun.id, 'disetujui')}
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
    </Layout>
  )
}

function StatusBadge({ status }) {
  const map = {
    menunggu: { label: 'Menunggu', cls: 'bg-amber-50 text-amber-600', icon: Clock3 },
    disetujui: { label: 'Disetujui', cls: 'bg-green-50 text-green-600', icon: CheckCircle2 },
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

// Label & warna Jabatan supaya admin langsung paham peran pendaftar saat verifikasi
function JabatanBadge({ role }) {
  const map = {
    guru: { label: 'Guru', cls: 'bg-blue-50 text-blue-600' },
    admin: { label: 'Admin', cls: 'bg-purple-50 text-purple-600' },
    kepala_sekolah: { label: 'Kepala Sekolah', cls: 'bg-indigo-50 text-indigo-600' },
    admin_utama: { label: 'Admin Utama', cls: 'bg-indigo-50 text-indigo-600' },
    superadmin: { label: 'Superadmin', cls: 'bg-slate-800 text-white' },
  }
  const item = map[role] || { label: role || '—', cls: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${item.cls}`}>
      {item.label}
    </span>
  )
}
