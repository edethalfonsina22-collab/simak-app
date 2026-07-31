import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { eksporExcel, eksporPDF } from '../lib/exportUtils'
import { Printer, FileDown, FileSpreadsheet, Loader2 } from 'lucide-react'

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const JENIS_LAPORAN = [
  { value: 'presensi_siswa', label: 'Rekap Presensi Siswa' },
  { value: 'presensi_guru', label: 'Rekap Presensi Guru' },
  { value: 'surat', label: 'Rekap Surat Masuk/Keluar' },
  { value: 'agenda', label: 'Rekap Agenda Kegiatan' },
]

function rentangBulan(tahun, bulan) {
  // bulan: 1-12
  const awal = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const akhirDate = new Date(tahun, bulan, 0) // hari terakhir bulan itu
  const akhir = `${tahun}-${String(bulan).padStart(2, '0')}-${String(akhirDate.getDate()).padStart(2, '0')}`
  return { awal, akhir }
}

export default function LaporanBulanan() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [jenis, setJenis] = useState('presensi_siswa')
  const [loading, setLoading] = useState(false)
  const [dataLaporan, setDataLaporan] = useState(null)

  async function muatLaporan() {
    setLoading(true)
    const { awal, akhir } = rentangBulan(tahun, bulan)

    if (jenis === 'presensi_siswa') {
      const { data } = await supabase
        .from('presensi_siswa')
        .select('status, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))')
        .gte('tanggal', awal)
        .lte('tanggal', akhir)
      const rekap = {}
      for (const row of data || []) {
        const nama = row.siswa?.nama_lengkap || 'Tanpa nama'
        const kelas = row.siswa?.kelas?.nama_kelas || '-'
        const kunci = `${nama}||${kelas}`
        if (!rekap[kunci]) rekap[kunci] = { nama, kelas, hadir: 0, izin: 0, sakit: 0, alpa: 0 }
        if (rekap[kunci][row.status] !== undefined) rekap[kunci][row.status]++
      }
      setDataLaporan(Object.values(rekap).sort((a, b) => a.nama.localeCompare(b.nama)))
    }

    if (jenis === 'presensi_guru') {
      const { data } = await supabase
        .from('presensi_guru')
        .select('status, guru:guru_id(nama_lengkap)')
        .gte('tanggal', awal)
        .lte('tanggal', akhir)
      const rekap = {}
      for (const row of data || []) {
        const nama = row.guru?.nama_lengkap || 'Tanpa nama'
        if (!rekap[nama]) rekap[nama] = { nama, hadir: 0, izin: 0, sakit: 0, alpa: 0 }
        if (rekap[nama][row.status] !== undefined) rekap[nama][row.status]++
      }
      setDataLaporan(Object.values(rekap).sort((a, b) => a.nama.localeCompare(b.nama)))
    }

    if (jenis === 'surat') {
      const { data } = await supabase
        .from('surat')
        .select('*')
        .gte('tanggal', awal)
        .lte('tanggal', akhir)
        .order('tanggal')
      setDataLaporan(data || [])
    }

    if (jenis === 'agenda') {
      const { data } = await supabase
        .from('agenda')
        .select('*')
        .gte('tanggal_mulai', awal)
        .lte('tanggal_mulai', akhir + 'T23:59:59')
        .order('tanggal_mulai')
      setDataLaporan(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    muatLaporan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const judulLaporan = `${JENIS_LAPORAN.find((j) => j.value === jenis)?.label} — ${NAMA_BULAN[bulan - 1]} ${tahun}`

  function siapkanTabel() {
    if (!dataLaporan) return { kolom: [], baris: [] }
    if (jenis === 'presensi_siswa') {
      return {
        kolom: ['Nama Siswa', 'Kelas', 'Hadir', 'Izin', 'Sakit', 'Alpa'],
        baris: dataLaporan.map((d) => [d.nama, d.kelas, d.hadir, d.izin, d.sakit, d.alpa]),
      }
    }
    if (jenis === 'presensi_guru') {
      return {
        kolom: ['Nama Guru', 'Hadir', 'Izin', 'Sakit', 'Alpa'],
        baris: dataLaporan.map((d) => [d.nama, d.hadir, d.izin, d.sakit, d.alpa]),
      }
    }
    if (jenis === 'surat') {
      return {
        kolom: ['Jenis', 'Nomor Surat', 'Perihal', 'Pengirim/Tujuan', 'Tanggal'],
        baris: dataLaporan.map((d) => [
          d.jenis === 'masuk' ? 'Masuk' : 'Keluar',
          d.nomor_surat || '-',
          d.perihal,
          d.pengirim_tujuan || '-',
          d.tanggal,
        ]),
      }
    }
    if (jenis === 'agenda') {
      return {
        kolom: ['Judul Kegiatan', 'Tanggal Mulai', 'Lokasi', 'Penanggung Jawab'],
        baris: dataLaporan.map((d) => [
          d.judul,
          new Date(d.tanggal_mulai).toLocaleDateString('id-ID'),
          d.lokasi || '-',
          d.penanggung_jawab || '-',
        ]),
      }
    }
    return { kolom: [], baris: [] }
  }

  function handleExportPDF() {
    const { kolom, baris } = siapkanTabel()
    if (baris.length === 0) return
    eksporPDF(judulLaporan, kolom, baris, `laporan-${jenis}-${tahun}-${bulan}`)
  }

  function handleExportExcel() {
    const { kolom, baris } = siapkanTabel()
    if (baris.length === 0) return
    const rows = baris.map((b) => Object.fromEntries(kolom.map((k, i) => [k, b[i]])))
    eksporExcel(rows, `laporan-${jenis}-${tahun}-${bulan}`, 'Laporan')
  }

  function handleCetak() {
    window.print()
  }

  const { kolom, baris } = siapkanTabel()

  return (
    <Layout title="Laporan Bulanan" subtitle="Rekap data siap cetak untuk laporan akhir bulan">
      {/* Aturan cetak: sembunyikan semuanya kecuali area laporan saat print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #area-cetak, #area-cetak * { visibility: visible; }
          #area-cetak { position: absolute; top: 0; left: 0; width: 100%; }
          .sembunyikan-saat-cetak { display: none !important; }
        }
      `}</style>

      <div className="card p-5 mb-5 sembunyikan-saat-cetak">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label-field">Jenis Laporan</label>
            <select className="input-field" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              {JENIS_LAPORAN.map((j) => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Bulan</label>
            <select className="input-field" value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
              {NAMA_BULAN.map((nama, i) => (
                <option key={nama} value={i + 1}>{nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Tahun</label>
            <input
              type="number"
              className="input-field"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={muatLaporan} disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Tampilkan Laporan
          </button>
          <button className="btn-secondary" onClick={handleCetak} disabled={baris.length === 0}>
            <Printer size={16} /> Cetak
          </button>
          <button className="btn-secondary" onClick={handleExportPDF} disabled={baris.length === 0}>
            <FileDown size={16} /> Unduh PDF
          </button>
          <button className="btn-secondary" onClick={handleExportExcel} disabled={baris.length === 0}>
            <FileSpreadsheet size={16} /> Unduh Excel
          </button>
        </div>
      </div>

      <div id="area-cetak" className="card p-6">
        <div className="mb-4">
          <h2 className="font-display text-lg font-semibold text-ink-950">{judulLaporan}</h2>
          <p className="text-sm text-ink-700/50">
            Dicetak pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {loading && <p className="text-center py-8 text-ink-700/50 text-sm">Memuat data...</p>}

        {!loading && baris.length === 0 && (
          <p className="text-center py-8 text-ink-700/50 text-sm">
            Tidak ada data untuk periode ini.
          </p>
        )}

        {!loading && baris.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>
                {kolom.map((k) => <th key={k}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i}>
                  {b.map((cell, j) => <td key={j}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
