import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  Plus, Pencil, Trash2, X, Loader2, TrendingUp, TrendingDown, PiggyBank,
} from 'lucide-react'

const KATEGORI_MASUK = ['Kas Kelas', 'Iuran', 'Sumbangan', 'Lainnya']
const KATEGORI_KELUAR = ['Konsumsi', 'ATK Kelas', 'Kebersihan Kelas', 'Kegiatan Kelas', 'Lainnya']

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const emptyForm = {
  jenis: 'masuk',
  kategori: 'Kas Kelas',
  jumlah: '',
  tanggal: new Date().toISOString().slice(0, 10),
  keterangan: '',
}

export default function KeuanganKelas() {
  const { profil, isAdmin } = useAuth()

  // Daftar kelas yang bisa dipilih: guru -> kelas yang dia ampu sbg wali kelas,
  // admin -> semua kelas (supaya bisa memantau kas kelas manapun)
  const [daftarKelas, setDaftarKelas] = useState([])
  const [loadingKelas, setLoadingKelas] = useState(true)
  const [kelasTerpilih, setKelasTerpilih] = useState(null)

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // --- Ambil daftar kelas sesuai peran ---
  useEffect(() => {
    async function loadKelas() {
      setLoadingKelas(true)
      let query = supabase.from('kelas').select('id, nama_kelas').order('nama_kelas')
      if (!isAdmin) {
        if (!profil?.guru_id) {
          setDaftarKelas([])
          setLoadingKelas(false)
          return
        }
        query = query.eq('wali_kelas_id', profil.guru_id)
      }
      const { data: rows } = await query
      setDaftarKelas(rows || [])
      if (rows && rows.length === 1) setKelasTerpilih(rows[0])
      setLoadingKelas(false)
    }
    loadKelas()
  }, [profil, isAdmin])

  // --- Ambil transaksi kas untuk kelas yang dipilih ---
  async function loadData() {
    if (!kelasTerpilih) {
      setData([])
      return
    }
    setLoading(true)
    const { data: rows } = await supabase
      .from('keuangan_kelas')
      .select('*')
      .eq('kelas_id', kelasTerpilih.id)
      .order('tanggal', { ascending: false })
      .order('dibuat_pada', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelasTerpilih])

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({
      jenis: row.jenis,
      kategori: row.kategori,
      jumlah: row.jumlah,
      tanggal: row.tanggal,
      keterangan: row.keterangan || '',
    })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!kelasTerpilih) return
    setSaving(true)
    const payload = {
      kelas_id: kelasTerpilih.id,
      guru_id: profil?.guru_id || null,
      jenis: form.jenis,
      kategori: form.kategori,
      jumlah: Number(form.jumlah) || 0,
      tanggal: form.tanggal,
      keterangan: form.keterangan.trim() || null,
    }
    const { error } = editingId
      ? await supabase.from('keuangan_kelas').update(payload).eq('id', editingId)
      : await supabase.from('keuangan_kelas').insert(payload)
    setSaving(false)
    if (error) {
      alert('Gagal menyimpan: ' + error.message)
      return
    }
    setShowForm(false)
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus transaksi kas kelas ini?')) return
    const { error } = await supabase.from('keuangan_kelas').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    loadData()
  }

  const totalMasuk = data.filter((d) => d.jenis === 'masuk').reduce((a, b) => a + Number(b.jumlah), 0)
  const totalKeluar = data.filter((d) => d.jenis === 'keluar').reduce((a, b) => a + Number(b.jumlah), 0)
  const saldo = totalMasuk - totalKeluar

  return (
    <Layout
      title="Keuangan Kelas"
      subtitle={isAdmin ? 'Pantau kas kelas yang dipegang wali kelas' : 'Catat kas/iuran kelas yang Anda ampu sebagai wali kelas'}
      actions={
        kelasTerpilih ? (
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} /> Tambah Transaksi
          </button>
        ) : null
      }
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <PiggyBank size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Kas Kelas</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? 'Lihat catatan uang masuk, uang keluar, dan saldo tiap kelas'
                : 'Catat uang masuk & keluar kas kelas, saldo dihitung otomatis'}
            </p>
          </div>
        </div>
        <PiggyBank size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {/* ---------------- Pilih kelas ---------------- */}
      {loadingKelas ? (
        <p className="text-sm text-ink-700/50 mb-6">Memuat data kelas...</p>
      ) : daftarKelas.length === 0 ? (
        <div className="card p-6 mb-6">
          <p className="text-sm text-ink-700/60">
            {isAdmin
              ? 'Belum ada data kelas.'
              : 'Anda belum tercatat sebagai wali kelas di kelas manapun, jadi belum ada kas kelas yang bisa dikelola.'}
          </p>
        </div>
      ) : (
        <div className="card p-4 mb-6 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-medium text-ink-700/50 shrink-0">Kelas</label>
          <select
            className="input-field w-auto"
            value={kelasTerpilih?.id || ''}
            onChange={(e) => setKelasTerpilih(daftarKelas.find((k) => k.id === e.target.value) || null)}
          >
            <option value="" disabled>Pilih kelas</option>
            {daftarKelas.map((k) => (
              <option key={k.id} value={k.id}>{k.nama_kelas}</option>
            ))}
          </select>
        </div>
      )}

      {kelasTerpilih && (
        <>
          {/* ---------------- Ringkasan: masuk, keluar, saldo ---------------- */}
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-sage-500/10 flex items-center justify-center text-sage-500">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Uang Masuk</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalMasuk)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <TrendingDown size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Uang Keluar</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalKeluar)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-brass-400/20 flex items-center justify-center text-brass-600">
                <PiggyBank size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Total Saldo</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(saldo)}</p>
              </div>
            </div>
          </div>

          {/* ---------------- Tabel transaksi ---------------- */}
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th>Kategori</th>
                  <th>Keterangan</th>
                  <th>Jumlah</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
                )}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">
                    Belum ada transaksi kas untuk kelas {kelasTerpilih.nama_kelas}.
                  </td></tr>
                )}
                {data.map((r) => (
                  <tr key={r.id}>
                    <td>{formatTanggal(r.tanggal)}</td>
                    <td>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                        r.jenis === 'masuk' ? 'bg-sage-500/15 text-sage-500' : 'bg-red-100 text-red-600'
                      }`}>
                        {r.jenis === 'masuk' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td>{r.kategori}</td>
                    <td>{r.keterangan || '-'}</td>
                    <td className={`font-medium ${r.jenis === 'masuk' ? 'text-sage-500' : 'text-red-600'}`}>
                      {r.jenis === 'masuk' ? '+ ' : '- '}{formatRupiah(r.jumlah)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button className="icon-btn" onClick={() => openEdit(r)} title="Ubah">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn text-red-600" onClick={() => handleDelete(r.id)} title="Hapus">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------------- Modal tambah/ubah transaksi ---------------- */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">
                {editingId ? 'Ubah Transaksi' : 'Tambah Transaksi'} — {kelasTerpilih?.nama_kelas}
              </h2>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Jenis</label>
                  <select
                    className="input-field"
                    value={form.jenis}
                    onChange={(e) => setForm({
                      ...form,
                      jenis: e.target.value,
                      kategori: e.target.value === 'masuk' ? KATEGORI_MASUK[0] : KATEGORI_KELUAR[0],
                    })}
                  >
                    <option value="masuk">Uang Masuk</option>
                    <option value="keluar">Uang Keluar</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Kategori</label>
                  <select
                    className="input-field"
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  >
                    {(form.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Jumlah (Rp) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.jumlah}
                    onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">Tanggal *</label>
                  <input
                    required
                    type="date"
                    className="input-field"
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label-field">Keterangan</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="mis. Kas mingguan minggu ke-3 Agustus"
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
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
