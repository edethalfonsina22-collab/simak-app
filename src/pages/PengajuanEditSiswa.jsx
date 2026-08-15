import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  Send, CheckCircle2, XCircle, Clock, Loader2, UserCog, Trash2, ChevronDown, ChevronUp, User, MoreVertical,
} from 'lucide-react'

const STATUS_STYLE = {
  menunggu: 'bg-brass-400/15 text-brass-600',
  disetujui: 'bg-sage-500/15 text-sage-500',
  ditolak: 'bg-red-100 text-red-600',
}
const STATUS_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }

// ------------------------------------------------------------------
// Field yang boleh diajukan perubahannya oleh guru.
// ASUMSI: data pribadi/kontak siswa, BUKAN identitas administratif
// (NIS/NISN/NIK), kelas, atau status — itu tetap wewenang admin langsung
// lewat menu "Data Siswa". Gampang disesuaikan: tinggal tambah/hapus baris
// di array ini, form & tabel jsonb akan otomatis mengikuti.
// ------------------------------------------------------------------
const EDITABLE_FIELDS = [
  { field: 'nama_lengkap', label: 'Nama Lengkap', type: 'text' },
  { field: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: [['L', 'Laki-laki'], ['P', 'Perempuan']] },
  { field: 'agama', label: 'Agama', type: 'text' },
  { field: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
  { field: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
  { field: 'alamat', label: 'Alamat (sesuai KTP/KK)', type: 'textarea' },
  { field: 'alamat_tinggal', label: 'Alamat Tempat Tinggal', type: 'textarea' },
  { field: 'nama_ayah', label: 'Nama Ayah', type: 'text' },
  { field: 'nama_ibu', label: 'Nama Ibu', type: 'text' },
  { field: 'nama_orang_tua', label: 'Nama Orang Tua/Wali', type: 'text' },
  { field: 'no_hp_orang_tua', label: 'No. HP Orang Tua', type: 'text' },
  { field: 'pekerjaan_ayah', label: 'Pekerjaan Ayah', type: 'text' },
  { field: 'pekerjaan_ibu', label: 'Pekerjaan Ibu', type: 'text' },
  { field: 'pendidikan_ayah', label: 'Pendidikan Ayah', type: 'text' },
  { field: 'pendidikan_ibu', label: 'Pendidikan Ibu', type: 'text' },
  { field: 'nama_wali', label: 'Nama Wali', type: 'text' },
  { field: 'pekerjaan_wali', label: 'Pekerjaan Wali', type: 'text' },
  { field: 'alamat_wali', label: 'Alamat Wali', type: 'textarea' },
]

function displayValue(field, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'jenis_kelamin') return value === 'L' ? 'Laki-laki' : 'Perempuan'
  return String(value)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PengajuanEditSiswa() {
  const { profil, isAdmin, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // Dropdown aksi per item (Setujui / Tolak / Hapus)
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Data untuk GURU: kelas yang diampu + siswa di dalamnya, dan form pengajuan ---
  const [kelasAsuh, setKelasAsuh] = useState([])
  const [loadingSiswa, setLoadingSiswa] = useState(true)
  const [siswaTerpilih, setSiswaTerpilih] = useState(null)
  const [form, setForm] = useState({})
  const [alasan, setAlasan] = useState('')
  const [mengajukan, setMengajukan] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pengajuan_edit_siswa')
      .select('*, siswa(nama_lengkap, nis), guru(nama_lengkap)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    async function loadSiswaAsuh() {
      if (!profil?.guru_id) {
        setLoadingSiswa(false)
        return
      }
      setLoadingSiswa(true)
      const { data: kelasList } = await supabase
        .from('kelas')
        .select('id, nama_kelas')
        .eq('wali_kelas_id', profil.guru_id)
        .order('nama_kelas')

      if (!kelasList || kelasList.length === 0) {
        setKelasAsuh([])
        setLoadingSiswa(false)
        return
      }

      const kelasIds = kelasList.map((k) => k.id)
      const { data: siswaList } = await supabase
        .from('siswa')
        .select('*')
        .in('kelas_id', kelasIds)
        .eq('status', 'aktif')
        .order('nama_lengkap')

      setKelasAsuh(
        kelasList.map((k) => ({
          ...k,
          siswa: (siswaList || []).filter((s) => s.kelas_id === k.id),
        }))
      )
      setLoadingSiswa(false)
    }
    loadSiswaAsuh()
  }, [profil])

  function pilihSiswa(siswa) {
    setSiswaTerpilih(siswa)
    setForm(Object.fromEntries(EDITABLE_FIELDS.map((f) => [f.field, siswa[f.field] ?? ''])))
    setAlasan('')
  }

  async function handleAjukan(e) {
    e.preventDefault()
    if (!siswaTerpilih) return

    const perubahan = EDITABLE_FIELDS
      .map((f) => ({
        field: f.field,
        label: f.label,
        nilai_lama: siswaTerpilih[f.field] ?? '',
        nilai_baru: form[f.field] ?? '',
      }))
      .filter((p) => String(p.nilai_lama || '') !== String(p.nilai_baru || ''))

    if (perubahan.length === 0) {
      alert('Belum ada perubahan data. Ubah minimal satu field sebelum mengajukan.')
      return
    }

    setMengajukan(true)
    const { error } = await supabase.from('pengajuan_edit_siswa').insert({
      siswa_id: siswaTerpilih.id,
      guru_id: profil.guru_id,
      perubahan,
      alasan: alasan.trim() || null,
    })
    setMengajukan(false)

    if (error) {
      alert('Gagal mengirim pengajuan: ' + error.message)
      return
    }
    setSiswaTerpilih(null)
    setForm({})
    setAlasan('')
    await load()
  }

  // Setujui -> terapkan perubahan ke tabel siswa, lalu tandai disetujui
  async function handleApprove(item) {
    setOpenMenuId(null)
    setProcessingId(item.id)
    try {
      const payload = Object.fromEntries(item.perubahan.map((p) => [p.field, p.nilai_baru]))
      const { error: errSiswa } = await supabase.from('siswa').update(payload).eq('id', item.siswa_id)
      if (errSiswa) throw errSiswa

      const { error } = await supabase
        .from('pengajuan_edit_siswa')
        .update({ status: 'disetujui', diproses_oleh: session.user.id, diproses_pada: new Date().toISOString() })
        .eq('id', item.id)
      if (error) throw error

      await load()
    } catch (err) {
      alert('Gagal menyetujui pengajuan: ' + err.message)
    }
    setProcessingId(null)
  }

  async function handleReject(item) {
    const catatan = window.prompt('Alasan penolakan (opsional):')
    if (catatan === null) return // batal
    setOpenMenuId(null)
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_edit_siswa')
      .update({
        status: 'ditolak',
        catatan_admin: catatan || null,
        diproses_oleh: session.user.id,
        diproses_pada: new Date().toISOString(),
      })
      .eq('id', item.id)
    if (error) alert('Gagal menolak pengajuan: ' + error.message)
    setProcessingId(null)
    await load()
  }

  async function handleHapus(item) {
    const konfirmasi = window.confirm(
      `Hapus pengajuan perbaikan data untuk "${item.siswa?.nama_lengkap}"? Tindakan ini tidak bisa dibatalkan.`
    )
    if (!konfirmasi) return
    setOpenMenuId(null)
    setDeletingId(item.id)
    const { error } = await supabase.from('pengajuan_edit_siswa').delete().eq('id', item.id)
    setDeletingId(null)
    if (error) {
      alert('Gagal menghapus pengajuan: ' + error.message)
      return
    }
    await load()
  }

  const daftarTampil = isAdmin ? items : items.filter((i) => i.guru_id === profil?.guru_id)
  const menungguCount = items.filter((i) => i.status === 'menunggu').length

  return (
    <Layout
      title="Perbaikan Data Siswa"
      subtitle={isAdmin ? 'Tinjau dan proses pengajuan perbaikan data dari guru' : 'Ajukan perbaikan data siswa di kelas yang Anda ampu'}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <UserCog size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Perbaikan Data Siswa</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? menungguCount > 0
                  ? `${menungguCount} pengajuan menunggu persetujuan`
                  : 'Semua pengajuan sudah diproses'
                : 'Ajukan perbaikan data dan pantau statusnya di sini'}
            </p>
          </div>
        </div>
        <UserCog size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {/* ---------------- GURU: pilih siswa & ajukan form ---------------- */}
      {!isAdmin && (
        <div className="mb-6">
          {loadingSiswa ? (
            <p className="text-sm text-ink-700/50">Memuat data siswa...</p>
          ) : kelasAsuh.length === 0 ? (
            <div className="card p-6">
              <p className="text-sm text-ink-700/60">
                Anda belum tercatat sebagai wali kelas di kelas manapun, jadi belum ada siswa yang bisa diajukan perbaikan datanya.
              </p>
            </div>
          ) : !siswaTerpilih ? (
            <div className="card p-6">
              <h3 className="font-display text-lg font-semibold mb-4">Pilih Siswa</h3>
              <div className="space-y-4">
                {kelasAsuh.map((k) => (
                  <div key={k.id}>
                    <p className="text-xs font-semibold tracking-wide uppercase text-ink-700/40 mb-2">
                      {k.nama_kelas} ({k.siswa.length} siswa)
                    </p>
                    {k.siswa.length === 0 ? (
                      <p className="text-sm text-ink-700/50">Belum ada siswa aktif di kelas ini.</p>
                    ) : (
                      <ul className="divide-y divide-ink-900/[0.06] border border-ink-900/[0.06] rounded-lg overflow-hidden">
                        {k.siswa.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => pilihSiswa(s)}
                              className="w-full p-3 flex items-center gap-3 hover:bg-ink-900/[0.03] text-left"
                            >
                              <div className="w-9 h-9 rounded-full bg-ink-900/[0.06] flex items-center justify-center shrink-0">
                                <User size={15} className="text-ink-700/40" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink-950 truncate">{s.nama_lengkap}</p>
                                <p className="text-xs text-ink-700/50">NIS: {s.nis || '—'}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleAjukan} className="card p-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg font-semibold">
                  Ajukan Perbaikan: {siswaTerpilih.nama_lengkap}
                </h3>
                <button type="button" onClick={() => setSiswaTerpilih(null)} className="text-xs font-medium text-ink-700/50 hover:text-ink-900">
                  Batal, pilih siswa lain
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EDITABLE_FIELDS.map((f) => (
                  <div key={f.field} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="label-field">{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea
                        className="input-field w-full"
                        rows={2}
                        value={form[f.field] || ''}
                        onChange={(e) => setForm({ ...form, [f.field]: e.target.value })}
                      />
                    ) : f.type === 'select' ? (
                      <select
                        className="input-field w-full"
                        value={form[f.field] || ''}
                        onChange={(e) => setForm({ ...form, [f.field]: e.target.value })}
                      >
                        {f.options.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input-field w-full"
                        type={f.type}
                        value={form[f.field] || ''}
                        onChange={(e) => setForm({ ...form, [f.field]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="label-field">Alasan Perbaikan (opsional)</label>
                <textarea
                  className="input-field w-full"
                  rows={2}
                  placeholder="mis. Data lama salah ketik, sesuai KK terbaru, dll."
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                />
              </div>

              <button type="submit" disabled={mengajukan} className="btn-primary">
                {mengajukan ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {mengajukan ? 'Mengirim...' : 'Ajukan Perbaikan'}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">
          {isAdmin ? 'Semua Pengajuan' : 'Riwayat Pengajuan Saya'}
        </h3>
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : daftarTampil.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada pengajuan.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {daftarTampil.map((item) => {
              const expanded = expandedId === item.id
              const isProcessing = processingId === item.id || deletingId === item.id
              const bisaSetujuiTolak = isAdmin && item.status === 'menunggu'
              const bisaHapus = isAdmin || (item.guru_id === profil?.guru_id && item.status === 'menunggu')
              const adaAksi = bisaSetujuiTolak || bisaHapus

              return (
                <li key={item.id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${STATUS_STYLE[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                        <span className="text-sm font-medium text-ink-900">{item.siswa?.nama_lengkap || 'Siswa'}</span>
                        <span className="text-[11px] text-ink-700/40">{item.perubahan.length} field diubah</span>
                        {expanded ? <ChevronUp size={13} className="text-ink-700/40" /> : <ChevronDown size={13} className="text-ink-700/40" />}
                      </div>
                      <p className="text-xs text-ink-700/50 mt-1">
                        {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                        {formatTanggal(item.dibuat_pada)}
                      </p>
                      {item.alasan && <p className="text-xs text-ink-700/60 mt-1">Alasan: {item.alasan}</p>}
                      {item.status === 'ditolak' && item.catatan_admin && (
                        <p className="text-xs text-red-600 mt-1">Alasan ditolak: {item.catatan_admin}</p>
                      )}
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'menunggu' && !isAdmin && (
                        <span className="flex items-center gap-1.5 text-xs text-ink-700/40">
                          <Clock size={14} /> Menunggu persetujuan
                        </span>
                      )}

                      {adaAksi && (
                        <div className="relative" ref={openMenuId === item.id ? menuRef : null}>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                            disabled={isProcessing}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-700/50 hover:bg-ink-900/[0.06] disabled:opacity-50"
                            title="Aksi lainnya"
                          >
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
                          </button>

                          {openMenuId === item.id && (
                            <div className="absolute right-0 mt-1.5 w-44 card p-1.5 z-20 shadow-lg">
                              {bisaSetujuiTolak && (
                                <>
                                  <button
                                    onClick={() => handleApprove(item)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sage-500 hover:bg-sage-500/10 text-left"
                                  >
                                    <CheckCircle2 size={15} /> Setujui
                                  </button>
                                  <button
                                    onClick={() => handleReject(item)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 text-left"
                                  >
                                    <XCircle size={15} /> Tolak
                                  </button>
                                </>
                              )}
                              {bisaHapus && (
                                <button
                                  onClick={() => handleHapus(item)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 text-left"
                                >
                                  <Trash2 size={15} /> Hapus
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 rounded-lg bg-ink-900/[0.03] p-3 space-y-1.5">
                      {item.perubahan.map((c) => (
                        <div key={c.field} className="text-xs flex items-start justify-between gap-3">
                          <span className="text-ink-700/60 shrink-0">{c.label}</span>
                          <span className="text-right">
                            <span className="text-ink-700/40 line-through">{displayValue(c.field, c.nilai_lama)}</span>
                            {' → '}
                            <span className="text-ink-950 font-medium">{displayValue(c.field, c.nilai_baru)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Layout>
  )
}
