import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import {
  Search, User, Award, BookOpenCheck, ClipboardCheck, Download,
  Loader2, GraduationCap, FileX,
} from 'lucide-react'

// Halaman "Portofolio Siswa": merangkum data yang SUDAH ADA di aplikasi
// (biodata dari tabel siswa, presensi dari presensi_siswa, nilai dari
// tabel nilai, sertifikat/penghargaan dari sertifikat_penghargaan) jadi
// satu tampilan ringkas per siswa. Sengaja tidak membuat tabel baru.

function getFotoUrl(fotoPath) {
  if (!fotoPath) return null
  if (fotoPath.startsWith('http')) return fotoPath
  return supabase.storage.from('foto-siswa').getPublicUrl(fotoPath).data?.publicUrl || null
}

function getSertifikatUrl(filePath) {
  if (!filePath) return null
  return supabase.storage.from('sertifikat-files').getPublicUrl(filePath).data?.publicUrl || null
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

// Ringkasan Kehadiran
function RingkasanPresensi({ siswaId }) {
  const [loading, setLoading] = useState(true)
  const [rekap, setRekap] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 })

  useEffect(() => {
    let aktif = true
    setLoading(true)
    supabase
      .from('presensi_siswa')
      .select('status')
      .eq('siswa_id', siswaId)
      .then(({ data }) => {
        if (!aktif) return
        const rows = data || []
        const rekapBaru = { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: rows.length }
        rows.forEach((r) => {
          if (rekapBaru[r.status] !== undefined) rekapBaru[r.status] += 1
        })
        setRekap(rekapBaru)
        setLoading(false)
      })
    return () => { aktif = false }
  }, [siswaId])

  const persenHadir = rekap.total > 0 ? Math.round((rekap.hadir / rekap.total) * 100) : null

  const kartu = [
    { label: 'Hadir', nilai: rekap.hadir, warna: 'text-emerald-600 bg-emerald-50' },
    { label: 'Izin', nilai: rekap.izin, warna: 'text-amber-600 bg-amber-50' },
    { label: 'Sakit', nilai: rekap.sakit, warna: 'text-sky-600 bg-sky-50' },
    { label: 'Alpa', nilai: rekap.alpa, warna: 'text-rose-600 bg-rose-50' },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck size={18} className="text-blue-600" />
        <h3 className="font-display font-semibold text-slate-800">Ringkasan Kehadiran</h3>
        {!loading && persenHadir !== null && (
          <span className="ml-auto text-sm font-semibold text-slate-500">{persenHadir}% hadir</span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : rekap.total === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Belum ada data presensi.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {kartu.map((k) => (
            <div key={k.label} className={`rounded-lg px-2 py-3 text-center ${k.warna}`}>
              <p className="text-lg font-bold">{k.nilai}</p>
              <p className="text-[11px] font-medium">{k.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Ringkasan Nilai (rata-rata per mata pelajaran, dari data terbaru yang tersedia)
function RingkasanNilai({ siswaId }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  useEffect(() => {
    let aktif = true
    setLoading(true)
    supabase
      .from('nilai')
      .select('mata_pelajaran, nilai, semester, tahun_ajaran')
      .eq('siswa_id', siswaId)
      .then(({ data }) => {
        if (!aktif) return
        setRows(data || [])
        setLoading(false)
      })
    return () => { aktif = false }
  }, [siswaId])

  const ringkasan = useMemo(() => {
    if (!rows.length) return []
    // Ambil periode (semester + tahun ajaran) paling akhir yang muncul di data
    const periodeUrut = [...new Set(rows.map((r) => `${r.tahun_ajaran}|${r.semester}`))].sort()
    const periodeTerbaru = periodeUrut[periodeUrut.length - 1]
    const rowsTerbaru = rows.filter((r) => `${r.tahun_ajaran}|${r.semester}` === periodeTerbaru)

    const perMapel = {}
    rowsTerbaru.forEach((r) => {
      if (!perMapel[r.mata_pelajaran]) perMapel[r.mata_pelajaran] = []
      if (typeof r.nilai === 'number') perMapel[r.mata_pelajaran].push(r.nilai)
    })
    return Object.entries(perMapel).map(([mapel, nilaiArr]) => ({
      mapel,
      rata: nilaiArr.length ? Math.round((nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length) * 10) / 10 : null,
    })).sort((a, b) => a.mapel.localeCompare(b.mapel))
  }, [rows])

  const periodeLabel = rows.length
    ? (() => {
        const p = [...new Set(rows.map((r) => `${r.tahun_ajaran}|${r.semester}`))].sort().pop()
        const [ta, sem] = p.split('|')
        return `${sem} ${ta}`
      })()
    : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BookOpenCheck size={18} className="text-blue-600" />
        <h3 className="font-display font-semibold text-slate-800">Ringkasan Nilai</h3>
        {periodeLabel && <span className="ml-auto text-xs font-medium text-slate-400">{periodeLabel}</span>}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : ringkasan.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Belum ada data nilai.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {ringkasan.map((r) => (
            <div key={r.mapel} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600">{r.mapel}</span>
              <span className="font-semibold text-slate-800">{r.rata ?? '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Sertifikat & Penghargaan milik siswa
function DaftarSertifikat({ siswaId }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  useEffect(() => {
    let aktif = true
    setLoading(true)
    supabase
      .from('sertifikat_penghargaan')
      .select('id, jenis, judul, penyelenggara, tanggal, file_path')
      .eq('penerima_tipe', 'siswa')
      .eq('siswa_id', siswaId)
      .order('tanggal', { ascending: false })
      .then(({ data }) => {
        if (!aktif) return
        setRows(data || [])
        setLoading(false)
      })
    return () => { aktif = false }
  }, [siswaId])

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award size={18} className="text-blue-600" />
        <h3 className="font-display font-semibold text-slate-800">Sertifikat & Penghargaan</h3>
        {!loading && <span className="ml-auto text-xs font-medium text-slate-400">{rows.length} item</span>}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Belum ada sertifikat/penghargaan.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{s.judul || '(Tanpa judul)'}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.jenis === 'sertifikat' ? 'Sertifikat' : 'Piagam Penghargaan'}
                  {s.penyelenggara ? ` · ${s.penyelenggara}` : ''} · {formatTanggal(s.tanggal)}
                </p>
              </div>
              {s.file_path && (
                <a
                  href={getSertifikatUrl(s.file_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                  title="Unduh"
                >
                  <Download size={16} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PortofolioSiswa() {
  const [kelasList, setKelasList] = useState([])
  const [kelasId, setKelasId] = useState('')
  const [siswaList, setSiswaList] = useState([])
  const [search, setSearch] = useState('')
  const [siswaTerpilih, setSiswaTerpilih] = useState(null)
  const [loadingSiswa, setLoadingSiswa] = useState(true)

  useEffect(() => {
    supabase.from('kelas').select('id, nama_kelas').order('nama_kelas').then(({ data }) => {
      setKelasList(data || [])
      if (data?.length) setKelasId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!kelasId) return
    setLoadingSiswa(true)
    setSiswaTerpilih(null)
    supabase
      .from('siswa')
      .select('id, nama_lengkap, nis, nisn, jenis_kelamin, tanggal_lahir, tempat_lahir, foto_path, kelas(nama_kelas)')
      .eq('kelas_id', kelasId)
      .order('nama_lengkap')
      .then(({ data }) => {
        setSiswaList(data || [])
        setLoadingSiswa(false)
      })
  }, [kelasId])

  const siswaFilter = siswaList.filter((s) =>
    `${s.nama_lengkap} ${s.nis} ${s.nisn}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Portofolio Siswa" subtitle="Ringkasan biodata, kehadiran, nilai, dan prestasi setiap siswa">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Panel pilih siswa */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 h-fit lg:sticky lg:top-24">
          <select
            className="w-full mb-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={kelasId}
            onChange={(e) => setKelasId(e.target.value)}
          >
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama_kelas}</option>
            ))}
          </select>

          <div className="relative mb-3">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama / NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {loadingSiswa ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat...
              </div>
            ) : siswaFilter.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Tidak ada siswa.</p>
            ) : (
              siswaFilter.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSiswaTerpilih(s)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    siswaTerpilih?.id === s.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {getFotoUrl(s.foto_path) ? (
                    <img src={getFotoUrl(s.foto_path)} alt={s.nama_lengkap} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User size={14} className="text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">NIS {s.nis || '-'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail portofolio */}
        <div>
          {!siswaTerpilih ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400">
              <FileX size={40} className="mb-3" />
              <p className="text-sm">Pilih siswa di daftar sebelah kiri untuk melihat portofolionya.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Biodata */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                {getFotoUrl(siswaTerpilih.foto_path) ? (
                  <img
                    src={getFotoUrl(siswaTerpilih.foto_path)}
                    alt={siswaTerpilih.nama_lengkap}
                    className="w-16 h-16 rounded-full object-cover border border-slate-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <User size={26} className="text-slate-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-slate-900 truncate">{siswaTerpilih.nama_lengkap}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    NIS {siswaTerpilih.nis || '-'} · NISN {siswaTerpilih.nisn || '-'}
                  </p>
                  <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
                    <GraduationCap size={14} />
                    {siswaTerpilih.kelas?.nama_kelas || '-'}
                    {' · '}
                    {siswaTerpilih.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                    {siswaTerpilih.tempat_lahir || siswaTerpilih.tanggal_lahir
                      ? ` · ${siswaTerpilih.tempat_lahir || ''}${siswaTerpilih.tempat_lahir && siswaTerpilih.tanggal_lahir ? ', ' : ''}${formatTanggal(siswaTerpilih.tanggal_lahir)}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <RingkasanPresensi siswaId={siswaTerpilih.id} />
                <RingkasanNilai siswaId={siswaTerpilih.id} />
              </div>

              <DaftarSertifikat siswaId={siswaTerpilih.id} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
