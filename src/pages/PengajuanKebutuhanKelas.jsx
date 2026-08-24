import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  Send, CheckCircle2, XCircle, Clock, Loader2, PackagePlus, Trash2,
  ChevronDown, ChevronUp, MoreVertical, PackageCheck,
} from 'lucide-react'

const STATUS_STYLE = {
  menunggu: 'bg-brass-400/15 text-brass-600',
  disetujui: 'bg-sage-500/15 text-sage-500',
  ditolak: 'bg-red-100 text-red-600',
  selesai: 'bg-blue-100 text-blue-600',
}
const STATUS_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak', selesai: 'Selesai' }

const PRIORITAS_STYLE = {
  rendah: 'bg-ink-900/[0.06] text-ink-700/60',
  sedang: 'bg-brass-400/15 text-brass-600',
  tinggi: 'bg-red-100 text-red-600',
}
const PRIORITAS_LABEL = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' }

const KATEGORI_OPTIONS = [
  'Alat Tulis & ATK',
  'Mebel & Perabot',
  'Elektronik & IT',
  'Kebersihan',
  'Buku & Bahan Ajar',
  'Lainnya',
]

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FORM_KOSONG = {
  nama_barang: '',
  kategori: KATEGORI_OPTIONS[0],
  jumlah: 1,
  satuan: '',
  prioritas: 'sedang',
  deskripsi: '',
}

export default function PengajuanKebutuhanKelas() {
  const { profil, isAdmin, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // Dropdown aksi per item
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Data untuk GURU: kelas yang diampu + form pengajuan ---
  const [kelasAsuh, setKelasAsuh] = useState([])
  const [loadingKelas, setLoadingKelas] = useState(true)
  const [kelasTerpilih, setKelasTerpilih] = useState(null)
  const [form, setForm] = useState(FORM_KOSONG)
  const [mengajukan, setMengajukan] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pengajuan_kebutuhan_kelas')
      .select('*, kelas(nama_kelas), guru(nama_lengkap)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    async function loadKelasAsuh() {
      if (!profil?.guru_id) {
        setLoadingKelas(false)
        return
      }
      setLoadingKelas(true)
      const { data } = await supabase
        .from('kelas')
        .select('id, nama_kelas')
        .eq('wali_kelas_id', profil.guru_id)
        .order('nama_kelas')
      setKelasAsuh(data || [])
      if (data && data.length === 1) setKelasTerpilih(data[0])
      setLoadingKelas(false)
    }
    loadKelasAsuh()
  }, [profil])

  async function handleAjukan(e) {
    e.preventDefault()
    if (!kelasTerpilih || !form.nama_barang.trim()) return

    setMengajukan(true)
    const { error } = await supabase.from('pengajuan_kebutuhan_kelas').insert({
      kelas_id: kelasTerpilih.id,
      guru_id: profil.guru_id,
      nama_barang: form.nama_barang.trim(),
      kategori: form.kategori,
      jumlah: Number(form.jumlah) || 1,
      satuan: form.satuan.trim() || null,
      prioritas: form.prioritas,
      deskripsi: form.deskripsi.trim() || null,
    })
    setMengajukan(false)

    if (error) {
      alert('Gagal mengirim pengajuan: ' + error.message)
      return
    }
    setForm(FORM_KOSONG)
    await load()
  }

  async function handleApprove(item) {
    setOpenMenuId(null)
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_kebutuhan_kelas')
      .update({ status: 'disetujui', diproses_oleh: session.user.id, diproses_pada: new Date().toISOString() })
      .eq('id', item.id)
    if (error) alert('Gagal menyetujui pengajuan: ' + error.message)
    setProcessingId(null)
    await load()
  }

  async function handleReject(item) {
    const catatan = window.prompt('Alasan penolakan (opsional):')
    if (catatan === null) return // batal
    setOpenMenuId(null)
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_kebutuhan_kelas')
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

  async function handleSelesai(item) {
    setOpenMenuId(null)
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_kebutuhan_kelas')
      .update({ status: 'selesai' })
      .eq('id', item.id)
    if (error) alert('Gagal menandai selesai: ' + error.message)
    setProcessingId(null)
    await load()
  }

  async function handleHapus(item) {
    const konfirmasi = window.confirm(
      `Hapus pengajuan kebutuhan "${item.nama_barang}" untuk kelas "${item.kelas?.nama_kelas}"? Tindakan ini tidak bisa dibatalkan.`
    )
    if (!konfirmasi) return
    setOpenMenuId(null)
    setDeletingId(item.id)
    const { error } = await supabase.from('pengajuan_kebutuhan_kelas').delete().eq('id', item.id)
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
      title="Pengajuan Kebutuhan Kelas"
      subtitle={isAdmin ? 'Tinjau dan proses pengajuan kebutuhan barang/fasilitas dari wali kelas' : 'Ajukan kebutuhan barang atau fasilitas untuk kelas yang Anda ampu'}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <PackagePlus size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Pengajuan Kebutuhan Kelas</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? menungguCount > 0
                  ? `${menungguCount} pengajuan menunggu persetujuan`
                  : 'Semua pengajuan sudah diproses'
                : 'Ajukan kebutuhan kelas dan pantau statusnya di sini'}
            </p>
          </div>
        </div>
        <PackagePlus size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {/* ---------------- GURU: pilih kelas & ajukan form ---------------- */}
      {!isAdmin && (
        <div className="mb-6">
          {loadingKelas ? (
            <p className="text-sm text-ink-700/50">Memuat data kelas...</p>
          ) : kelasAsuh.length === 0 ? (
            <div className="card p-6">
              <p className="text-sm text-ink-700/60">
                Anda belum tercatat sebagai wali kelas di kelas manapun, jadi belum ada kelas yang bisa diajukan kebutuhannya.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAjukan} className="card p-6 space-y-3">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h3 className="font-display text-lg font-semibold">Ajukan Kebutuhan Kelas</h3>
                {kelasAsuh.length > 1 && (
                  <select
                    className="input-field w-auto"
                    value={kelasTerpilih?.id || ''}
                    onChange={(e) => setKelasTerpilih(kelasAsuh.find((k) => k.id === e.target.value) || null)}
                  >
                    <option value="" disabled>Pilih kelas</option>
                    {kelasAsuh.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                    ))}
                  </select>
                )}
                {kelasAsuh.length === 1 && (
                  <span className="text-xs font-medium text-ink-700/50">Kelas: {kelasAsuh[0].nama_kelas}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Nama Barang/Kebutuhan</label>
                  <input
                    className="input-field w-full"
                    type="text"
                    placeholder="mis. Spidol Whiteboard"
                    value={form.nama_barang}
                    onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Kategori</label>
                  <select
                    className="input-field w-full"
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  >
                    {KATEGORI_OPTIONS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Jumlah</label>
                  <input
                    className="input-field w-full"
                    type="number"
                    min={1}
                    value={form.jumlah}
                    onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">Satuan (opsional)</label>
                  <input
                    className="input-field w-full"
                    type="text"
                    placeholder="mis. buah, set, pak"
                    value={form.satuan}
                    onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Prioritas</label>
                  <div className="flex gap-2">
                    {Object.entries(PRIORITAS_LABEL).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm({ ...form, prioritas: val })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.prioritas === val
                            ? 'border-transparent ' + PRIORITAS_STYLE[val]
                            : 'border-ink-900/[0.1] text-ink-700/50 hover:bg-ink-900/[0.03]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Deskripsi/Alasan (opsional)</label>
                  <textarea
                    className="input-field w-full"
                    rows={2}
                    placeholder="mis. Spidol lama sudah habis tinta, dipakai setiap hari untuk KBM"
                    value={form.deskripsi}
                    onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" disabled={mengajukan || !kelasTerpilih} className="btn-primary">
                {mengajukan ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {mengajukan ? 'Mengirim...' : 'Ajukan Kebutuhan'}
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
              const bisaSelesai = isAdmin && item.status === 'disetujui'
              const bisaHapus = isAdmin || (item.guru_id === profil?.guru_id && item.status === 'menunggu')
              const adaAksi = bisaSetujuiTolak || bisaSelesai || bisaHapus

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
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${PRIORITAS_STYLE[item.prioritas]}`}>
                          {PRIORITAS_LABEL[item.prioritas]}
                        </span>
                        <span className="text-sm font-medium text-ink-900">{item.nama_barang}</span>
                        <span className="text-[11px] text-ink-700/40">
                          {item.jumlah} {item.satuan || ''}
                        </span>
                        {expanded ? <ChevronUp size={13} className="text-ink-700/40" /> : <ChevronDown size={13} className="text-ink-700/40" />}
                      </div>
                      <p className="text-xs text-ink-700/50 mt-1">
                        {item.kelas?.nama_kelas || 'Kelas'}
                        {isAdmin && <> · {item.guru?.nama_lengkap || 'Guru'}</>}
                        {' · '}{formatTanggal(item.dibuat_pada)}
                      </p>
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
                              {bisaSelesai && (
                                <button
                                  onClick={() => handleSelesai(item)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 text-left"
                                >
                                  <PackageCheck size={15} /> Tandai Selesai
                                </button>
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

                  {expanded && item.deskripsi && (
                    <div className="mt-3 rounded-lg bg-ink-900/[0.03] p-3">
                      <p className="text-xs text-ink-700/70">{item.deskripsi}</p>
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
