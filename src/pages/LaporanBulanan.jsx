import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { eksporExcel, eksporPDF, eksporPDFDaftarHadir } from '../lib/exportUtils'
import { susunDaftarHadir, apakahHariMinggu, kodeSel, jumlahHariDalamBulan } from '../lib/daftarHadirUtils'
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
  const awal = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const akhirDate = new Date(tahun, bulan, 0)
  const akhir = `${tahun}-${String(bulan).padStart(2, '0')}-${String(akhirDate.getDate()).padStart(2, '0')}`
  return { awal, akhir }
}

export default function LaporanBulanan() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [jenis, setJenis] = useState('presensi_siswa')
  const [tampilanGuru, setTampilanGuru] = useState('ringkasan') // 'ringkasan' | 'daftar_hadir'
  const [loading, setLoading] = useState(false)
  const [dataLaporan, setDataLaporan] = useState(null)
  const [daftarHadirGuru, setDaftarHadirGuru] = useState(null) // { baris, totalHari }
  const [tanggalLibur, setTanggalLibur] = useState('') // input manual tambahan, contoh: "16,21"
  const [hariLiburDB, setHariLiburDB] = useState(new Set()) // dari tabel hari_libur, untuk bulan aktif
  const [profilSekolah, setProfilSekolah] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [ttdUrl, setTtdUrl] = useState('') // <-- TAMBAHAN: tanda tangan elektronik kepala sekolah
  const [mengeksporPDF, setMengeksporPDF] = useState(false)

  useEffect(() => {
    supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      setProfilSekolah(data || {})
      if (data?.logo_path) {
        const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(data.logo_path)
        setLogoUrl(pub.publicUrl)
      } else {
        setLogoUrl('')
      }
      // TAMBAHAN: ambil URL tanda tangan elektronik kepala sekolah dari profil sekolah
      if (data?.ttd_kepala_sekolah_path) {
        const { data: pubTtd } = supabase.storage.from('profil-sekolah').getPublicUrl(data.ttd_kepala_sekolah_path)
        setTtdUrl(pubTtd.publicUrl)
      } else {
        setTtdUrl('')
      }
    })
  }, [])

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
      const { data: guru } = await supabase
        .from('guru')
        .select('id, nip, nama_lengkap, mata_pelajaran')
        .eq('status', 'aktif')

      const { data: presensi } = await supabase
        .from('presensi_guru')
        .select('guru_id, tanggal, status')
        .gte('tanggal', awal)
        .lte('tanggal', akhir)

      // Rekap ringkas (tampilan lama, tetap dipertahankan)
      const rekap = {}
      for (const row of presensi || []) {
        const g = (guru || []).find((x) => x.id === row.guru_id)
        const nama = g?.nama_lengkap || 'Tanpa nama'
        if (!rekap[nama]) rekap[nama] = { nama, hadir: 0, izin: 0, sakit: 0, alpa: 0 }
        if (rekap[nama][row.status] !== undefined) rekap[nama][row.status]++
      }
      setDataLaporan(Object.values(rekap).sort((a, b) => a.nama.localeCompare(b.nama)))

      // Data untuk tampilan Daftar Hadir (grid kalender)
      setDaftarHadirGuru(susunDaftarHadir(guru || [], presensi || [], tahun, bulan))

      // Tanggal libur (nasional/sekolah) untuk bulan aktif, dari tabel hari_libur
      const { data: libur } = await supabase
        .from('hari_libur')
        .select('tanggal')
        .gte('tanggal', awal)
        .lte('tanggal', akhir)
      setHariLiburDB(new Set((libur || []).map((r) => Number(r.tanggal.slice(8, 10)))))
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

  const judulLaporan =
    jenis === 'presensi_guru' && tampilanGuru === 'daftar_hadir'
      ? `DAFTAR HADIR — BULAN: ${NAMA_BULAN[bulan - 1].toUpperCase()} ${tahun}`
      : `${JENIS_LAPORAN.find((j) => j.value === jenis)?.label} — ${NAMA_BULAN[bulan - 1]} ${tahun}`

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

  // parse input manual "16,21" -> Set([16, 21])
  const hariLiburManual = new Set(
    tanggalLibur.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
  )
  const isHariLibur = (tgl) =>
    apakahHariMinggu(tahun, bulan, tgl) || hariLiburDB.has(tgl) || hariLiburManual.has(tgl)

  async function handleExportPDF() {
    if (jenis === 'presensi_guru' && tampilanGuru === 'daftar_hadir') {
      if (!daftarHadirGuru) {
        alert('Data Daftar Hadir belum dimuat. Klik "Tampilkan Laporan" dulu, lalu coba unduh PDF lagi.')
        return
      }
      const akhirBulan = jumlahHariDalamBulan(tahun, bulan)
      setMengeksporPDF(true)
      try {
        await eksporPDFDaftarHadir({
          profilSekolah: profilSekolah || {},
          logoUrl,
          ttdUrl, // <-- TAMBAHAN: teruskan URL tanda tangan ke fungsi pembuat PDF
          bulanLabel: NAMA_BULAN[bulan - 1],
          tahun,
          baris: daftarHadirGuru.baris,
          totalHari: daftarHadirGuru.totalHari,
          isHariLibur,
          tanggalCetak: `${akhirBulan} ${NAMA_BULAN[bulan - 1]} ${tahun}`,
          namaFile: `daftar-hadir-guru-${tahun}-${bulan}`,
        })
      } catch (err) {
        console.error('Gagal membuat PDF Daftar Hadir:', err)
        alert('Gagal membuat PDF: ' + (err?.message || 'Terjadi kesalahan tidak dikenal. Cek console browser (F12) untuk detail.'))
      } finally {
        setMengeksporPDF(false)
      }
      return
    }

    try {
      const { kolom, baris } = siapkanTabel()
      if (baris.length === 0) {
        alert('Tidak ada data untuk diunduh pada periode ini.')
        return
      }
      eksporPDF(judulLaporan, kolom, baris, `laporan-${jenis}-${tahun}-${bulan}`)
    } catch (err) {
      console.error('Gagal membuat PDF laporan:', err)
      alert('Gagal membuat PDF: ' + (err?.message || 'Terjadi kesalahan tidak dikenal.'))
    }
  }

  function handleExportExcel() {
    if (jenis === 'presensi_guru' && tampilanGuru === 'daftar_hadir' && daftarHadirGuru) {
      const totalHari = daftarHadirGuru.totalHari
      const rows = daftarHadirGuru.baris.map((b) => {
        const row = { No: b.no, 'Nama Guru': b.nama, NIP: b.nip, Jabatan: b.jabatan }
        for (let t = 1; t <= totalHari; t++) row[t] = isHariLibur(t) ? '' : kodeSel(b.statusHarian[t - 1])
        row['S'] = b.sakit
        row['I'] = b.izin
        row['TK'] = b.tanpaKeterangan
        row['JML'] = b.jumlahTidakHadir
        return row
      })
      eksporExcel(rows, `daftar-hadir-guru-${tahun}-${bulan}`, 'Daftar Hadir')
      return
    }
    const { kolom, baris } = siapkanTabel()
    if (baris.length === 0) return
    const rows = baris.map((b) => Object.fromEntries(kolom.map((k, i) => [k, b[i]])))
    eksporExcel(rows, `laporan-${jenis}-${tahun}-${bulan}`, 'Laporan')
  }

  function handleCetak() {
    window.print()
  }

  const { kolom, baris } = siapkanTabel()
  const modeGridAktif = jenis === 'presensi_guru' && tampilanGuru === 'daftar_hadir'
  const totalHari = daftarHadirGuru?.totalHari || 0

  return (
    <Layout title="Laporan Bulanan" subtitle="Rekap data siap cetak untuk laporan akhir bulan">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #area-cetak, #area-cetak * { visibility: visible; }
          #area-cetak { position: absolute; top: 0; left: 0; width: 100%; }
          .sembunyikan-saat-cetak { display: none !important; }
          @page { size: landscape; margin: 10mm; }
        }
        .tabel-hadir { border-collapse: collapse; width: 100%; font-size: 10px; }
        .tabel-hadir th, .tabel-hadir td { border: 1px solid #333; text-align: center; padding: 2px; }
        .tabel-hadir td.nama { text-align: left; white-space: nowrap; }
        /* FIX: browser tidak mencetak background-color secara default.
           print-color-adjust: exact memaksa browser tetap mencetak warna latar ini. */
        .kolom-libur {
          background: #e11d2e;
          color: #fff;
          font-weight: 600;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        .kop-sekolah { display: flex; align-items: center; justify-content: center; gap: 12px; }
        .kop-sekolah img { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
        .ttd-elektronik { height: 64px; object-fit: contain; }
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

        {jenis === 'presensi_guru' && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label-field">Tampilan</label>
              <select className="input-field" value={tampilanGuru} onChange={(e) => setTampilanGuru(e.target.value)}>
                <option value="ringkasan">Ringkasan (Hadir/Izin/Sakit/Alpa)</option>
                <option value="daftar_hadir">Daftar Hadir (format kertas absensi)</option>
              </select>
            </div>
            {tampilanGuru === 'daftar_hadir' && (
              <div>
                <label className="label-field">Libur mendadak tambahan (pisah koma) — untuk yang tetap belum sempat didaftarkan di menu Hari Libur</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="contoh: 16,21"
                  value={tanggalLibur}
                  onChange={(e) => setTanggalLibur(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={muatLaporan} disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Tampilkan Laporan
          </button>
          <button className="btn-secondary" onClick={handleCetak} disabled={!modeGridAktif && baris.length === 0}>
            <Printer size={16} /> Cetak
          </button>
          <button className="btn-secondary" onClick={handleExportPDF} disabled={mengeksporPDF || (!modeGridAktif && baris.length === 0)}>
            {mengeksporPDF ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            {mengeksporPDF ? 'Menyiapkan PDF...' : 'Unduh PDF'}
          </button>
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!modeGridAktif && baris.length === 0}>
            <FileSpreadsheet size={16} /> Unduh Excel
          </button>
        </div>
      </div>

      <div id="area-cetak" className="card p-6">
        {!modeGridAktif && (
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-ink-950">{judulLaporan}</h2>
            <p className="text-sm text-ink-700/50">
              Dicetak pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {loading && <p className="text-center py-8 text-ink-700/50 text-sm">Memuat data...</p>}

        {!loading && !modeGridAktif && baris.length === 0 && (
          <p className="text-center py-8 text-ink-700/50 text-sm">Tidak ada data untuk periode ini.</p>
        )}
        {!loading && !modeGridAktif && baris.length > 0 && (
          <table className="table-shell">
            <thead>
              <tr>{kolom.map((k) => <th key={k}>{k}</th>)}</tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i}>{b.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ---------- Tampilan Daftar Hadir (grid kalender, format kertas absensi) ---------- */}
        {!loading && modeGridAktif && daftarHadirGuru && (
          <div>
            <div className="kop-sekolah mb-3">
              {logoUrl && <img src={logoUrl} alt="Logo sekolah" />}
              <div className="text-center">
                <p className="font-semibold uppercase">{profilSekolah?.dinas_pendidikan}</p>
                <p className="uppercase">{profilSekolah?.kabupaten}</p>
                <p className="font-semibold uppercase">{profilSekolah?.nama_sekolah}</p>
                <p className="uppercase">{profilSekolah?.kecamatan}</p>
                <p className="text-xs">{profilSekolah?.alamat}</p>
              </div>
            </div>
            <p className="text-sm font-medium mb-1">BULAN: {NAMA_BULAN[bulan - 1].toUpperCase()} {tahun}</p>

            <table className="tabel-hadir">
              <thead>
                <tr>
                  <th rowSpan={2}>NO</th>
                  <th rowSpan={2}>NAMA/NIP</th>
                  <th rowSpan={2}>JABATAN</th>
                  <th colSpan={totalHari}>TANGGAL</th>
                  <th colSpan={4}>TIDAK HADIR</th>
                </tr>
                <tr>
                  {Array.from({ length: totalHari }, (_, i) => i + 1).map((tgl) => (
                    <th key={tgl} className={isHariLibur(tgl) ? 'kolom-libur' : ''}>{tgl}</th>
                  ))}
                  <th>S</th>
                  <th>I</th>
                  <th>TK</th>
                  <th>JML</th>
                </tr>
              </thead>
              <tbody>
                {daftarHadirGuru.baris.map((b) => (
                  <tr key={b.id}>
                    <td>{b.no}</td>
                    <td className="nama">{b.nama}<br /><span style={{ fontWeight: 400 }}>NIP. {b.nip}</span></td>
                    <td>{b.jabatan}</td>
                    {b.statusHarian.map((status, i) => {
                      const tgl = i + 1
                      return (
                        <td key={tgl} className={isHariLibur(tgl) ? 'kolom-libur' : ''}>
                          {isHariLibur(tgl) ? '' : kodeSel(status)}
                        </td>
                      )
                    })}
                    <td>{b.sakit || ''}</td>
                    <td>{b.izin || ''}</td>
                    <td>{b.tanpaKeterangan || ''}</td>
                    <td>{b.jumlahTidakHadir || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-8 text-sm" style={{ textAlign: 'right' }}>
              <p>{profilSekolah?.tempat_ttd || '(isi Nama Tempat di Profil Sekolah)'}, {jumlahHariDalamBulan(tahun, bulan)} {NAMA_BULAN[bulan - 1].toUpperCase()} {tahun}</p>
              <p>KEPALA SEKOLAH</p>
              {/* TAMBAHAN: tanda tangan elektronik, diambil otomatis dari Profil Sekolah.
                  Kalau belum diupload di Profil Sekolah, tetap tampil ruang kosong seperti semula. */}
              <div style={{ height: 64, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                {ttdUrl && <img src={ttdUrl} alt="Tanda tangan kepala sekolah" className="ttd-elektronik" />}
              </div>
              <p style={{ fontWeight: 600 }}>{profilSekolah?.kepala_sekolah || '________________'}</p>
              <p>NIP. {profilSekolah?.nip_kepala_sekolah || '-'}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
