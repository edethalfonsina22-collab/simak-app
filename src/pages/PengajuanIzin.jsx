import { useEffect, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Send, CheckCircle2, XCircle, Clock, Loader2, CalendarClock, Printer, FileText, Eye } from 'lucide-react'

const STATUS_STYLE = {
  menunggu: 'bg-brass-400/15 text-brass-600',
  disetujui: 'bg-sage-500/15 text-sage-500',
  ditolak: 'bg-red-100 text-red-600',
}
const STATUS_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }

const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function rentangTanggal(mulai, selesai) {
  const hasil = []
  const cur = new Date(mulai)
  const akhir = new Date(selesai)
  while (cur <= akhir) {
    hasil.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return hasil
}

// Nomor surat otomatis, format: 001/SK-IZIN/VIII/2026
// Urutan dihitung dari jumlah surat yang sudah bernomor pada tahun berjalan.
async function buatNomorSurat() {
  const sekarang = new Date()
  const tahun = sekarang.getFullYear()
  const bulanRomawi = BULAN_ROMAWI[sekarang.getMonth()]
  const awalTahun = `${tahun}-01-01T00:00:00.000Z`
  const akhirTahun = `${tahun}-12-31T23:59:59.999Z`

  const { count, error } = await supabase
    .from('pengajuan_izin')
    .select('id', { count: 'exact', head: true })
    .not('nomor_surat', 'is', null)
    .gte('diproses_pada', awalTahun)
    .lte('diproses_pada', akhirTahun)

  if (error) throw error

  const urutan = (count || 0) + 1
  const nomorUrut = String(urutan).padStart(3, '0')
  return `${nomorUrut}/SK-IZIN/${bulanRomawi}/${tahun}`
}

// Ambil logo dari Supabase Storage lalu embed ke PDF (PNG/JPG)
async function embedLogoSekolah(pdfDoc, logoPath) {
  if (!logoPath) return null
  try {
    const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(logoPath)
    const res = await fetch(pub.publicUrl)
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    const ext = logoPath.split('.').pop().toLowerCase()
    if (ext === 'png') return await pdfDoc.embedPng(bytes)
    if (ext === 'jpg' || ext === 'jpeg') return await pdfDoc.embedJpg(bytes)
    return null
  } catch {
    return null
  }
}

export default function PengajuanIzin() {
  const { profil, isAdmin, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [mengajukan, setMengajukan] = useState(false)
  const [processingId, setProcessingId] = useState(null)

  // Form pengajuan (guru)
  const [form, setForm] = useState({
    jenis: 'Izin',
    tanggal_mulai: '',
    tanggal_selesai: '',
    alasan: '',
  })

  // Form penolakan admin, per baris
  const [rejectingId, setRejectingId] = useState(null)
  const [catatanTolak, setCatatanTolak] = useState('')
  const [printingId, setPrintingId] = useState(null)
  const [previewingId, setPreviewingId] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pengajuan_izin')
      .select('*, guru(nama_lengkap)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAjukan(e) {
    e.preventDefault()
    if (!form.tanggal_mulai || !form.tanggal_selesai) return
    if (form.tanggal_selesai < form.tanggal_mulai) {
      alert('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    setMengajukan(true)
    const { error } = await supabase.from('pengajuan_izin').insert({
      guru_id: profil.guru_id,
      jenis: form.jenis,
      tanggal_mulai: form.tanggal_mulai,
      tanggal_selesai: form.tanggal_selesai,
      alasan: form.alasan,
    })
    setMengajukan(false)
    if (error) {
      alert('Gagal mengirim pengajuan: ' + error.message)
    } else {
      setForm({ jenis: 'Izin', tanggal_mulai: '', tanggal_selesai: '', alasan: '' })
      await load()
    }
  }

  // Tulis otomatis ke presensi_guru untuk tiap tanggal di rentang pengajuan
  async function catatKePresensi(item) {
    const tanggalList = rentangTanggal(item.tanggal_mulai, item.tanggal_selesai)
    // Hapus dulu baris presensi lama di tanggal-tanggal itu (kalau ada, mis. sudah tercatat 'hadir'/'alpa')
    // supaya tidak dobel, lalu tulis ulang sebagai 'izin'.
    await supabase.from('presensi_guru').delete().eq('guru_id', item.guru_id).in('tanggal', tanggalList)
    const rows = tanggalList.map((tanggal) => ({
      guru_id: item.guru_id,
      tanggal,
      status: 'izin',
      catatan: `${item.jenis}${item.alasan ? ' — ' + item.alasan : ''}`,
    }))
    const { error } = await supabase.from('presensi_guru').insert(rows)
    if (error) throw error
  }

  async function handleApprove(item) {
    setProcessingId(item.id)
    try {
      await catatKePresensi(item)
      const nomorSurat = await buatNomorSurat()
      const { error } = await supabase
        .from('pengajuan_izin')
        .update({
          status: 'disetujui',
          nomor_surat: nomorSurat,
          diproses_oleh: session.user.id,
          diproses_pada: new Date().toISOString(),
        })
        .eq('id', item.id)
      if (error) throw error
      await load()
    } catch (err) {
      alert('Gagal menyetujui pengajuan: ' + err.message)
    }
    setProcessingId(null)
  }

  async function handleReject(item) {
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_izin')
      .update({
        status: 'ditolak',
        catatan_admin: catatanTolak,
        diproses_oleh: session.user.id,
        diproses_pada: new Date().toISOString(),
      })
      .eq('id', item.id)
    if (error) alert('Gagal menolak pengajuan: ' + error.message)
    setRejectingId(null)
    setCatatanTolak('')
    setProcessingId(null)
    await load()
  }

  // Susun PDF Surat Keterangan Izin/Cuti dan kembalikan bytes-nya.
  // Dipakai bersama oleh tombol "Lihat" (preview) dan "Cetak Surat" (unduh).
  async function buatPdfSurat(item) {
    const { data: sekolah } = await supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle()

      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595, 842]) // A4
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const logoImage = await embedLogoSekolah(pdfDoc, sekolah?.logo_path)

      let y = 800
      const draw = (text, opts = {}) => {
        const size = opts.size ?? 11
        const useFont = opts.bold ? bold : font
        if (opts.center) {
          const width = useFont.widthOfTextAtSize(text, size)
          page.drawText(text, { x: (595 - width) / 2, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) })
        } else {
          page.drawText(text, { x: opts.x ?? 60, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) })
        }
        y -= opts.gap ?? 20
      }

      // ---------- KOP SURAT ----------
      const kopMulaiY = y
      if (sekolah?.dinas_pendidikan) {
        const teksKabupaten = sekolah?.kabupaten
          ? sekolah.kabupaten.toUpperCase().startsWith('PEMERINTAH')
            ? sekolah.kabupaten.toUpperCase()
            : `PEMERINTAH ${sekolah.kabupaten.toUpperCase()}`
          : ''
        if (teksKabupaten) draw(teksKabupaten, { bold: true, size: 12, center: true, gap: 15 })
        draw(sekolah.dinas_pendidikan.toUpperCase(), { bold: true, size: 12, center: true, gap: 15 })
        if (sekolah?.kecamatan) draw(sekolah.kecamatan.toUpperCase(), { bold: true, size: 11, center: true, gap: 15 })
        draw(sekolah?.nama_sekolah || 'NAMA SEKOLAH', { bold: true, size: 14, center: true, gap: 14 })
      } else {
        draw(sekolah?.nama_sekolah || 'NAMA SEKOLAH', { bold: true, size: 14, center: true, gap: 16 })
      }

      const detailAlamat = [sekolah?.alamat, sekolah?.telepon ? `Telp. ${sekolah.telepon}` : null, sekolah?.email]
        .filter(Boolean)
        .join(' — ')
      if (detailAlamat) draw(detailAlamat, { size: 9, center: true, gap: 20 })

      // Logo di kiri atas kop, sejajar dengan blok teks kop
      if (logoImage) {
        const logoSize = 55
        const logoDims = logoImage.scale(logoSize / Math.max(logoImage.width, logoImage.height))
        page.drawImage(logoImage, {
          x: 60,
          y: kopMulaiY - logoDims.height + 5,
          width: logoDims.width,
          height: logoDims.height,
        })
      }

      page.drawLine({ start: { x: 60, y }, end: { x: 535, y }, thickness: 2, color: rgb(0.1, 0.1, 0.1) })
      y -= 3
      page.drawLine({ start: { x: 60, y }, end: { x: 535, y }, thickness: 0.75, color: rgb(0.1, 0.1, 0.1) })
      y -= 26

      // ---------- JUDUL & NOMOR SURAT ----------
      draw('SURAT KETERANGAN IZIN / CUTI', { bold: true, size: 13, center: true, gap: 16 })
      draw(`Nomor: ${item.nomor_surat || '-'}`, { size: 10, center: true, gap: 34 })

      draw(`Yang bertanda tangan di bawah ini menerangkan bahwa:`, { gap: 26 })
      draw(`Nama`, { x: 60, gap: 0 })
      draw(`: ${item.guru?.nama_lengkap || '-'}`, { x: 180, gap: 20 })
      draw(`Jenis Pengajuan`, { x: 60, gap: 0 })
      draw(`: ${item.jenis}`, { x: 180, gap: 20 })
      draw(`Tanggal`, { x: 60, gap: 0 })
      draw(`: ${formatTanggal(item.tanggal_mulai)} s.d. ${formatTanggal(item.tanggal_selesai)}`, { x: 180, gap: 20 })
      draw(`Alasan`, { x: 60, gap: 0 })
      draw(`: ${item.alasan || '-'}`, { x: 180, gap: 34 })

      draw('Telah disetujui dan tercatat sebagai izin resmi pada sistem informasi', { gap: 18 })
      draw('sekolah, dan diharap dimaklumi oleh semua pihak terkait.', { gap: 50 })

      // ---------- TANDA TANGAN ----------
      draw(`${tanggalCetak}`, { x: 340, gap: 20 })
      draw(sekolah?.kepala_sekolah ? 'Kepala Sekolah,' : 'Mengetahui,', { x: 340, gap: 60 })
      draw(sekolah?.kepala_sekolah || '(.........................)', { x: 340, bold: true, gap: 18 })
      if (sekolah?.nip_kepala_sekolah) {
        draw(`NIP. ${sekolah.nip_kepala_sekolah}`, { x: 340, size: 10, gap: 0 })
      }

      return await pdfDoc.save()
  }

  function namaFileSurat(item) {
    const namaFileNomor = (item.nomor_surat || '').replace(/\//g, '-')
    return `Surat-Izin-${namaFileNomor ? namaFileNomor + '-' : ''}${(item.guru?.nama_lengkap || 'guru').replace(/\s+/g, '-')}.pdf`
  }

  // Buka pratinjau PDF di tab baru, tanpa langsung mengunduh
  async function handleLihatSurat(item) {
    setPreviewingId(item.id)
    try {
      const bytes = await buatPdfSurat(item)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const tab = window.open(url, '_blank')
      if (!tab) {
        alert('Pop-up diblokir browser. Izinkan pop-up untuk melihat pratinjau surat.')
      }
      // Beri waktu tab baru memuat blob sebelum URL-nya dilepas
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      alert('Gagal membuat pratinjau surat: ' + err.message)
    }
    setPreviewingId(null)
  }

  // Unduh PDF Surat Keterangan Izin/Cuti — dipakai untuk pengajuan yang sudah disetujui
  async function handleCetakSurat(item) {
    setPrintingId(item.id)
    try {
      const bytes = await buatPdfSurat(item)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = namaFileSurat(item)
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal membuat surat: ' + err.message)
    }
    setPrintingId(null)
  }

  // Guru hanya melihat pengajuannya sendiri (RLS di database juga sudah membatasi ini,
  // filter di sini cuma untuk jaga-jaga & agar UI konsisten)
  const daftarTampil = isAdmin ? items : items.filter((i) => i.guru_id === profil?.guru_id)
  const menungguCount = items.filter((i) => i.status === 'menunggu').length

  return (
    <Layout
      title="Pengajuan Izin & Cuti"
      subtitle={isAdmin ? 'Tinjau dan proses pengajuan izin/cuti dari guru' : 'Ajukan izin atau cuti dan pantau statusnya'}
    >
      {/* Banner biru — senada dengan RPP & Presensi */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <CalendarClock size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Pengajuan Izin & Cuti</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? menungguCount > 0
                  ? `${menungguCount} pengajuan menunggu persetujuan`
                  : 'Semua pengajuan sudah diproses'
                : 'Ajukan izin atau cuti dan pantau statusnya di sini'}
            </p>
          </div>
        </div>
        <CalendarClock size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {!isAdmin && (
        <form onSubmit={handleAjukan} className="card p-6 mb-6 space-y-3">
          <h3 className="font-display text-lg font-semibold mb-1">Ajukan Izin / Cuti Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="input-field"
              placeholder="Jenis (mis. Izin, Cuti, Sakit)"
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value })}
              required
            />
            <input
              type="date"
              className="input-field"
              value={form.tanggal_mulai}
              onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
              required
            />
            <input
              type="date"
              className="input-field"
              value={form.tanggal_selesai}
              onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
              required
            />
          </div>
          <textarea
            className="input-field w-full"
            rows={3}
            placeholder="Alasan / keterangan"
            value={form.alasan}
            onChange={(e) => setForm({ ...form, alasan: e.target.value })}
          />
          <button type="submit" disabled={mengajukan} className="btn-primary">
            {mengajukan ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {mengajukan ? 'Mengirim...' : 'Kirim Pengajuan'}
          </button>
        </form>
      )}

      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">
          {isAdmin ? 'Semua Pengajuan' : 'Riwayat Pengajuan Saya'}
        </h3>
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : daftarTampil.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada pengajuan.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {daftarTampil.map((item) => (
              <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${STATUS_STYLE[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="text-sm font-medium text-ink-900">{item.jenis}</span>
                    {item.nomor_surat && (
                      <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink-900/[0.05] text-ink-700/70">
                        <FileText size={11} /> {item.nomor_surat}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-700/50 mt-1">
                    {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                    {formatTanggal(item.tanggal_mulai)} — {formatTanggal(item.tanggal_selesai)}
                  </p>
                  {item.alasan && <p className="text-xs text-ink-700/60 mt-1">{item.alasan}</p>}
                  {item.status === 'ditolak' && item.catatan_admin && (
                    <p className="text-xs text-red-600 mt-1">Alasan ditolak: {item.catatan_admin}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'disetujui' && (
                    <>
                      <button
                        onClick={() => handleLihatSurat(item)}
                        disabled={previewingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700/70 hover:bg-ink-900/[0.05] disabled:opacity-50"
                      >
                        {previewingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                        Lihat
                      </button>
                      <button
                        onClick={() => handleCetakSurat(item)}
                        disabled={printingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sage-500 hover:bg-sage-500/10 disabled:opacity-50"
                      >
                        {printingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                        Cetak Surat
                      </button>
                    </>
                  )}

                  {isAdmin && item.status === 'menunggu' && (
                    <>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={processingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sage-500/15 text-sage-500 disabled:opacity-50"
                      >
                        {processingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Setujui
                      </button>

                      {rejectingId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input-field !py-1.5 !text-xs w-40"
                            placeholder="Alasan tolak"
                            value={catatanTolak}
                            onChange={(e) => setCatatanTolak(e.target.value)}
                          />
                          <button
                            onClick={() => handleReject(item)}
                            disabled={processingId === item.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600"
                          >
                            Kirim
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingId(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600"
                        >
                          <XCircle size={14} /> Tolak
                        </button>
                      )}
                    </>
                  )}

                  {item.status === 'menunggu' && !isAdmin && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-700/40">
                      <Clock size={14} /> Menunggu persetujuan
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
