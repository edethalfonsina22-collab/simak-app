import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { Search, Send, X, Loader2, FileText, Image as ImageIcon, Video, CheckCircle2 } from 'lucide-react'

const TIPE_ICON = { dokumen: FileText, gambar: ImageIcon, video: Video }

// Modal umum untuk membagikan satu file (dokumen/gambar/video) yang SUDAH
// ADA di storage (dari halaman Dokumen Penting / Galeri Kegiatan) ke salah
// satu rekan lewat fitur Pesan. Tidak upload ulang file — hanya menyimpan
// referensi bucket + path, karena kedua bucket sumber sudah bisa diakses
// bersama oleh seluruh warga sekolah.
//
// props:
//  - file: { bucket, path, nama, tipe: 'dokumen'|'gambar'|'video' }
//  - onClose()
export default function BagikanKePesanModal({ file, onClose }) {
  const { session } = useAuth()
  const [kontak, setKontak] = useState([])
  const [loadingKontak, setLoadingKontak] = useState(true)
  const [cari, setCari] = useState('')
  const [dipilih, setDipilih] = useState(null)
  const [catatan, setCatatan] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [terkirim, setTerkirim] = useState(false)

  useEffect(() => {
    let aktif = true
    async function muat() {
      const { data, error } = await supabase.rpc('daftar_kontak_pesan')
      if (aktif) {
        if (!error) setKontak(data || [])
        setLoadingKontak(false)
      }
    }
    muat()
    return () => { aktif = false }
  }, [])

  const kontakTerfilter = kontak.filter((k) =>
    (k.nama_lengkap || '').toLowerCase().includes(cari.toLowerCase())
  )

  const Icon = TIPE_ICON[file?.tipe] || FileText

  async function handleKirim() {
    if (!dipilih) return
    setMengirim(true)

    const { data: profilSaya } = await supabase
      .from('profil')
      .select('sekolah_id')
      .eq('id', session.user.id)
      .maybeSingle()

    const { error } = await supabase.from('pesan').insert({
      sekolah_id: profilSaya?.sekolah_id,
      pengirim_id: session.user.id,
      penerima_id: dipilih.profil_id,
      isi: catatan.trim() || null,
      file_bucket: file.bucket,
      file_path: file.path,
      file_nama: file.nama,
      file_tipe: file.tipe,
    })

    setMengirim(false)
    if (error) {
      alert('Gagal membagikan: ' + error.message)
      return
    }
    setTerkirim(true)
    setTimeout(onClose, 1100)
  }

  function getInisial(nama) {
    if (!nama) return '?'
    const kata = nama.trim().split(/\s+/)
    return (kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2)).toUpperCase()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-slate-200 overflow-hidden">
          <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
          <div>
            <p className="font-display font-semibold text-slate-900">Bagikan ke Pesan</p>
            <p className="text-xs text-slate-500 mt-0.5">Kirim file ini lewat pesan internal</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0">
            <X size={18} />
          </button>
        </div>

        {terkirim ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-emerald-600">
            <CheckCircle2 size={36} />
            <p className="text-sm font-medium">Berhasil dibagikan ke {dipilih?.nama_lengkap}</p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 mb-3">
                <Icon size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{file?.nama}</span>
              </div>

              <div className="relative mb-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input w-full border-slate-200 pl-9"
                  placeholder="Cari nama guru/admin..."
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loadingKontak ? (
                <p className="text-sm text-slate-400 px-3 py-4">Memuat kontak...</p>
              ) : kontakTerfilter.length === 0 ? (
                <p className="text-sm text-slate-400 px-3 py-4">Tidak ada kontak ditemukan.</p>
              ) : (
                kontakTerfilter.map((k) => (
                  <button
                    key={k.profil_id}
                    onClick={() => setDipilih(k)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      dipilih?.profil_id === k.profil_id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                      {getInisial(k.nama_lengkap)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{k.nama_lengkap}</p>
                      <p className="text-xs text-slate-400 capitalize">{k.role === 'admin' ? 'Admin' : 'Guru'}</p>
                    </span>
                    {dipilih?.profil_id === k.profil_id && <CheckCircle2 size={18} className="text-blue-600 shrink-0" />}
                  </button>
                ))
              )}
            </div>

            <div className="px-5 pb-5 pt-2 border-t border-slate-100">
              <input
                className="input w-full border-slate-200 mb-3"
                placeholder="Tambahkan catatan (opsional)"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
              <button
                onClick={handleKirim}
                disabled={!dipilih || mengirim}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium hover:brightness-95 disabled:opacity-50 transition"
              >
                {mengirim ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {mengirim ? 'Mengirim...' : 'Kirim'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
