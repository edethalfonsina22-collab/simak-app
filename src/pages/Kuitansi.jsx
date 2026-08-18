import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import KuitansiModal from '../components/KuitansiModal'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'
import BulkImportModal from '../components/BulkImportModal'
import { Plus, Printer, Search, Loader2, Receipt, Trash2, FileSpreadsheet } from 'lucide-react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Kolom template Excel untuk impor massal Kuitansi.
// Satu baris Excel = satu kuitansi dengan satu baris rincian barang.
const TEMPLATE_HEADERS = [
  'no_bukti',
  'lembar',
  'mata_anggaran',
  'tahun_anggaran',
  'tanggal(YYYY-MM-DD)',
  'diterima_dari',
  'untuk_pembayaran',
  'nama_barang',
  'jumlah',
  'harga_satuan',
  'disetujui_oleh',
  'nip_disetujui',
  'dibayar_oleh',
  'nip_dibayar',
  'nama_penerima',
  'alamat_penerima',
  'catatan',
]

function mapRowKuitansi(row) {
  const namaBarang = String(row['nama_barang'] || '').trim()
  if (!namaBarang) return null
  const jumlah = Number(row['jumlah']) || 1
  const hargaSatuan = Number(row['harga_satuan']) || 0

  return {
    jenis: 'kuitansi',
    no_bukti: String(row['no_bukti'] || '').trim(),
    lembar: String(row['lembar'] || 'I/II/III/IV/V').trim(),
    mata_anggaran: String(row['mata_anggaran'] || '').trim(),
    tahun_anggaran: String(row['tahun_anggaran'] || String(new Date().getFullYear())).trim(),
    tanggal: String(row['tanggal(YYYY-MM-DD)'] || new Date().toISOString().slice(0, 10)).trim(),
    diterima_dari: String(row['diterima_dari'] || '').trim(),
    untuk_pembayaran: String(row['untuk_pembayaran'] || '').trim(),
    disetujui_oleh: String(row['disetujui_oleh'] || '').trim(),
    nip_disetujui: String(row['nip_disetujui'] || '').trim(),
    dibayar_oleh: String(row['dibayar_oleh'] || '').trim(),
    nip_dibayar: String(row['nip_dibayar'] || '').trim(),
    nama_penerima: String(row['nama_penerima'] || '').trim(),
    alamat_penerima: String(row['alamat_penerima'] || '').trim(),
    catatan: String(row['catatan'] || '').trim(),
    nama_barang: namaBarang,
    jumlah,
    harga_satuan: hargaSatuan,
    jumlah_total: jumlah * hargaSatuan,
  }
}

export default function Kuitansi() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [pencarian, setPencarian] = useState('')
  const [showBuat, setShowBuat] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sekolah, setSekolah] = useState(null)
  const [menghapus, setMenghapus] = useState(null) // id yang sedang dihapus

  // Data yang sedang dicetak ulang: { ...row, items: [...] }
  const [cetakUlang, setCetakUlang] = useState(null)
  const [memuatCetak, setMemuatCetak] = useState(null) // id kuitansi yang sedang disiapkan untuk cetak
  const printRef = useRef(null)

  async function loadData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('kuitansi')
      .select('*')
      .eq('jenis', 'kuitansi')
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })
    if (!error) setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) {
        setSekolah({
          nama: data.nama_sekolah,
          alamat: data.alamat,
          kota: data.kabupaten,
        })
      }
    })
  }, [])

  const dataTersaring = useMemo(() => {
    return data.filter((d) => {
      if (!pencarian.trim()) return true
      const q = pencarian.toLowerCase()
      return (
        (d.nomor || '').toLowerCase().includes(q) ||
        (d.diterima_dari || '').toLowerCase().includes(q) ||
        (d.untuk_pembayaran || '').toLowerCase().includes(q)
      )
    })
  }, [data, pencarian])

  async function handleCetakUlang(row) {
    setMemuatCetak(row.id)
    const { data: items, error } = await supabase
      .from('kuitansi_item')
      .select('*')
      .eq('kuitansi_id', row.id)
      .order('urutan', { ascending: true })
    setMemuatCetak(null)
    if (error) {
      alert('Gagal memuat rincian kuitansi: ' + error.message)
      return
    }
    setCetakUlang({ ...row, items: items || [] })
  }

  useEffect(() => {
    if (cetakUlang) {
      const t = setTimeout(() => {
        window.print()
        setCetakUlang(null)
      }, 150)
      return () => clearTimeout(t)
    }
  }, [cetakUlang])

  async function handleHapus(row) {
    if (!confirm(`Hapus kuitansi nomor "${row.nomor || '-'}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setMenghapus(row.id)
    // Hapus rincian item dulu, baru baris kuitansinya, supaya tidak ganjal foreign key.
    const { error: itemErr } = await supabase.from('kuitansi_item').delete().eq('kuitansi_id', row.id)
    if (itemErr) {
      setMenghapus(null)
      alert('Gagal menghapus rincian item: ' + itemErr.message)
      return
    }
    const { error } = await supabase.from('kuitansi').delete().eq('id', row.id)
    setMenghapus(null)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    loadData()
  }

  function handleTutupBuat() {
    setShowBuat(false)
    loadData()
  }

  async function handleImportKuitansi(rows) {
    let sukses = 0
    const gagal = []
    for (const row of rows) {
      try {
        const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: 'kuitansi' })
        if (nomorErr) throw nomorErr

        const payload = {
          jenis: 'kuitansi',
          nomor: nomorData,
          no_bukti: row.no_bukti,
          lembar: row.lembar,
          mata_anggaran: row.mata_anggaran,
          tahun_anggaran: row.tahun_anggaran,
          tanggal: row.tanggal,
          diterima_dari: row.diterima_dari,
          untuk_pembayaran: row.untuk_pembayaran,
          jumlah_total: row.jumlah_total,
          disetujui_oleh: row.disetujui_oleh,
          nip_disetujui: row.nip_disetujui,
          dibayar_oleh: row.dibayar_oleh,
          nip_dibayar: row.nip_dibayar,
          nama_penerima: row.nama_penerima,
          alamat_penerima: row.alamat_penerima,
          catatan: row.catatan,
        }

        const { data: inserted, error: insertErr } = await supabase.from('kuitansi').insert(payload).select().single()
        if (insertErr) throw insertErr

        const { error: itemErr } = await supabase.from('kuitansi_item').insert({
          kuitansi_id: inserted.id,
          nama_barang: row.nama_barang,
          jumlah: row.jumlah,
          harga_satuan: row.harga_satuan,
          urutan: 0,
        })
        if (itemErr) throw itemErr

        sukses += 1
      } catch (err) {
        gagal.push(err.message)
      }
    }
    loadData()
    if (gagal.length > 0) {
      throw new Error(`${sukses} baris berhasil, ${gagal.length} baris gagal. Contoh error: ${gagal[0]}`)
    }
    return { count: sukses }
  }

  return (
    <Layout
      title="Kuitansi"
      subtitle="Riwayat semua kuitansi yang pernah dibuat"
      actions={
        <>
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <FileSpreadsheet size={16} /> Impor Massal (Excel)
          </button>
          <button className="btn-primary" onClick={() => setShowBuat(true)}>
            <Plus size={16} /> Buat Kuitansi Baru
          </button>
        </>
      }
    >
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="label-field">Cari</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              className="input-field pl-9"
              placeholder="Cari nomor, nama, atau keterangan..."
              value={pencarian}
              onChange={(e) => setPencarian(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Tanggal</th>
              <th>Diterima Dari</th>
              <th>Keterangan</th>
              <th>Jumlah</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
            )}
            {!loading && dataTersaring.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-ink-700/50">
                  <div className="flex flex-col items-center gap-2">
                    <Receipt size={28} className="text-ink-700/25" />
                    <span>Belum ada kuitansi yang cocok.</span>
                  </div>
                </td>
              </tr>
            )}
            {dataTersaring.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.nomor || '-'}</td>
                <td>{formatTanggal(d.tanggal)}</td>
                <td>{d.diterima_dari || '-'}</td>
                <td className="max-w-[220px] truncate">{d.untuk_pembayaran || '-'}</td>
                <td className="font-medium">{formatRupiah(d.jumlah_total)}</td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      className="icon-btn"
                      title="Cetak Ulang"
                      disabled={memuatCetak === d.id}
                      onClick={() => handleCetakUlang(d)}
                    >
                      {memuatCetak === d.id ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                    </button>
                    <button
                      className="icon-btn text-red-600"
                      title="Hapus"
                      disabled={menghapus === d.id}
                      onClick={() => handleHapus(d)}
                    >
                      {menghapus === d.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBuat && (
        <KuitansiModal
          keuanganRow={null}
          sekolah={sekolah}
          onClose={handleTutupBuat}
        />
      )}

      <BulkImportModal
        open={showImport}
        onClose={() => { setShowImport(false); loadData() }}
        title="Impor Kuitansi"
        templateHeaders={TEMPLATE_HEADERS}
        mapRow={mapRowKuitansi}
        onImport={handleImportKuitansi}
      />

      {cetakUlang && (
        <KuitansiPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={cetakUlang}
          items={cetakUlang.items}
        />
      )}
    </Layout>
  )
}
