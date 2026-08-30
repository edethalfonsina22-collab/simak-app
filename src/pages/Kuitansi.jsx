import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { useAuth } from '../lib/AuthContext'
import KuitansiModal from '../components/KuitansiModal'
import PilihBkuModal from '../components/PilihBkuModal'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'
import BulkImportModal from '../components/BulkImportModal'
import { Plus, Printer, Search, Loader2, Receipt, Trash2, FileSpreadsheet, Wallet } from 'lucide-react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Kolom template Excel untuk impor massal Kuitansi.
// Satu baris Excel = satu kuitansi. Nominal diisi langsung lewat kolom jumlah_total
// (tidak ada lagi rincian barang — itu khusus Nota).
const TEMPLATE_HEADERS = [
  'no_bukti',
  'lembar',
  'mata_anggaran',
  'tahun_anggaran',
  'tanggal(YYYY-MM-DD)',
  'diterima_dari',
  'jumlah_total',
  'untuk_pembayaran',
  'disetujui_oleh',
  'nip_disetujui',
  'dibayar_oleh',
  'nip_dibayar',
  'nama_penerima',
  'alamat_penerima',
  'catatan',
]

// Pengaman tambahan: kalau nilai tanggal dari file impor ternyata masih berupa
// angka serial Excel mentah (mis. karena dibuka lewat CSV atau parser lain yang
// tidak mengubahnya ke Date — BulkImportModal sudah menangani kasus umumnya),
// konversi manual di sini supaya tidak terkirim sebagai teks angka ke database.
function tanggalDariNilaiImpor(nilai) {
  if (nilai === undefined || nilai === null || nilai === '') {
    return new Date().toISOString().slice(0, 10)
  }
  // Angka serial Excel (basis 1899-12-30) — hanya cocok untuk range tahun wajar.
  if (typeof nilai === 'number' && nilai > 20000 && nilai < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const hasil = new Date(epoch.getTime() + nilai * 86400000)
    return hasil.toISOString().slice(0, 10)
  }
  const teks = String(nilai).trim()
  // Jaga-jaga kalau angka serial itu lolos sebagai teks (mis. "46255").
  if (/^\d{4,6}$/.test(teks)) {
    const angka = Number(teks)
    if (angka > 20000 && angka < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30))
      const hasil = new Date(epoch.getTime() + angka * 86400000)
      return hasil.toISOString().slice(0, 10)
    }
  }
  return teks
}

function mapRowKuitansi(row) {
  const diterimaDari = String(row['diterima_dari'] || '').trim()
  const jumlahTotal = Number(row['jumlah_total']) || 0
  if (!diterimaDari && !jumlahTotal) return null

  return {
    jenis: 'kuitansi',
    no_bukti: String(row['no_bukti'] || '').trim(),
    lembar: String(row['lembar'] || 'I/II/III/IV/V').trim(),
    mata_anggaran: String(row['mata_anggaran'] || '').trim(),
    tahun_anggaran: String(row['tahun_anggaran'] || String(new Date().getFullYear())).trim(),
    tanggal: tanggalDariNilaiImpor(row['tanggal(YYYY-MM-DD)']),
    diterima_dari: diterimaDari,
    jumlah_total: jumlahTotal,
    untuk_pembayaran: String(row['untuk_pembayaran'] || '').trim(),
    disetujui_oleh: String(row['disetujui_oleh'] || '').trim(),
    nip_disetujui: String(row['nip_disetujui'] || '').trim(),
    dibayar_oleh: String(row['dibayar_oleh'] || '').trim(),
    nip_dibayar: String(row['nip_dibayar'] || '').trim(),
    nama_penerima: String(row['nama_penerima'] || '').trim(),
    alamat_penerima: String(row['alamat_penerima'] || '').trim(),
    catatan: String(row['catatan'] || '').trim(),
  }
}

export default function Kuitansi() {
  const { profil } = useAuth()
  const sekolahId = profil?.sekolah_id
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [pencarian, setPencarian] = useState('')
  const [showBuat, setShowBuat] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showPilihBku, setShowPilihBku] = useState(false)
  const [bkuTerpilih, setBkuTerpilih] = useState(null) // baris BKU yang dipilih, dipetakan ke bentuk keuanganRow
  const [sekolah, setSekolah] = useState(null)
  const [menghapus, setMenghapus] = useState(null) // id yang sedang dihapus

  // Baris yang sedang dicetak ulang
  const [cetakUlang, setCetakUlang] = useState(null)
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
    if (!sekolahId) return
    supabase.from('profil_sekolah').select('*').eq('sekolah_id', sekolahId).maybeSingle().then(({ data }) => {
      if (data) {
        setSekolah({
          nama: data.nama_sekolah,
          alamat: data.alamat,
          kota: data.kabupaten,
        })
      }
    })
  }, [sekolahId])

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

  function handleCetakUlang(row) {
    setCetakUlang(row)
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
    const { error } = await supabase.from('kuitansi').delete().eq('id', row.id)
    setMenghapus(null)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    loadData()
  }

  // Petakan baris bku_kas ke bentuk yang diharapkan KuitansiModal (keuanganRow):
  // { id, tanggal, jumlah, catatan, kategori, no_bukti, mata_anggaran } — supaya
  // KuitansiModal tidak perlu tahu soal struktur tabel bku_kas sama sekali.
  function handlePilihBku(row) {
    setBkuTerpilih({
      // SENGAJA tidak menyertakan `id` di sini. keuanganRow.id dipakai
      // KuitansiModal untuk mengisi kolom keuangan_id, yang foreign key-nya
      // menunjuk ke tabel `keuangan` — bukan ke bku_kas. Kalau id baris BKU
      // ikut dioper, insert kuitansi akan gagal (atau salah nyambung ke baris
      // keuangan yang tidak berhubungan). keuangan_id akan otomatis null.
      tanggal: row.tanggal,
      jumlah: row.pengeluaran,
      catatan: row.uraian,
      kategori: row.uraian,
      no_bukti: row.no_bukti,
      mata_anggaran: row.kode_rekening,
    })
    setShowPilihBku(false)
    setShowBuat(true)
  }

  function handleTutupBuat() {
    setShowBuat(false)
    setBkuTerpilih(null)
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

        const { error: insertErr } = await supabase.from('kuitansi').insert(payload)
        if (insertErr) throw insertErr

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
          <button className="btn-secondary" onClick={() => setShowPilihBku(true)}>
            <Wallet size={16} /> Tarik Data dari BKU
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
                      onClick={() => handleCetakUlang(d)}
                    >
                      <Printer size={15} />
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
          keuanganRow={bkuTerpilih}
          sekolah={sekolah}
          onClose={handleTutupBuat}
        />
      )}

      {showPilihBku && (
        <PilihBkuModal
          onPilih={handlePilihBku}
          onClose={() => setShowPilihBku(false)}
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

      {/* Print template dirender langsung di sini (bukan di dalam elemen "no-print"),
          supaya tidak ikut disembunyikan saat window.print() dipanggil. */}
      {cetakUlang && (
        <KuitansiPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={cetakUlang}
        />
      )}
    </Layout>
  )
}
