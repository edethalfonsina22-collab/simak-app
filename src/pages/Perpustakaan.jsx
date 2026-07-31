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
            ? <button className="btn-primary" onClick={openAddBuku}><Plus size={16} /> Tambah Buku</button>
            : <button className="btn-primary" onClick={openPinjam}><Plus size={16} /> Catat Peminjaman</button>
        )
      }
    >
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('buku')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'buku' ? 'bg-ink-950 text-paper' : 'bg-white text-ink-700/60 hover:bg-ink-900/5'}`}
        >
          Katalog Buku
        </button>
        <button
          onClick={() => setTab('peminjaman')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'peminjaman' ? 'bg-ink-950 text-paper' : 'bg-white text-ink-700/60 hover:bg-ink-900/5'}`}
        >
          Peminjaman
        </button>
      </div>

      {tab === 'buku' && (
        <>
          <div className="card p-4 mb-4">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                className="input-field pl-9"
                placeholder="Cari judul, penulis, atau kategori..."
                value={searchBuku}
                onChange={(e) => setSearchBuku(e.target.value)}
              />
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Judul</th><th>Penulis</th><th>Kategori</th><th>Rak</th><th>Stok Tersedia</th>{isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loadingBuku && <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
                {!loadingBuku && bukuTerfilter.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Belum ada buku.</td></tr>
                )}
                {bukuTerfilter.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.judul}</td>
                    <td>{b.penulis || '-'}</td>
                    <td>{b.kategori || '-'}</td>
                    <td>{b.rak || '-'}</td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        b.jumlah_tersedia > 0 ? 'bg-sage-500/10 text-sage-500' : 'bg-red-50 text-red-700'
                      }`}>
                        {b.jumlah_tersedia} / {b.jumlah_total}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button className="icon-btn" onClick={() => openEditBuku(b)}><Pencil size={15} /></button>
                          <button className="icon-btn text-red-600" onClick={() => hapusBuku(b.id)}><Trash2 size={15} /></button>
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPinjam === v ? 'bg-brass-400 text-ink-950' : 'bg-white text-ink-700/60 hover:bg-ink-900/5'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Judul Buku</th><th>Peminjam</th><th>Tgl Pinjam</th><th>Wajib Kembali</th><th>Status</th>{isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loadingPinjam && <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
                {!loadingPinjam && pinjamList.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Tidak ada data.</td></tr>
                )}
                {pinjamList.map((p) => {
                  const terlambat = !p.tanggal_kembali && p.tanggal_wajib_kembali < hariIni
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.buku?.judul || '-'}</td>
                      <td>{p.nama_peminjam} <span className="text-xs text-ink-700/40">({p.jenis_peminjam})</span></td>
                      <td>{p.tanggal_pinjam}</td>
                      <td>{p.tanggal_wajib_kembali}</td>
                      <td>
                        {p.tanggal_kembali ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-sage-500/10 text-sage-500">Dikembalikan</span>
                        ) : terlambat ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-50 text-red-700 flex items-center gap-1 w-fit">
                            <AlertCircle size={12} /> Terlambat
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-500/10 text-amber-600">Dipinjam</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          {!p.tanggal_kembali && (
                            <button className="icon-btn text-sage-500" onClick={() => tandaiKembali(p)} title="Tandai kembali">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{editingBukuId ? 'Ubah Buku' : 'Tambah Buku'}</h2>
              <button className="icon-btn" onClick={() => setShowFormBuku(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitBuku} className="space-y-3">
              <div>
                <label className="label-field">Judul Buku *</label>
                <input required className="input-field" value={formBuku.judul} onChange={(e) => setFormBuku({ ...formBuku, judul: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Penulis</label>
                  <input className="input-field" value={formBuku.penulis} onChange={(e) => setFormBuku({ ...formBuku, penulis: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Penerbit</label>
                  <input className="input-field" value={formBuku.penerbit} onChange={(e) => setFormBuku({ ...formBuku, penerbit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-field">Tahun Terbit</label>
                  <input className="input-field" value={formBuku.tahun_terbit} onChange={(e) => setFormBuku({ ...formBuku, tahun_terbit: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Kategori</label>
                  <input className="input-field" value={formBuku.kategori} onChange={(e) => setFormBuku({ ...formBuku, kategori: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Rak</label>
                  <input className="input-field" value={formBuku.rak} onChange={(e) => setFormBuku({ ...formBuku, rak: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label-field">Jumlah Eksemplar</label>
                <input type="number" min="1" className="input-field" value={formBuku.jumlah_total} onChange={(e) => setFormBuku({ ...formBuku, jumlah_total: e.target.value })} />
                {editingBukuId && (
                  <p className="text-xs text-ink-700/40 mt-1">Mengubah jumlah total tidak memengaruhi jumlah yang sedang dipinjam saat ini.</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowFormBuku(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={savingBuku}>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2"><BookOpen size={18} /> Catat Peminjaman</h2>
              <button className="icon-btn" onClick={() => setShowFormPinjam(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitPinjam} className="space-y-3">
              <div>
                <label className="label-field">Buku *</label>
                <select required className="input-field" value={formPinjam.buku_id} onChange={(e) => setFormPinjam({ ...formPinjam, buku_id: e.target.value })}>
                  <option value="">-- Pilih buku --</option>
                  {bukuList.filter((b) => b.jumlah_tersedia > 0).map((b) => (
                    <option key={b.id} value={b.id}>{b.judul} (tersedia: {b.jumlah_tersedia})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Jenis Peminjam</label>
                  <select className="input-field" value={formPinjam.jenis_peminjam} onChange={(e) => setFormPinjam({ ...formPinjam, jenis_peminjam: e.target.value, siswa_id: '' })}>
                    <option value="siswa">Siswa</option>
                    <option value="guru">Guru</option>
                  </select>
                </div>
                {formPinjam.jenis_peminjam === 'siswa' ? (
                  <div>
                    <label className="label-field">Nama Siswa</label>
                    <select
                      className="input-field"
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
                    <label className="label-field">Nama Guru</label>
                    <input
                      className="input-field"
                      value={formPinjam.nama_peminjam}
                      onChange={(e) => setFormPinjam({ ...formPinjam, nama_peminjam: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Tanggal Pinjam</label>
                  <input type="date" className="input-field" value={formPinjam.tanggal_pinjam} onChange={(e) => setFormPinjam({ ...formPinjam, tanggal_pinjam: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Wajib Kembali</label>
                  <input type="date" className="input-field" value={formPinjam.tanggal_wajib_kembali} onChange={(e) => setFormPinjam({ ...formPinjam, tanggal_wajib_kembali: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowFormPinjam(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={savingPinjam || !formPinjam.nama_peminjam}>
                  {savingPinjam && <Loader2 size={16} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
