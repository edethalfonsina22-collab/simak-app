import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  Image as ImageIcon, Video, FileText, Award, Loader2, Info, X, Download,
} from 'lucide-react'

// ============================================================
// Halaman khusus ORANG TUA — read-only, mengikuti pola aman yang sama
// dengan RaporAnak.jsx dan PresensiAnak.jsx: anak diambil lewat
// getAnakSaya() (AuthContext), yang query-nya dibatasi ke tabel
// `orang_tua_siswa` sesuai akun orang tua yang sedang login.
//
// Data portofolio diambil dari tabel `sertifikat_penghargaan` yang sudah
// ada (dipakai bersama oleh guru untuk generate sertifikat AI maupun
// upload manual foto/video/dokumen/catatan). Query di sini SENGAJA tetap
// memfilter `siswa_id` ke anak yang dipilih meskipun RLS di server sudah
// membatasi ke anak sendiri — supaya tidak bergantung sepenuhnya pada
// satu lapis keamanan saja (defense in depth).
// ============================================================

const JENIS_INFO = {
  foto_kegiatan: { label: 'Foto Kegiatan', icon: ImageIcon, warna: 'bg-blue-50 text-blue-600' },
  video: { label: 'Video', icon: Video, warna: 'bg-purple-50 text-purple-600' },
  dokumen_tugas: { label: 'Dokumen/Tugas', icon: FileText, warna: 'bg-slate-100 text-slate-600' },
  catatan_prestasi: { label: 'Catatan Prestasi', icon: FileText, warna: 'bg-emerald-50 text-emerald-600' },
  sertifikat: { label: 'Sertifikat', icon: Award, warna: 'bg-amber-50 text-amber-600' },
  penghargaan: { label: 'Piagam Penghargaan', icon: Award, warna: 'bg-amber-50 text-amber-600' },
}

function formatTanggal(tgl) {
  if (!tgl) return null
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

function isGambar(namaFile) {
  return /\.(jpe?g|png|webp|gif)$/i.test(namaFile || '')
}
function isVideoFile(namaFile) {
  return /\.(mp4|webm|mov)$/i.test(namaFile || '')
}

export default function PortofolioAnak() {
  const { getAnakSaya } = useAuth()

  const [anakList, setAnakList] = useState([])
  const [anakId, setAnakId] = useState('')
  const [loadingAnak, setLoadingAnak] = useState(true)

  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [preview, setPreview] = useState(null)

  // Ambil daftar anak HANYA lewat tabel orang_tua_siswa (via getAnakSaya di
  // AuthContext) — tidak ada jalur lain untuk memilih siswa.
  useEffect(() => {
    async function muatAnak() {
      setLoadingAnak(true)
      const { data } = await getAnakSaya()
      const list = data || []
      setAnakList(list)
      // Auto-pilih anak pertama yang hubungannya sudah disetujui admin.
      const pertama = list.find((a) => a.status === 'aktif')
      if (pertama) setAnakId(pertama.siswa.id)
      setLoadingAnak(false)
    }
    muatAnak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const anakTerpilih = anakList.find((a) => a.siswa.id === anakId)
  const siswa = anakTerpilih?.siswa
  const anakDisetujui = anakList.filter((a) => a.status === 'aktif')

  useEffect(() => {
    if (!anakId) return
    async function muatPortofolio() {
      setLoadingItems(true)
      const { data } = await supabase
        .from('sertifikat_penghargaan')
        .select('*')
        .eq('penerima_tipe', 'siswa')
        .eq('siswa_id', anakId)
        .order('tanggal', { ascending: false, nullsFirst: false })
        .order('dibuat_pada', { ascending: false })
      setItems(data || [])
      setLoadingItems(false)
    }
    muatPortofolio()
  }, [anakId])

  async function getFileUrl(path) {
    const { data, error } = await supabase.storage.from('sertifikat-files').createSignedUrl(path, 300)
    if (error) throw error
    return data.signedUrl
  }

  async function handlePreview(item) {
    try {
      const url = await getFileUrl(item.file_path)
      setPreview({ url, item })
    } catch (err) {
      alert('Gagal membuka file: ' + err.message)
    }
  }

  async function handleDownload(item) {
    try {
      const url = await getFileUrl(item.file_path)
      const a = document.createElement('a')
      a.href = url
      a.download = item.file_nama
      a.click()
    } catch (err) {
      alert('Gagal mengunduh: ' + err.message)
    }
  }

  return (
    <Layout title="Portofolio Anak" subtitle="Foto kegiatan, video, dokumen, dan prestasi anak Anda">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-blue-950 p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <ImageIcon size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-white">Portofolio Anak</p>
            <p className="text-sm text-white/70 mt-0.5">
              {siswa ? `${siswa.nama_lengkap} · ${siswa.kelas?.nama_kelas || '-'}` : 'Memuat data anak...'}
            </p>
          </div>
        </div>
        <ImageIcon size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5">
        {loadingAnak ? (
          <p className="text-sm text-ink-700/50 flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Memuat data anak...
          </p>
        ) : anakList.length === 0 ? (
          <p className="text-sm text-ink-700/50">
            Akun Anda belum terhubung dengan siswa manapun. Silakan hubungi admin sekolah.
          </p>
        ) : anakDisetujui.length === 0 ? (
          <p className="text-sm text-amber-600 flex items-center gap-2">
            <Info size={15} /> Hubungan Anda dengan anak masih menunggu persetujuan admin sekolah.
          </p>
        ) : anakDisetujui.length > 1 ? (
          <div>
            <label className="label-field">Pilih Anak</label>
            <select className="input-field" value={anakId} onChange={(e) => setAnakId(e.target.value)}>
              {anakDisetujui.map((a) => (
                <option key={a.siswa.id} value={a.siswa.id}>
                  {a.siswa.nama_lengkap} {a.siswa.kelas?.nama_kelas ? `(${a.siswa.kelas.nama_kelas})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {siswa && anakDisetujui.length > 0 && (
        <div className="card p-6">
          {loadingItems ? (
            <p className="text-sm text-ink-700/50 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" /> Memuat portofolio...
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-700/50 text-center py-8">
              Belum ada item portofolio untuk {siswa.nama_lengkap}.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const info = JENIS_INFO[item.jenis] || { label: item.jenis, icon: FileText, warna: 'bg-slate-100 text-slate-600' }
                const Icon = info.icon
                return (
                  <div key={item.id} className="border border-ink-950/10 rounded-xl overflow-hidden flex flex-col">
                    <button
                      onClick={() => handlePreview(item)}
                      className="h-36 bg-ink-950/[0.03] flex items-center justify-center hover:bg-ink-950/[0.06] transition-colors"
                    >
                      <Icon size={32} className="text-ink-700/30" />
                    </button>
                    <div className="p-3 flex-1 flex flex-col">
                      <span className={`self-start text-[11px] font-medium px-2 py-0.5 rounded-md mb-1.5 ${info.warna}`}>
                        {info.label}
                      </span>
                      <p className="text-sm font-medium text-ink-950 truncate">{item.judul}</p>
                      {item.deskripsi && (
                        <p className="text-xs text-ink-700/60 mt-1 line-clamp-2">{item.deskripsi}</p>
                      )}
                      <p className="text-[11px] text-ink-700/40 mt-2">
                        {formatTanggal(item.tanggal) || formatTanggal(item.dibuat_pada)}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleDownload(item)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Download size={12} /> Unduh
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-900/[0.08]">
              <p className="text-sm font-medium text-ink-900 truncate pr-4">{preview.item.judul}</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-ink-900/[0.05] shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/5 p-4">
              {isGambar(preview.item.file_nama) ? (
                <img src={preview.url} alt={preview.item.judul} className="max-w-full max-h-full object-contain" />
              ) : isVideoFile(preview.item.file_nama) ? (
                <video src={preview.url} controls className="max-w-full max-h-full" />
              ) : (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(preview.url)}&embedded=true`}
                  title={preview.item.file_nama}
                  className="w-full h-full"
                  style={{ border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
