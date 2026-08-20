import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import KuitansiJasaModal from '../components/KuitansiJasaModal'
import PilihKuitansiModal from '../components/PilihKuitansiModal'
import KuitansiJasaPrintTemplate from '../lib/KuitansiJasaPrintTemplate'
import { terbilangRupiah } from '../lib/terbilang'
import { Plus, Printer, Search, Loader2, Receipt, Trash2, Copy, ArrowDownToLine } from 'lucide-react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function KuitansiJasa() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [pencarian, setPencarian] = useState('')
  const [showBuat, setShowBuat] = useState(false)
  const [sekolah, setSekolah] = useState(null)
  const [menghapus, setMenghapus] = useState(null) // id yang sedang dihapus

  // Baris sumber saat user menekan tombol "Duplikat" — dipakai untuk pre-fill
  // KuitansiJasaModal. null berarti form dibuka kosong seperti biasa.
  const [duplikatDari, setDuplikatDari] = useState(null)

  // Status modal "Tarik dari Kuitansi" (pilih data dari Kuitansi utama).
  const [showPilih, setShowPilih] = useState(false)

  // Baris yang sedang dicetak ulang
  const [cetakUlang, setCetakUlang] = useState(null)
  const printRef = useRef(null)

  async function loadData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('kuitansi')
      .select('*')
      .eq('jenis', 'kuitansi_jasa')
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

  function handleCetakUlang(row) {
    setCetakUlang(row)
  }

  // Membuka form "Buat Kuitansi Jasa" dengan Telah Terima Dari, Jumlah, dan
  // Untuk Pembayaran/Keterangan sudah terisi dari baris yang dipilih — supaya
  // transaksi berulang (transport kegiatan, honor, dsb.) tidak perlu diketik
  // ulang dari nol. No. Bukti dan Tanggal tetap dikosongkan/direset di dalam
  // modal karena keduanya harus baru untuk tiap transaksi.
  function handleDuplikat(row) {
    setDuplikatDari(row)
    setShowBuat(true)
  }

  function handleBuatBaru() {
    setDuplikatDari(null)
    setShowBuat(true)
  }

  // Dipanggil dari PilihKuitansiModal saat user memilih satu kuitansi untuk
  // ditarik datanya. KuitansiJasaModal sudah bisa membaca prop `initialData`
  // (Nama, Jumlah, Keterangan langsung terisi; No. Bukti & Tanggal tetap
  // dikosongkan karena harus baru).
  function handleTarikData(row) {
    setShowPilih(false)
    setDuplikatDari(row)
    setShowBuat(true)
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
    if (!confirm(`Hapus kuitansi jasa nomor "${row.nomor || '-'}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setMenghapus(row.id)
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
    setDuplikatDari(null)
    loadData()
  }

  // Memetakan nama kolom tabel ke nama prop yang dipakai KuitansiJasaPrintTemplate,
  // sama seperti pemetaan di KuitansiJasaModal saat kuitansi baru pertama kali dicetak.
  const dataCetakUlang = cetakUlang
    ? {
        no_kwitansi: cetakUlang.nomor,
        tanggal: cetakUlang.tanggal,
        dari: cetakUlang.diterima_dari,
        uang_sejumlah: terbilangRupiah(cetakUlang.jumlah_total),
        untuk_pembayaran: cetakUlang.untuk_pembayaran,
        jumlah: cetakUlang.jumlah_total,
      }
    : null

  return (
    <Layout
      title="Kuitansi Jasa"
      subtitle="Riwayat kuitansi jasa (transport, honor kegiatan, dsb.)"
      actions={
        <>
          <button className="btn-secondary" onClick={() => setShowPilih(true)}>
            <ArrowDownToLine size={16} /> Tarik dari Kuitansi
          </button>
          <button className="btn-primary" onClick={handleBuatBaru}>
            <Plus size={16} /> Buat Kuitansi Jasa
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
                    <span>Belum ada kuitansi jasa yang cocok.</span>
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
                      title="Duplikat (isi ulang dari transaksi ini)"
                      onClick={() => handleDuplikat(d)}
                    >
                      <Copy size={15} />
                    </button>
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
        <KuitansiJasaModal
          sekolah={sekolah}
          initialData={duplikatDari}
          onClose={handleTutupBuat}
        />
      )}

      {showPilih && (
        <PilihKuitansiModal
          onPilih={handleTarikData}
          onClose={() => setShowPilih(false)}
        />
      )}

      {/* Print template dirender langsung di sini (bukan di dalam elemen "no-print"),
          supaya tidak ikut disembunyikan saat window.print() dipanggil. */}
      {dataCetakUlang && (
        <KuitansiJasaPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={dataCetakUlang}
        />
      )}
    </Layout>
  )
}
