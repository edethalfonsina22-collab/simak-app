import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import StatusGuruModal from '../components/StatusGuruModal'
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
  ShieldCheck,
  MessageCircle,
  Building2,
  Users,
} from 'lucide-react'

// Halaman ini KHUSUS admin-tier (admin, kepala_sekolah, admin_utama) dan
// Superadmin — dijaga juga lewat route (adminOnly) & menu Sidebar, tapi
// guru sama sekali tidak pernah sampai ke halaman ini.
//
// Model data: satu THREAD per sekolah (bukan per-user) di tabel
// pesan_pusat — semua admin/kepsek satu sekolah berbagi satu percakapan
// yang sama dengan "Admin Pusat" (Superadmin). Lihat sql/06_chat_admin_pusat.sql.
//
// Status Guru: memakai Supabase Realtime Presence (lihat
// src/hooks/usePresenceTracker.js yang dipasang di Layout.jsx, dan
// src/hooks/useOnlineGuru.js + src/components/StatusGuruModal.jsx di sini)
// — Superadmin bisa klik tombol "Status Guru" saat sedang membuka thread
// sebuah sekolah untuk melihat guru mana yang sedang online.

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

// Sama seperti di Pesan.jsx: lampiran diambil dari bucket privat
// 'pesan-lampiran' (dishare dengan fitur Pesan biasa) via signed URL.
function LampiranPesan({ bucket, path, nama, tipe }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let aktif = true
    async function ambilUrl() {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600)
      if (aktif) setUrl(data?.signedUrl || null)
    }
    ambilUrl()
    return () => {
      aktif = false
    }
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

export default function PesanPusat() {
  const { session, sekolahId, isSuperAdmin } = useAuth()
  const myId = session?.user?.id
  const sisiSaya = isSuperAdmin ? 'pusat' : 'sekolah'

  // --- khusus Superadmin: daftar sekolah + ringkasan per sekolah ---
  const [daftarSekolah, setDaftarSekolah] = useState([])
  const [loadingSekolah, setLoadingSekolah] = useState(isSuperAdmin)
  const [ringkasan, setRingkasan] = useState({}) // { [sekolah_id]: { lastMsg, waktu, unread } }
  const [cari, setCari] = useState('')
  const [sekolahAktif, setSekolahAktif] = useState(null) // { id, nama_sekolah }
  const [showStatusGuru, setShowStatusGuru] = useState(false)

  // sekolah_id percakapan yang sedang dibuka (untuk admin/kepsek selalu = sekolahId sendiri)
  const sekolahIdAktif = isSuperAdmin ? sekolahAktif?.id : sekolahId

  const [messages, setMessages] = useState([])
  const [loadingMsg, setLoadingMsg] = useState(!isSuperAdmin)
  const [teks, setTeks] = useState('')
  const [file, setFile] = useState(null)
  const [mengirim, setMengirim] = useState(false)
  const [showChatMobile, setShowChatMobile] = useState(false)

  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  // ---------- Superadmin: muat daftar sekolah + ringkasan ----------
  const loadDaftarSekolah = useCallback(async () => {
    const { data } = await supabase.from('sekolah').select('id, nama_sekolah').order('nama_sekolah')
    setDaftarSekolah(data || [])
    setLoadingSekolah(false)
  }, [])

  const loadRingkasanPusat = useCallback(async () => {
    const { data } = await supabase
      .from('pesan_pusat')
      .select('sekolah_id, isi, file_nama, sisi, dibaca_pusat, dibuat_pada')
      .order('dibuat_pada', { ascending: false })
      .limit(1000)

    const map = {}
    for (const m of data || []) {
      if (!map[m.sekolah_id]) {
        map[m.sekolah_id] = {
          lastMsg: m.isi || (m.file_nama ? `📎 ${m.file_nama}` : ''),
          waktu: m.dibuat_pada,
          unread: 0,
        }
      }
      if (m.sisi === 'sekolah' && !m.dibaca_pusat) map[m.sekolah_id].unread += 1
    }
    setRingkasan(map)
  }, [])

  useEffect(() => {
    if (!isSuperAdmin) return
    loadDaftarSekolah()
    loadRingkasanPusat()
  }, [isSuperAdmin, loadDaftarSekolah, loadRingkasanPusat])

  // ---------- Admin/Kepsek: langsung buka thread sekolah sendiri ----------
  const muatThreadSekolah = useCallback(async () => {
    if (!sekolahId) return
    setLoadingMsg(true)
    const { data } = await supabase
      .from('pesan_pusat')
      .select('*')
      .eq('sekolah_id', sekolahId)
      .order('dibuat_pada', { ascending: true })
    setMessages(data || [])
    setLoadingMsg(false)

    const belumDibaca = (data || []).filter((m) => m.sisi === 'pusat' && !m.dibaca_sekolah)
    if (belumDibaca.length > 0) {
      await supabase
        .from('pesan_pusat')
        .update({ dibaca_sekolah: true })
        .in('id', belumDibaca.map((m) => m.id))
    }
  }, [sekolahId])

  useEffect(() => {
    if (isSuperAdmin) return
    muatThreadSekolah()
  }, [isSuperAdmin, muatThreadSekolah])

  // ---------- Superadmin: buka thread sekolah tertentu ----------
  async function bukaSekolah(s) {
    setSekolahAktif(s)
    setShowChatMobile(true)
    setLoadingMsg(true)
    const { data } = await supabase
      .from('pesan_pusat')
      .select('*')
      .eq('sekolah_id', s.id)
      .order('dibuat_pada', { ascending: true })
    setMessages(data || [])
    setLoadingMsg(false)

    const belumDibaca = (data || []).filter((m) => m.sisi === 'sekolah' && !m.dibaca_pusat)
    if (belumDibaca.length > 0) {
      await supabase
        .from('pesan_pusat')
        .update({ dibaca_pusat: true })
        .in('id', belumDibaca.map((m) => m.id))
      loadRingkasanPusat()
    }
  }

  // ---------- Realtime ----------
  useEffect(() => {
    if (!myId) return
    const channel = supabase
      .channel('pesan-pusat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan_pusat' }, (payload) => {
        const m = payload.new

        if (isSuperAdmin) {
          loadRingkasanPusat()
          setSekolahAktif((current) => {
            if (current && m.sekolah_id === current.id) {
              setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
              if (m.sisi === 'sekolah') {
                supabase.from('pesan_pusat').update({ dibaca_pusat: true }).eq('id', m.id).then(() => {})
              }
            }
            return current
          })
          return
        }

        if (m.sekolah_id !== sekolahId) return
        setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
        if (m.sisi === 'pusat') {
          supabase.from('pesan_pusat').update({ dibaca_sekolah: true }).eq('id', m.id).then(() => {})
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [myId, isSuperAdmin, sekolahId, loadRingkasanPusat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleKirim(e) {
    e.preventDefault()
    if (!teks.trim() && !file) return
    if (!sekolahIdAktif) return
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
      sekolah_id: sekolahIdAktif,
      pengirim_id: myId,
      sisi: sisiSaya,
      isi: teks.trim() || null,
      dibaca_sekolah: sisiSaya === 'sekolah',
      dibaca_pusat: sisiSaya === 'pusat',
      ...lampiran,
    }

    const { data: inserted, error } = await supabase.from('pesan_pusat').insert(payload).select().single()
    setMengirim(false)
    if (error) {
      alert('Gagal mengirim pesan: ' + error.message)
      return
    }
    setMessages((prev) => [...prev, inserted])
    setTeks('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (isSuperAdmin) loadRingkasanPusat()
  }

  const daftarSekolahTerfilter = daftarSekolah.filter((s) =>
    (s.nama_sekolah || '').toLowerCase().includes(cari.toLowerCase())
  )
  const daftarSekolahTerurut = [...daftarSekolahTerfilter].sort((a, b) => {
    const wa = ringkasan[a.id]?.waktu || ''
    const wb = ringkasan[b.id]?.waktu || ''
    return wb.localeCompare(wa)
  })

  // ---------- Tampilan percakapan (dipakai kedua peran) ----------
  const percakapanTerbuka = isSuperAdmin ? !!sekolahAktif : true

  const headerInfo = isSuperAdmin
    ? { nama: sekolahAktif?.nama_sekolah, sub: 'Admin & Kepala Sekolah' }
    : { nama: 'Admin Pusat', sub: 'Superadmin SIMAK' }

  return (
    <Layout
      title="Admin Pusat"
      subtitle={
        isSuperAdmin
          ? 'Chat langsung dengan Admin/Kepala Sekolah tiap sekolah'
          : 'Chat langsung dengan Admin Pusat (Superadmin) — khusus Admin & Kepala Sekolah'
      }
    >
      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 480 }}>
        <div className="flex h-full">
          {/* Daftar sekolah — hanya untuk Superadmin */}
          {isSuperAdmin && (
            <div className={`w-full sm:w-72 border-r border-slate-100 flex-col shrink-0 ${showChatMobile ? 'hidden sm:flex' : 'flex'}`}>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input w-full border-slate-200 pl-8 text-sm"
                    placeholder="Cari sekolah..."
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingSekolah ? (
                  <p className="text-sm text-slate-400 px-4 py-4">Memuat...</p>
                ) : daftarSekolahTerurut.length === 0 ? (
                  <p className="text-sm text-slate-400 px-4 py-4">Belum ada sekolah terdaftar.</p>
                ) : (
                  daftarSekolahTerurut.map((s) => {
                    const r = ringkasan[s.id]
                    return (
                      <button
                        key={s.id}
                        onClick={() => bukaSekolah(s)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-50 ${
                          sekolahAktif?.id === s.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-9 h-9 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                          <Building2 size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-1">
                            <span className="text-sm font-medium text-slate-900 truncate">{s.nama_sekolah}</span>
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
          )}

          {/* Percakapan */}
          <div className={`flex-1 flex-col min-w-0 ${!isSuperAdmin || showChatMobile ? 'flex' : 'hidden sm:flex'}`}>
            {!percakapanTerbuka ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
                <MessageCircle size={40} />
                <p className="text-sm text-slate-400">Pilih sekolah untuk mulai percakapan</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                  {isSuperAdmin && (
                    <button onClick={() => setShowChatMobile(false)} className="sm:hidden p-1 -ml-1 rounded-lg hover:bg-slate-100">
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <span className="w-8 h-8 rounded-full bg-brass-500 text-white flex items-center justify-center shrink-0">
                    {isSuperAdmin ? <Building2 size={15} /> : <ShieldCheck size={15} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{headerInfo.nama}</p>
                    <p className="text-[11px] text-slate-400">{headerInfo.sub}</p>
                  </div>
                  {isSuperAdmin && sekolahAktif && (
                    <button
                      onClick={() => setShowStatusGuru(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 shrink-0"
                      title="Lihat status guru online"
                    >
                      <Users size={15} />
                      <span className="hidden sm:inline">Status Guru</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60">
                  {loadingMsg ? (
                    <p className="text-sm text-slate-400">Memuat...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center mt-6">Belum ada pesan. Mulai percakapan sekarang.</p>
                  ) : (
                    messages.map((m) => {
                      const punyaSaya = m.sisi === sisiSaya
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

      {showStatusGuru && sekolahAktif && (
        <StatusGuruModal sekolah={sekolahAktif} onClose={() => setShowStatusGuru(false)} />
      )}
    </Layout>
  )
}
