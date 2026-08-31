import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  Send,
  Paperclip,
  Search,
  ArrowLeft,
  Loader2,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  X,
  MessageCircle,
} from 'lucide-react'

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const VIDEO_EXT = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi', 'm4v']

function getExt(fileName = '') {
  return (fileName.split('.').pop() || '').toLowerCase()
}

function tipeDariNamaFile(fileName) {
  const ext = getExt(fileName)
  if (IMAGE_EXT.includes(ext)) return 'gambar'
  if (VIDEO_EXT.includes(ext)) return 'video'
  return 'dokumen'
}

function getInisial(nama) {
  if (!nama) return '?'
  const kata = nama.trim().split(/\s+/)
  return (kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2)).toUpperCase()
}

function formatWaktu(iso) {
  const d = new Date(iso)
  const sekarang = new Date()
  const sama_hari = d.toDateString() === sekarang.toDateString()
  if (sama_hari) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// Menampilkan satu lampiran pesan (dokumen/gambar/video). URL ditandatangani
// diambil sendiri per-item karena bucket lampiran bersifat privat, sedangkan
// file yang dibagikan dari Galeri (bucket publik) pakai URL langsung.
function LampiranPesan({ bucket, path, nama, tipe }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let aktif = true
    async function ambilUrl() {
      if (bucket === 'galeri-foto') {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        if (aktif) setUrl(data?.publicUrl || null)
        return
      }
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600)
      if (aktif) setUrl(data?.signedUrl || null)
    }
    ambilUrl()
    return () => { aktif = false }
  }, [bucket, path])

  if (!url) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Memuat lampiran...
      </div>
    )
  }

  if (tipe === 'gambar') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block max-w-[220px]">
        <img src={url} alt={nama} className="rounded-lg max-h-56 w-auto object-cover" />
      </a>
    )
  }
  if (tipe === 'video') {
    return <video src={url} controls className="rounded-lg max-w-[260px] max-h-64" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 border border-slate-200 text-xs font-medium text-slate-700 hover:bg-white transition max-w-[240px]"
    >
      <FileText size={16} className="text-blue-700 shrink-0" />
      <span className="truncate flex-1">{nama}</span>
      <Download size={14} className="text-slate-400 shrink-0" />
    </a>
  )
}

export default function Pesan() {
  const { session, profil } = useAuth()
  const myId = session?.user?.id

  const [kontak, setKontak] = useState([])
  const [loadingKontak, setLoadingKontak] = useState(true)
  const [ringkasan, setRingkasan] = useState({}) // { [profil_id]: { lastMsg, waktu, unread } }
  const [cari, setCari] = useState('')

  const [aktif, setAktif] = useState(null) // kontak yang sedang dibuka
  const [messages, setMessages] = useState([])
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [teks, setTeks] = useState('')
  const [file, setFile] = useState(null)
  const [mengirim, setMengirim] = useState(false)
  const [showChatMobile, setShowChatMobile] = useState(false)

  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  const loadRingkasan = useCallback(async () => {
    if (!myId) return
    const { data } = await supabase
      .from('pesan')
      .select('id, pengirim_id, penerima_id, isi, file_nama, file_tipe, dibaca, dibuat_pada')
      .or(`pengirim_id.eq.${myId},penerima_id.eq.${myId}`)
      .order('dibuat_pada', { ascending: false })
      .limit(500)

    const map = {}
    for (const m of data || []) {
      const lawan = m.pengirim_id === myId ? m.penerima_id : m.pengirim_id
      if (!map[lawan]) {
        map[lawan] = {
          lastMsg: m.isi || (m.file_nama ? `📎 ${m.file_nama}` : ''),
          waktu: m.dibuat_pada,
          unread: 0,
        }
      }
      if (m.penerima_id === myId && !m.dibaca) map[lawan].unread += 1
    }
    setRingkasan(map)
  }, [myId])

  const loadKontak = useCallback(async () => {
    setLoadingKontak(true)
    const { data, error } = await supabase.rpc('daftar_kontak_pesan')
    if (!error) setKontak(data || [])
    setLoadingKontak(false)
  }, [])

  useEffect(() => {
    loadKontak()
    loadRingkasan()
  }, [loadKontak, loadRingkasan])

  // Realtime: pesan masuk baru — refresh ringkasan, dan kalau percakapan
  // yang sedang dibuka relevan, tambahkan langsung + tandai dibaca.
  useEffect(() => {
    if (!myId) return
    const channel = supabase
      .channel('pesan-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pesan' },
        (payload) => {
          const m = payload.new
          if (m.pengirim_id !== myId && m.penerima_id !== myId) return
          loadRingkasan()
          setAktif((currentAktif) => {
            if (currentAktif && (m.pengirim_id === currentAktif.profil_id || m.penerima_id === currentAktif.profil_id)) {
              setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
              if (m.penerima_id === myId) {
                supabase.from('pesan').update({ dibaca: true }).eq('id', m.id).then(() => {})
              }
            }
            return currentAktif
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [myId, loadRingkasan])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function bukaPercakapan(k) {
    setAktif(k)
    setShowChatMobile(true)
    setLoadingMsg(true)
    const { data } = await supabase
      .from('pesan')
      .select('*')
      .or(
        `and(pengirim_id.eq.${myId},penerima_id.eq.${k.profil_id}),and(pengirim_id.eq.${k.profil_id},penerima_id.eq.${myId})`
      )
      .order('dibuat_pada', { ascending: true })
    setMessages(data || [])
    setLoadingMsg(false)

    const belumDibaca = (data || []).filter((m) => m.penerima_id === myId && !m.dibaca)
    if (belumDibaca.length > 0) {
      await supabase
        .from('pesan')
        .update({ dibaca: true })
        .in('id', belumDibaca.map((m) => m.id))
      loadRingkasan()
    }
  }

  async function handleKirim(e) {
    e.preventDefault()
    if (!teks.trim() && !file) return
    if (!aktif) return
    setMengirim(true)

    let lampiran = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${myId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('pesan-lampiran')
        .upload(path, file, { contentType: file.type || undefined })
      if (uploadError) {
        alert('Gagal mengunggah lampiran: ' + uploadError.message)
        setMengirim(false)
        return
      }
      lampiran = {
        file_bucket: 'pesan-lampiran',
        file_path: path,
        file_nama: file.name,
        file_tipe: tipeDariNamaFile(file.name),
        file_size: file.size,
      }
    }

    const payload = {
      sekolah_id: profil?.sekolah_id,
      pengirim_id: myId,
      penerima_id: aktif.profil_id,
      isi: teks.trim() || null,
      ...lampiran,
    }

    const { data: inserted, error } = await supabase.from('pesan').insert(payload).select().single()
    setMengirim(false)
    if (error) {
      alert('Gagal mengirim pesan: ' + error.message)
      return
    }
    setMessages((prev) => [...prev, inserted])
    setTeks('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadRingkasan()
  }

  const kontakTerfilter = kontak.filter((k) => (k.nama_lengkap || '').toLowerCase().includes(cari.toLowerCase()))
  const kontakTerurut = [...kontakTerfilter].sort((a, b) => {
    const wa = ringkasan[a.profil_id]?.waktu || ''
    const wb = ringkasan[b.profil_id]?.waktu || ''
    return wb.localeCompare(wa)
  })

  return (
    <Layout title="Pesan" subtitle="Kirim pesan, dokumen, gambar & video ke rekan satu sekolah">
      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 480 }}>
        <div className="flex h-full">
          {/* Daftar kontak */}
          <div className={`w-full sm:w-72 border-r border-slate-100 flex-col shrink-0 ${showChatMobile ? 'hidden sm:flex' : 'flex'}`}>
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input w-full border-slate-200 pl-8 text-sm"
                  placeholder="Cari rekan..."
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingKontak ? (
                <p className="text-sm text-slate-400 px-4 py-4">Memuat...</p>
              ) : kontakTerurut.length === 0 ? (
                <p className="text-sm text-slate-400 px-4 py-4">Belum ada rekan lain terdaftar.</p>
              ) : (
                kontakTerurut.map((k) => {
                  const r = ringkasan[k.profil_id]
                  return (
                    <button
                      key={k.profil_id}
                      onClick={() => bukaPercakapan(k)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-50 ${
                        aktif?.profil_id === k.profil_id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-9 h-9 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                        {getInisial(k.nama_lengkap)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-sm font-medium text-slate-900 truncate">{k.nama_lengkap}</span>
                          {r?.waktu && <span className="text-[10px] text-slate-400 shrink-0">{formatWaktu(r.waktu)}</span>}
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-xs text-slate-400 truncate block max-w-[140px]">{r?.lastMsg || 'Belum ada pesan'}</span>
                          {!!r?.unread && (
                            <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {r.unread > 9 ? '9+' : r.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Percakapan */}
          <div className={`flex-1 flex-col min-w-0 ${showChatMobile ? 'flex' : 'hidden sm:flex'}`}>
            {!aktif ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
                <MessageCircle size={40} />
                <p className="text-sm text-slate-400">Pilih rekan untuk mulai mengobrol</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                  <button onClick={() => setShowChatMobile(false)} className="sm:hidden p-1 -ml-1 rounded-lg hover:bg-slate-100">
                    <ArrowLeft size={18} />
                  </button>
                  <span className="w-8 h-8 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInisial(aktif.nama_lengkap)}
                  </span>
                  <p className="text-sm font-medium text-slate-900">{aktif.nama_lengkap}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60">
                  {loadingMsg ? (
                    <p className="text-sm text-slate-400">Memuat percakapan...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center mt-6">Belum ada pesan. Mulai percakapan sekarang.</p>
                  ) : (
                    messages.map((m) => {
                      const punyaSaya = m.pengirim_id === myId
                      return (
                        <div key={m.id} className={`flex ${punyaSaya ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                              punyaSaya ? 'bg-blue-900 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                            }`}
                          >
                            {m.file_path && (
                              <div className={m.isi ? 'mb-2' : ''}>
                                <LampiranPesan bucket={m.file_bucket} path={m.file_path} nama={m.file_nama} tipe={m.file_tipe} />
                              </div>
                            )}
                            {m.isi && <p className="whitespace-pre-wrap break-words">{m.isi}</p>}
                            <p className={`text-[10px] mt-1 ${punyaSaya ? 'text-blue-200/70' : 'text-slate-400'}`}>{formatWaktu(m.dibuat_pada)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={handleKirim} className="p-3 border-t border-slate-100 shrink-0">
                  {file && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 w-fit max-w-full">
                      {tipeDariNamaFile(file.name) === 'gambar' ? <ImageIcon size={13} /> : tipeDariNamaFile(file.name) === 'video' ? <Video size={13} /> : <FileText size={13} />}
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-slate-400 hover:text-red-500">
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*,video/*"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
                      title="Lampirkan dokumen, gambar, atau video"
                    >
                      <Paperclip size={18} />
                    </button>
                    <input
                      className="input flex-1 border-slate-200 text-sm"
                      placeholder="Tulis pesan..."
                      value={teks}
                      onChange={(e) => setTeks(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={mengirim || (!teks.trim() && !file)}
                      className="p-2.5 rounded-lg bg-brass-400 text-ink-950 hover:brightness-95 disabled:opacity-50 transition shrink-0"
                    >
                      {mengirim ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
