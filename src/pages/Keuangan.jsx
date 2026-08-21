import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { eksporExcel, eksporPDF } from '../lib/exportUtils'
import ArkasImportModal from '../components/ArkasImportModal'
import BkuImportModal from '../components/BkuImportModal'
import {
  Plus, Pencil, Trash2, X, Loader2, TrendingUp, TrendingDown, Wallet,
  FileDown, FileSpreadsheet, BookOpen, ClipboardList,
} from 'lucide-react'

const KATEGORI_MASUK = ['SPP', 'Donasi', 'Dana BOS', 'Sumbangan', 'Lainnya']
const KATEGORI_KELUAR = ['Gaji/Honor', 'ATK', 'Listrik & Air', 'Perawatan Gedung', 'Kegiatan Siswa', 'Lainnya']

const MENU_TABS = [
  { key: 'transaksi', label: 'Transaksi', icon: Wallet },
  { key: 'arkas', label: 'ARKAS', icon: ClipboardList },
  { key: 'bku', label: 'BKU', icon: BookOpen },
]

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const emptyForm = {
  jenis: 'masuk',
  kategori: 'SPP',
  siswa_id: '',
  jumlah: '',
  tanggal: new Date().toISOString().slice(0, 10),
  catatan: '',
}

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

export default function Keuangan() {
  const now = new Date()
  const [menu, setMenu] = useState('transaksi') // 'transaksi' | 'arkas' | 'bku'
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())

  // Tab Transaksi
  const [data, setData] = useState([])
  const [siswaList, setSiswaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Tab ARKAS
  const [arkasData, setArkasData] = useState([])
  const [loadingArkas, setLoadingArkas] = useState(false)

  // Tab BKU
  const [bkuData, setBkuData] = useState([])
  const [loadingBku, setLoadingBku] = useState(false)

  async function loadData() {
    setLoading(true)
    const awal = `${tahun}-${String(bulan).padStart(2, '0')}-01`
    const akhirDate = new Date(tahun, bulan, 0).getDate()
    const akhir = `${tahun}-${String(bulan).padStart(2, '0')}-${String(akhirDate).padStart(2, '0')}`
    const { data: rows } = await supabase
      .from('keuangan')
      .select('*, siswa:siswa_id(nama_lengkap)')
      .gte('tanggal', awal)
      .lte('tanggal', akhir)
      .order('tanggal', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  async function loadArkasData() {
    setLoadingArkas(true)
    const { data: rows } = await supabase
      .from('arkas_anggaran')
      .select('*')
      .eq('tahun_anggaran', String(tahun))
      .order('no_urut', { ascending: true })
    setArkasData(rows || [])
    setLoadingArkas(false)
  }

  async function loadBkuData() {
    setLoadingBku(true)
    const { data: rows } = await supabase
      .from('bku_kas')
      .select('*')
      .eq('tahun', tahun)
      .eq('bulan', bulan)
      .order('tanggal', { ascending: true })
    setBkuData(rows || [])
    setLoadingBku(false)
  }

  useEffect(() => {
    if (menu === 'transaksi') loadData()
    if (menu === 'arkas') loadArkasData()
    if (menu === 'bku') loadBkuData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, bulan, tahun])

  useEffect(() => {
    supabase.from('siswa').select('id, nama_lengkap').order('nama_lengkap').then(({ data }) => setSiswaList(data || []))
  }, [])

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({ ...emptyForm, ...row, siswa_id: row.siswa_id || '' })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      jumlah: Number(form.jumlah) || 0,
      siswa_id: form.siswa_id || null,
    }
    delete payload.siswa
    const { error } = editingId
      ? await supabase.from('keuangan').update(payload).eq('id', editingId)
      : await supabase.from('keuangan').insert(payload)
    setSaving(false)
    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus transaksi ini?')) return
    const { error } = await supabase.from('keuangan').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  async function handleHapusSemuaArkas() {
    if (arkasData.length === 0) return
    const konfirmasi = confirm(
      `Semua data ARKAS tahun ${tahun} (${arkasData.length} baris) akan DIHAPUS PERMANEN. Tindakan ini tidak bisa dibatalkan. Lanjutkan?`
    )
    if (!konfirmasi) return
    setLoadingArkas(true)
    const { error } = await supabase.from('arkas_anggaran').delete().eq('tahun_anggaran', String(tahun))
    setLoadingArkas(false)
    if (!error) loadArkasData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const totalMasuk = data.filter((d) => d.jenis === 'masuk').reduce((a, b) => a + Number(b.jumlah), 0)
  const totalKeluar = data.filter((d) => d.jenis === 'keluar').reduce((a, b) => a + Number(b.jumlah), 0)
  const saldo = totalMasuk - totalKeluar

  const totalPenerimaanBku = bkuData.reduce((a, b) => a + Number(b.penerimaan || 0), 0)
  const totalPengeluaranBku = bkuData.reduce((a, b) => a + Number(b.pengeluaran || 0), 0)

  function handleExportPDF() {
    const kolom = ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah']
    const baris = data.map((d) => [
      d.tanggal,
      d.jenis === 'masuk' ? 'Masuk' : 'Keluar',
      d.kategori,
      d.siswa?.nama_lengkap || d.catatan || '-',
      formatRupiah(d.jumlah),
    ])
    baris.push(['', '', '', 'Total Masuk', formatRupiah(totalMasuk)])
    baris.push(['', '', '', 'Total Keluar', formatRupiah(totalKeluar)])
    baris.push(['', '', '', 'Saldo', formatRupiah(saldo)])
    eksporPDF(`Laporan Keuangan — ${bulan}/${tahun}`, kolom, baris, `keuangan-${tahun}-${bulan}`)
  }

  function handleExportExcel() {
    eksporExcel(
      data.map((d) => ({
        Tanggal: d.tanggal,
        Jenis: d.jenis === 'masuk' ? 'Masuk' : 'Keluar',
        Kategori: d.kategori,
        Siswa: d.siswa?.nama_lengkap || '-',
        Keterangan: d.catatan || '-',
        Jumlah: d.jumlah,
      })),
      `keuangan-${tahun}-${bulan}`,
      'Keuangan'
    )
  }

  function handleExportBkuPDF() {
    const kolom = ['Tanggal', 'No. Bukti', 'Uraian', 'Penerimaan', 'Pengeluaran', 'Saldo']
    let saldoBerjalan = 0
    const baris = bkuData.map((d) => {
      saldoBerjalan += Number(d.penerimaan || 0) - Number(d.pengeluaran || 0)
      return [
        d.tanggal,
        d.no_bukti || '-',
        d.uraian || '-',
        d.penerimaan ? formatRupiah(d.penerimaan) : '-',
        d.pengeluaran ? formatRupiah(d.pengeluaran) : '-',
        formatRupiah(saldoBerjalan),
      ]
    })
    baris.push(['', '', 'Total', formatRupiah(totalPenerimaanBku), formatRupiah(totalPengeluaranBku), formatRupiah(saldoBerjalan)])
    eksporPDF(`Buku Kas Umum — ${NAMA_BULAN[bulan - 1]} ${tahun}`, kolom, baris, `bku-${tahun}-${bulan}`)
  }

  return (
    <Layout
      title="Keuangan Sekolah"
      subtitle="Kas & SPP"
      actions={
        menu === 'transaksi' ? (
          <>
            <button className="btn-secondary" onClick={handleExportPDF}><FileDown size={16} /> PDF</button>
            <button className="btn-secondary" onClick={handleExportExcel}><FileSpreadsheet size={16} /> Excel</button>
            <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Tambah Transaksi</button>
          </>
        ) : menu === 'arkas' ? (
          <>
            <button
              className="btn-secondary text-red-600"
              onClick={handleHapusSemuaArkas}
              disabled={arkasData.length === 0 || loadingArkas}
            >
              <Trash2 size={16} /> Hapus Semua
            </button>
            <ArkasImportModal tahunAnggaran={String(tahun)} onSelesai={loadArkasData} />
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={handleExportBkuPDF}><FileDown size={16} /> Ekspor PDF</button>
            <BkuImportModal bulan={bulan} tahun={tahun} onSelesai={loadBkuData} />
          </>
        )
      }
    >
      {/* Menu tab */}
      <div className="flex gap-1 mb-4 border-b border-ink-950/10">
        {MENU_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMenu(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              menu === key
                ? 'border-brass-500 text-brass-600'
                : 'border-transparent text-ink-700/60 hover:text-ink-950'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label-field">Bulan</label>
          <select className="input-field" value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
            {NAMA_BULAN.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label-field">Tahun</label>
          <input type="number" className="input-field w-28" value={tahun} onChange={(e) => setTahun(Number(e.target.value))} />
        </div>
      </div>

      {/* ===== TAB: TRANSAKSI ===== */}
      {menu === 'transaksi' && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-sage-500/10 flex items-center justify-center text-sage-500">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Total Pemasukan</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalMasuk)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <TrendingDown size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Total Pengeluaran</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalKeluar)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-brass-400/20 flex items-center justify-center text-brass-600">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Saldo Bulan Ini</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(saldo)}</p>
              </div>
            </div>
          </div>

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
                {loading && <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Belum ada transaksi bulan ini.</td></tr>
                )}
                {data.map((d) => (
                  <tr key={d.id}>
                    <td>{d.tanggal}</td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        d.jenis === 'masuk' ? 'bg-sage-500/10 text-sage-500' : 'bg-red-50 text-red-700'
                      }`}>
                        {d.jenis === 'masuk' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td>{d.kategori}</td>
                    <td>{d.siswa?.nama_lengkap || d.catatan || '-'}</td>
                    <td className="font-medium">{formatRupiah(d.jumlah)}</td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button className="icon-btn" onClick={() => openEdit(d)}><Pencil size={15} /></button>
                        <button className="icon-btn text-red-600" onClick={() => handleDelete(d.id)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== TAB: ARKAS ===== */}
      {menu === 'arkas' && (
        <div className="card overflow-x-auto">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Kode Rekening</th>
                <th>Kode Kegiatan</th>
                <th>Uraian</th>
                <th>Jumlah</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingArkas && <tr><td colSpan={5} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
              {!loadingArkas && arkasData.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-ink-700/50">
                  Belum ada data ARKAS tahun {tahun}. Klik "Input Data Massal ARKAS" untuk mengunggah CSV/Excel hasil konversi PDF.
                </td></tr>
              )}
              {arkasData.map((r) => (
                <tr key={r.id}>
                  <td>{r.kode_rekening || '-'}</td>
                  <td>{r.kode_kegiatan || '-'}</td>
                  <td className={r.is_item ? '' : 'font-medium'}>{r.uraian}</td>
                  <td className="font-medium">{formatRupiah(r.jumlah)}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== TAB: BKU ===== */}
      {menu === 'bku' && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-sage-500/10 flex items-center justify-center text-sage-500">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Total Penerimaan</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalPenerimaanBku)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <TrendingDown size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Total Pengeluaran</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalPengeluaranBku)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-brass-400/20 flex items-center justify-center text-brass-600">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-xs text-ink-700/50">Saldo Akhir Bulan</p>
                <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalPenerimaanBku - totalPengeluaranBku)}</p>
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. Bukti</th>
                  <th>Uraian</th>
                  <th>Penerimaan</th>
                  <th>Pengeluaran</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {loadingBku && <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
                {!loadingBku && bkuData.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">
                    Belum ada data BKU bulan {NAMA_BULAN[bulan - 1]} {tahun}. Klik "Input Data Massal BKU" untuk mengunggah CSV/Excel hasil konversi PDF.
                  </td></tr>
                )}
                {(() => {
                  let saldoBerjalan = 0
                  return bkuData.map((r) => {
                    saldoBerjalan += Number(r.penerimaan || 0) - Number(r.pengeluaran || 0)
                    return (
                      <tr key={r.id}>
                        <td>{r.tanggal}</td>
                        <td>{r.no_bukti || '-'}</td>
                        <td>{r.uraian || '-'}</td>
                        <td>{r.penerimaan ? formatRupiah(r.penerimaan) : '-'}</td>
                        <td>{r.pengeluaran ? formatRupiah(r.pengeluaran) : '-'}</td>
                        <td className="font-medium">{formatRupiah(saldoBerjalan)}</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal tambah/ubah transaksi (tab Transaksi) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{editingId ? 'Ubah Transaksi' : 'Tambah Transaksi'}</h2>
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
                    <option value="masuk">Pemasukan</option>
                    <option value="keluar">Pengeluaran</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Kategori</label>
                  <select className="input-field" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                    {(form.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.kategori === 'SPP' && (
                <div>
                  <label className="label-field">Siswa</label>
                  <select className="input-field" value={form.siswa_id} onChange={(e) => setForm({ ...form, siswa_id: e.target.value })}>
                    <option value="">-- Pilih siswa --</option>
                    {siswaList.map((s) => <option key={s.id} value={s.id}>{s.nama_lengkap}</option>)}
                  </select>
                </div>
              )}

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
                <label className="label-field">Catatan</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Keterangan tambahan..."
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
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
