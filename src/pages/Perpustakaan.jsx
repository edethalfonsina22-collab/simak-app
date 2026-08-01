import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { useAuth } from '../lib/AuthContext'
import {
  Plus, Pencil, Trash2, X, Loader2, Search, BookOpen, Undo2, AlertCircle,
} from 'lucide-react'

const emptyBukuForm = {
  judul: '', penulis: '', penerbit: '', tahun_terbit: '', kategori: '', rak: '', jumlah_total: 1,
}

const emptyPinjamForm = {
  buku_id: '', nama_peminjam: '', jenis_peminjam: 'siswa', siswa_id: '',
  tanggal_pinjam: new Date().toISOString().slice(0, 10),
  tanggal_wajib_kembali: '',
}

function tambahHari(tanggalStr, jumlahHari) {
  const d = new Date(tanggalStr)
  d.setDate(d.getDate() + jumlahHari)
  return d.toISOString().slice(0, 10)
}

export default function Perpustakaan() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('buku') // buku | peminjaman

  // --- state buku ---
  const [bukuList, setBukuList] = useState([])
  const [loadingBuku, setLoadingBuku] = useState(true)
  const [searchBuku, setSearchBuku] = useState('')
  const [showFormBuku, setShowFormBuku] = useState(false)
  const [editingBukuId, setEditingBukuId] = useState(null)
  const [formBuku, setFormBuku] = useState(emptyBukuForm)
  const [savingBuku, setSavingBuku] = useState(false)

  // --- state peminjaman ---
  const [pinjamList, setPinjamList] = useState([])
  const [loadingPinjam, setLoadingPinjam] = useState(true)
  const [filterPinjam, setFilterPinjam] = useState('dipinjam') // dipinjam | dikembalikan | semua
  const [showFormPinjam, setShowFormPinjam] = useState(false)
  const [formPinjam, setFormPinjam] = useState(emptyPinjamForm)
  const [savingPinjam, setSavingPinjam] = useState(false)
  const [siswaList, setSiswaList] = useState([])

  async function muatBuku() {
    setLoadingBuku(true)
    const { data } = await supabase.from('buku').select('*').order('judul')
    setBukuList(data || [])
    setLoadingBuku(false)
  }

  async function muatPinjam() {
    setLoadingPinjam(true)
    let query = supabase.from('peminjaman_buku').select('*, buku:buku_id(judul)').order('tanggal_pinjam', { ascending: false })
    if (filterPinjam === 'dipinjam') query = query.is('tanggal_kembali', null)
    if (filterPinjam === 'dikembalikan') query = query.not('tanggal_kembali', 'is', null)
    const { data } = await query
    setPinjamList(data || [])
    setLoadingPinjam(false)
  }

  useEffect(() => { muatBuku() }, [])
  useEffect(() => { muatPinjam() }, [filterPinjam])
  useEffect(() => {
    supabase.from('siswa').select('id, nama_lengkap').order('nama_lengkap').then(({ data }) => setSiswaList(data || []))
  }, [])

  // --- CRUD buku ---
  function openAddBuku() {
    setFormBuku(emptyBukuForm)
    setEditingBukuId(null)
    setShowFormBuku(true)
  }
  function openEditBuku(b) {
    setFormBuku({ ...emptyBukuForm, ...b })
    setEditingBukuId(b.id)
    setShowFormBuku(true)
  }
  async function handleSubmitBuku(e) {
    e.preventDefault()
    setSavingBuku(true)
    const total = Number(formBuku.jumlah_total) || 1
    const payload = editingBukuId
      ? { ...formBuku, jumlah_total: total }
      : { ...formBuku, jumlah_total: total, jumlah_tersedia: total }
    delete payload.jumlah_tersedia_lama
    const { error } = editingBukuId
      ? await supabase.from('buku').update({
          judul: formBuku.judul, penulis: formBuku.penulis, penerbit: formBuku.penerbit,
          tahun_terbit: formBuku.tahun_terbit, kategori: formBuku.kategori, rak: formBuku.rak,
          jumlah_total: total,
        }).eq('id', editingBukuId)
      : await supabase.from('buku').insert(payload)
    setSavingBuku(false)
    if (!error) { setShowFormBuku(false); muatBuku() }
    else alert('Gagal menyimpan: ' + error.message)
  }
  async function hapusBuku(id) {
    if (!confirm('Hapus buku ini? Riwayat peminjamannya juga akan terhapus.')) return
    const { error } = await supabase.from('buku').delete().eq('id', id)
    if (!error) muatBuku()
    else alert('Gagal menghapus: ' + error.message)
  }

  // --- Peminjaman ---
  function openPinjam() {
    setFormPinjam({ ...emptyPinjamForm, tanggal_wajib_kembali: tambahHari(new Date().toISOString().slice(0, 10), 7) })
    setShowFormPinjam(true)
  }

  async function handleSubmitPinjam(e) {
    e.preventDefault()
    if (!formPinjam.buku_id) return
    setSavingPinjam(true)
    const buku = bukuList.find((b) => b.id === formPinjam.buku_id)
    if (!buku || buku.jumlah_tersedia <= 0) {
      alert('Stok buku ini sedang habis / sedang dipinjam semua.')
      setSavingPinjam(false)
      return
    }
    const payload = { ...formPinjam, siswa_id: formPinjam.siswa_id || null }
    const { error: errPinjam } = await supabase.from('peminjaman_buku').insert(payload)
    if (!errPinjam) {
      await supabase.from('buku').update({ jumlah_tersedia: buku.jumlah_tersedia - 1 }).eq('id', buku.id)
    }
    setSavingPinjam(false)
    if (!errPinjam) {
      setShowFormPinjam(false)
      muatBuku()
      muatPinjam()
    } else {
      alert('Gagal menyimpan: ' + errPinjam.message)
    }
  }

  async function tandaiKembali(p) {
    if (!confirm(`Tandai "${p.buku?.judul}" (dipinjam oleh ${p.nama_peminjam}) sudah dikembalikan?`)) return
    const { error: errUpdate } = await supabase
      .from('peminjaman_buku')
      .update({ tanggal_kembali: new Date().toISOString().slice(0, 10) })
      .eq('id', p.id)
    if (!errUpdate) {
      const buku = bukuList.find((b) => b.id === p.buku_id)
      if (buku) {
        await supabase.from('buku').update({ jumlah_tersedia: buku.jumlah_tersedia + 1 }).eq('id', buku.id)
      }
      muatBuku()
      muatPinjam()
    } else {
      alert('Gagal: ' + errUpdate.message)
    }
  }

  const bukuTerfilter = bukuList.filter((b) =>
    `${b.judul} ${b.penulis} ${b.kategori}`.toLowerCase().includes(searchBuku.toLowerCase())
  )

  const hariIni = new Date().toISOString().slice(0, 10)

  return (
    <Layout
      title="Perpustakaan Sekolah"
      subtitle="Katalog buku & peminjaman"
      actions={
        isAdmin && (
          tab === 'buku'
            ? <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors shadow-sm shadow-[#6b0f1a]/30" onClick={openAddBuku}><Plus size={16} /> Tambah Buku</button>
            : <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors shadow-sm shadow-[#6b0f1a]/30" onClick={openPinjam}><Plus size={16} /> Catat Peminjaman</button>
        )
      }
    >
      <div className="min-h-screen bg-gradient-to-b from-[#fdf3f1] to-[#f7e6e3] -m-4 p-4 rounded-xl">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('buku')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'buku' ? 'bg-[#6b0f1a] text-white shadow-sm shadow-[#6b0f1a]/30' : 'bg-white text-[#6b0f1a]/60 hover:bg-[#6b0f1a]/5'}`}
        >
          Katalog Buku
        </button>
        <button
          onClick={() => setTab('peminjaman')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'peminjaman' ? 'bg-[#6b0f1a] text-white shadow-sm shadow-[#6b0f1a]/30' : 'bg-white text-[#6b0f1a]/60 hover:bg-[#6b0f1a]/5'}`}
        >
          Peminjaman
        </button>
      </div>

      {tab === 'buku' && (
        <>
          <div className="bg-white rounded-xl border border-[#6b0f1a]/10 shadow-sm p-4 mb-4">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b0f1a]/40" />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                placeholder="Cari judul, penulis, atau kategori..."
                value={searchBuku}
                onChange={(e) => setSearchBuku(e.target.value)}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#6b0f1a]/10 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#6b0f1a] text-white">
                  <th className="text-left px-4 py-3 font-medium">Judul</th>
                  <th className="text-left px-4 py-3 font-medium">Penulis</th>
                  <th className="text-left px-4 py-3 font-medium">Kategori</th>
                  <th className="text-left px-4 py-3 font-medium">Rak</th>
                  <th className="text-left px-4 py-3 font-medium">Stok Tersedia</th>
                  {isAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#6b0f1a]/8">
                {loadingBuku && <tr><td colSpan={6} className="text-center py-8 text-[#6b0f1a]/50">Memuat data...</td></tr>}
                {!loadingBuku && bukuTerfilter.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-[#6b0f1a]/50">Belum ada buku.</td></tr>
                )}
                {bukuTerfilter.map((b) => (
                  <tr key={b.id} className="hover:bg-[#6b0f1a]/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-[#3b0a0a]">{b.judul}</td>
                    <td className="px-4 py-3">{b.penulis || '-'}</td>
                    <td className="px-4 py-3">{b.kategori || '-'}</td>
                    <td className="px-4 py-3">{b.rak || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        b.jumlah_tersedia > 0 ? 'bg-[#d4a017]/15 text-[#8a6a0d]' : 'bg-[#6b0f1a]/10 text-[#6b0f1a]'
                      }`}>
                        {b.jumlah_tersedia} / {b.jumlah_total}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#6b0f1a] transition-colors" onClick={() => openEditBuku(b)}><Pencil size={15} /></button>
                          <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#8f1f22]" onClick={() => hapusBuku(b.id)}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'peminjaman' && (
        <>
          <div className="flex gap-2 mb-4">
            {[['dipinjam', 'Sedang Dipinjam'], ['dikembalikan', 'Sudah Dikembalikan'], ['semua', 'Semua']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterPinjam(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPinjam === v ? 'bg-[#d4a017] text-[#3b0a0a]' : 'bg-white text-[#6b0f1a]/60 hover:bg-[#6b0f1a]/5'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-[#6b0f1a]/10 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#6b0f1a] text-white">
                  <th className="text-left px-4 py-3 font-medium">Judul Buku</th>
                  <th className="text-left px-4 py-3 font-medium">Peminjam</th>
                  <th className="text-left px-4 py-3 font-medium">Tgl Pinjam</th>
                  <th className="text-left px-4 py-3 font-medium">Wajib Kembali</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#6b0f1a]/8">
                {loadingPinjam && <tr><td colSpan={6} className="text-center py-8 text-[#6b0f1a]/50">Memuat data...</td></tr>}
                {!loadingPinjam && pinjamList.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-[#6b0f1a]/50">Tidak ada data.</td></tr>
                )}
                {pinjamList.map((p) => {
                  const terlambat = !p.tanggal_kembali && p.tanggal_wajib_kembali < hariIni
                  return (
                    <tr key={p.id} className="hover:bg-[#6b0f1a]/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#3b0a0a]">{p.buku?.judul || '-'}</td>
                      <td className="px-4 py-3">{p.nama_peminjam} <span className="text-xs text-[#6b0f1a]/40">({p.jenis_peminjam})</span></td>
                      <td className="px-4 py-3">{p.tanggal_pinjam}</td>
                      <td className="px-4 py-3">{p.tanggal_wajib_kembali}</td>
                      <td className="px-4 py-3">
                        {p.tanggal_kembali ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-[#d4a017]/15 text-[#8a6a0d]">Dikembalikan</span>
                        ) : terlambat ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-[#6b0f1a]/10 text-[#6b0f1a] flex items-center gap-1 w-fit">
                            <AlertCircle size={12} /> Terlambat
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-[#b02e35]/10 text-[#8f1f22]">Dipinjam</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {!p.tanggal_kembali && (
                            <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#d4a017]" onClick={() => tandaiKembali(p)} title="Tandai kembali">
                              <Undo2 size={15} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Tambah/Edit Buku */}
      {showFormBuku && (
        <div className="fixed inset-0 bg-[#3b0a0a]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 border-t-4 border-[#6b0f1a]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-[#3b0a0a]">{editingBukuId ? 'Ubah Buku' : 'Tambah Buku'}</h2>
              <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#6b0f1a]" onClick={() => setShowFormBuku(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitBuku} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Judul Buku *</label>
                <input required className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.judul} onChange={(e) => setFormBuku({ ...formBuku, judul: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Penulis</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.penulis} onChange={(e) => setFormBuku({ ...formBuku, penulis: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Penerbit</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.penerbit} onChange={(e) => setFormBuku({ ...formBuku, penerbit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Tahun Terbit</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.tahun_terbit} onChange={(e) => setFormBuku({ ...formBuku, tahun_terbit: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Kategori</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.kategori} onChange={(e) => setFormBuku({ ...formBuku, kategori: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Rak</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.rak} onChange={(e) => setFormBuku({ ...formBuku, rak: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Jumlah Eksemplar</label>
                <input type="number" min="1" className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formBuku.jumlah_total} onChange={(e) => setFormBuku({ ...formBuku, jumlah_total: e.target.value })} />
                {editingBukuId && (
                  <p className="text-xs text-[#6b0f1a]/40 mt-1">Mengubah jumlah total tidak memengaruhi jumlah yang sedang dipinjam saat ini.</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f7e6e3] text-[#6b0f1a] hover:bg-[#efd3ce] transition-colors" onClick={() => setShowFormBuku(false)}>Batal</button>
                <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors" disabled={savingBuku}>
                  {savingBuku && <Loader2 size={16} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Peminjaman */}
      {showFormPinjam && (
        <div className="fixed inset-0 bg-[#3b0a0a]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 border-t-4 border-[#6b0f1a]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-[#3b0a0a]"><BookOpen size={18} className="text-[#6b0f1a]" /> Catat Peminjaman</h2>
              <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#6b0f1a]" onClick={() => setShowFormPinjam(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitPinjam} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Buku *</label>
                <select required className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formPinjam.buku_id} onChange={(e) => setFormPinjam({ ...formPinjam, buku_id: e.target.value })}>
                  <option value="">-- Pilih buku --</option>
                  {bukuList.filter((b) => b.jumlah_tersedia > 0).map((b) => (
                    <option key={b.id} value={b.id}>{b.judul} (tersedia: {b.jumlah_tersedia})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Jenis Peminjam</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formPinjam.jenis_peminjam} onChange={(e) => setFormPinjam({ ...formPinjam, jenis_peminjam: e.target.value, siswa_id: '' })}>
                    <option value="siswa">Siswa</option>
                    <option value="guru">Guru</option>
                  </select>
                </div>
                {formPinjam.jenis_peminjam === 'siswa' ? (
                  <div>
                    <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Nama Siswa</label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                      value={formPinjam.siswa_id}
                      onChange={(e) => {
                        const s = siswaList.find((x) => x.id === e.target.value)
                        setFormPinjam({ ...formPinjam, siswa_id: e.target.value, nama_peminjam: s?.nama_lengkap || '' })
                      }}
                    >
                      <option value="">-- Pilih siswa --</option>
                      {siswaList.map((s) => <option key={s.id} value={s.id}>{s.nama_lengkap}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Nama Guru</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                      value={formPinjam.nama_peminjam}
                      onChange={(e) => setFormPinjam({ ...formPinjam, nama_peminjam: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Tanggal Pinjam</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formPinjam.tanggal_pinjam} onChange={(e) => setFormPinjam({ ...formPinjam, tanggal_pinjam: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Wajib Kembali</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={formPinjam.tanggal_wajib_kembali} onChange={(e) => setFormPinjam({ ...formPinjam, tanggal_wajib_kembali: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f7e6e3] text-[#6b0f1a] hover:bg-[#efd3ce] transition-colors" onClick={() => setShowFormPinjam(false)}>Batal</button>
                <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors disabled:opacity-50" disabled={savingPinjam || !formPinjam.nama_peminjam}>
                  {savingPinjam && <Loader2 size={16} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </Layout>
  )
}
