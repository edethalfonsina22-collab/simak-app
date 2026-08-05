import { useEffect, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Send, CheckCircle2, XCircle, Clock, Loader2, FileCheck2, Printer, FileText, Eye, Trash2 } from 'lucide-react'

const STATUS_STYLE = {
  menunggu: 'bg-brass-400/15 text-brass-600',
  disetujui: 'bg-sage-500/15 text-sage-500',
  ditolak: 'bg-red-100 text-red-600',
}
const STATUS_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }

const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

// Preset jenis surat + kalimat pernyataan bawaan (bisa diedit oleh guru saat mengajukan).
const JENIS_SURAT_PRESET = [
  {
    value: 'Aktif Mengajar',
    template: 'adalah benar merupakan guru yang masih aktif mengajar di sekolah kami hingga saat surat ini diterbitkan',
  },
  {
    value: 'Kelakuan Baik',
    template: 'adalah benar berkelakuan baik selama bertugas di sekolah kami dan tidak pernah terlibat pelanggaran disiplin',
  },
  {
    value: 'Masa Kerja',
    template: 'adalah benar telah bekerja sebagai guru di sekolah kami',
  },
  {
    value: 'Cuti',
    template: 'adalah benar sedang menjalani cuti sesuai ketentuan yang berlaku di sekolah kami',
  },
  {
    value: 'Lainnya',
    template: '',
  },
]

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Kode singkat untuk nomor surat, diturunkan dari jenis surat. Contoh: "Aktif Mengajar" -> "SK-AKTIF"
function kodeJenisSurat(jenis) {
  const kataPertama = (jenis || 'Umum').trim().split(/\s+/)[0] || 'UMUM'
  return 'SK-' + kataPertama.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Nomor surat otomatis, format: 001/SK-AKTIF/VIII/2026 (kode menyesuaikan jenis surat)
async function buatNomorSurat(jenisSurat) {
  const sekarang = new Date()
  const tahun = sekarang.getFullYear()
  const bulanRomawi = BULAN_ROMAWI[sekarang.getMonth()]
  const awalTahun = `${tahun}-01-01T00:00:00.000Z`
  const akhirTahun = `${tahun}-12-31T23:59:59.999Z`

  const { count, error } = await supabase
    .from('pengajuan_surat_aktif')
    .select('id', { count: 'exact', head: true })
    .not('nomor_surat', 'is', null)
    .gte('diproses_pada', awalTahun)
    .lte('diproses_pada', akhirTahun)

  if (error) throw error

  const urutan = (count || 0) + 1
  const nomorUrut = String(urutan).padStart(3, '0')
  return `${nomorUrut}/${kodeJenisSurat(jenisSurat)}/${bulanRomawi}/${tahun}`
}

// Ambil gambar (logo / tanda tangan) dari Supabase Storage lalu embed ke PDF (PNG/JPG)
async function embedGambarSekolah(pdfDoc, path) {
  if (!path) return null
  try {
    const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(path)
    const res = await fetch(pub.publicUrl)
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    const ext = path.split('.').pop().toLowerCase()
    if (ext === 'png') return await pdfDoc.embedPng(bytes)
    if (ext === 'jpg' || ext === 'jpeg') return await pdfDoc.embedJpg(bytes)
    return null
  } catch {
    return null
  }
}

// Pecah teks panjang menjadi beberapa baris agar muat di lebar halaman PDF.
function bungkusTeks(text, font, size, maxWidth) {
  const kata = (text || '').split(/\s+/).filter(Boolean)
  const baris = []
  let baris_saat_ini = ''
  for (const kata_ini of kata) {
    const percobaan = baris_saat_ini ? `${baris_saat_ini} ${kata_ini}` : kata_ini
    if (font.widthOfTextAtSize(percobaan, size) > maxWidth && baris_saat_ini) {
      baris.push(baris_saat_ini)
      baris_saat_ini = kata_ini
    } else {
      baris_saat_ini = percobaan
    }
  }
  if (baris_saat_ini) baris.push(baris_saat_ini)
  return baris
}

export default function PengajuanSuratAktif() {
  const { profil, isAdmin, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [mengajukan, setMengajukan] = useState(false)
  const [processingId, setProcessingId] = useState(null)

  // Form pengajuan (guru)
  const [jenisSurat, setJenisSurat] = useState(JENIS_SURAT_PRESET[0].value)
  const [jenisSuratLainnya, setJenisSuratLainnya] = useState('')
  const [isiKeterangan, setIsiKeterangan] = useState(JENIS_SURAT_PRESET[0].template)
  const [keperluan, setKeperluan] = useState('')

  // Form penolakan admin, per baris
  const [rejectingId, setRejectingId] = useState(null)
  const [catatanTolak, setCatatanTolak] = useState('')
  const [printingId, setPrintingId] = useState(null)
  const [previewingId, setPreviewingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pengajuan_surat_aktif')
      .select('*, guru(nama_lengkap, nip, mata_pelajaran, nuptk, tempat_lahir, tanggal_lahir)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function handleUbahJenisSurat(value) {
    setJenisSurat(value)
    const preset = JENIS_SURAT_PRESET.find((j) => j.value === value)
    if (preset) setIsiKeterangan(preset.template)
  }

  async function handleAjukan(e) {
    e.preventDefault()
    const jenisFinal = jenisSurat === 'Lainnya' ? jenisSuratLainnya.trim() : jenisSurat
    if (!jenisFinal || !isiKeterangan.trim() || !keperluan.trim()) return

    setMengajukan(true)
    const { error } = await supabase.from('pengajuan_surat_aktif').insert({
      guru_id: profil.guru_id,
      jenis_surat: jenisFinal,
      isi_keterangan: isiKeterangan.trim(),
      keperluan: keperluan.trim(),
    })
    setMengajukan(false)
    if (error) {
      alert('Gagal mengirim pengajuan: ' + error.message)
    } else {
      setJenisSurat(JENIS_SURAT_PRESET[0].value)
      setJenisSuratLainnya('')
      setIsiKeterangan(JENIS_SURAT_PRESET[0].template)
      setKeperluan('')
      await load()
    }
  }

  async function handleApprove(item) {
    setProcessingId(item.id)
    try {
      const nomorSurat = await buatNomorSurat(item.jenis_surat)
      const { error } = await supabase
        .from('pengajuan_surat_aktif')
        .update({
          status: 'disetujui',
          nomor_surat: nomorSurat,
          diproses_oleh: session.user.id,
          diproses_pada: new Date().toISOString(),
        })
        .eq('id', item.id)
      if (error) throw error

      // Sinkron otomatis: catat surat yang baru disetujui ke arsip Surat Keluar,
      // supaya tidak perlu diinput manual lagi di halaman Surat Masuk & Keluar.
      const { error: errArsip } = await supabase.from('surat').insert({
        jenis: 'keluar',
        nomor_surat: nomorSurat,
        perihal: `Surat Keterangan ${item.jenis_surat || 'Aktif Mengajar'} a.n. ${item.guru?.nama_lengkap || '-'}`,
        pengirim_tujuan: item.guru?.nama_lengkap || '-',
        tanggal: new Date().toISOString().slice(0, 10),
        catatan: item.keperluan ? `Keperluan: ${item.keperluan} (tercatat otomatis dari pengajuan Surat Keterangan)` : 'Tercatat otomatis dari pengajuan Surat Keterangan',
      })
      if (errArsip) {
        // Persetujuan surat tetap berhasil walau pencatatan arsip gagal; cukup dicatat di console
        // supaya admin bisa menambahkannya manual di halaman Surat Masuk & Keluar bila perlu.
        console.error('[surat] gagal mencatat otomatis ke arsip surat keluar:', errArsip)
      }

      await load()
    } catch (err) {
      alert('Gagal menyetujui pengajuan: ' + err.message)
    }
    setProcessingId(null)
  }

  async function handleReject(item) {
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_surat_aktif')
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

  async function handleHapus(item) {
    const namaJenis = item.jenis_surat || 'Aktif Mengajar'
    const konfirmasi = window.confirm(
      `Hapus pengajuan surat keterangan ${namaJenis}${isAdmin && item.guru?.nama_lengkap ? ` milik ${item.guru.nama_lengkap}` : ''} ini? Tindakan ini tidak bisa dibatalkan.`
    )
    if (!konfirmasi) return

    setDeletingId(item.id)
    try {
      const { error } = await supabase.from('pengajuan_surat_aktif').delete().eq('id', item.id)
      if (error) throw error
      await load()
    } catch (err) {
      alert('Gagal menghapus pengajuan: ' + err.message)
    }
    setDeletingId(null)
  }

  // Susun PDF Surat Keterangan (jenis menyesuaikan pengajuan) dan kembalikan bytes-nya.
  async function buatPdfSurat(item) {
    const { data: sekolah } = await supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle()

    const jenisSuratItem = item.jenis_surat || 'Aktif Mengajar'
    const isiKeteranganItem =
      item.isi_keterangan || JENIS_SURAT_PRESET.find((j) => j.value === jenisSuratItem)?.template || 'adalah benar sebagaimana keterangan berikut'

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const tempatTanggalCetak = sekolah?.tempat_ttd
      ? `${sekolah.tempat_ttd}, ${tanggalCetak}`
      : tanggalCetak
    const logoImage = await embedGambarSekolah(pdfDoc, sekolah?.logo_path)
    const ttdImage = await embedGambarSekolah(pdfDoc, sekolah?.ttd_kepala_sekolah_path)

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
    draw(`SURAT KETERANGAN ${jenisSuratItem.toUpperCase()}`, { bold: true, size: 13, center: true, gap: 16 })
    draw(`Nomor: ${item.nomor_surat || '-'}`, { size: 10, center: true, gap: 34 })

    draw(`Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:`, { gap: 26 })
    draw(`Nama`, { x: 60, gap: 0 })
    draw(`: ${item.guru?.nama_lengkap || '-'}`, { x: 180, gap: 20 })
    draw(`NIP`, { x: 60, gap: 0 })
    draw(`: ${item.guru?.nip || '-'}`, { x: 180, gap: 20 })
    draw(`NUPTK`, { x: 60, gap: 0 })
    draw(`: ${item.guru?.nuptk || '-'}`, { x: 180, gap: 20 })
    draw(`Tempat, Tgl Lahir`, { x: 60, gap: 0 })
    draw(
      `: ${item.guru?.tempat_lahir || '-'}, ${
        item.guru?.tanggal_lahir
          ? new Date(item.guru.tanggal_lahir).toLocaleDateString('id-ID')
          : '-'
      }`,
      { x: 180, gap: 20 }
    )
    draw(`Jabatan / Mapel`, { x: 60, gap: 0 })
    draw(`: ${item.guru?.mata_pelajaran || '-'}`, { x: 180, gap: 34 })

    // ---------- PERNYATAAN (dinamis sesuai jenis surat, dibungkus otomatis) ----------
    const kalimatPernyataan = `${isiKeteranganItem}${item.keperluan ? `, untuk keperluan ${item.keperluan}.` : '.'}`
    const barisPernyataan = bungkusTeks(kalimatPernyataan, font, 11, 475)
    barisPernyataan.forEach((baris) => draw(baris, { gap: 18 }))

    draw('Demikian surat keterangan ini dibuat untuk dipergunakan', { gap: 18 })
    draw('sebagaimana mestinya.', { gap: 50 })

    // ---------- TANDA TANGAN ----------
    draw(tempatTanggalCetak, { x: 340, gap: 20 })
    draw(sekolah?.kepala_sekolah ? 'Kepala Sekolah,' : 'Mengetahui,', { x: 340, gap: 4 })

    if (ttdImage) {
      const ttdTinggi = 40
      const ttdDims = ttdImage.scale(ttdTinggi / ttdImage.height)
      const imgTopY = y
      const imgBottomY = imgTopY - ttdTinggi
      page.drawImage(ttdImage, { x: 340, y: imgBottomY, width: ttdDims.width, height: ttdTinggi })
      y = imgBottomY - 10
      draw('*Ditandatangani secara elektronik', { x: 340, size: 7, gap: 10 })
    } else {
      y -= 40
    }

    draw(sekolah?.kepala_sekolah || '(.........................)', { x: 340, bold: true, gap: 18 })
    if (sekolah?.nip_kepala_sekolah) {
      draw(`NIP. ${sekolah.nip_kepala_sekolah}`, { x: 340, size: 10, gap: 0 })
    }

    return await pdfDoc.save()
  }

  function namaFileSurat(item) {
    const namaFileNomor = (item.nomor_surat || '').replace(/\//g, '-')
    const namaJenis = (item.jenis_surat || 'Aktif-Mengajar').replace(/\s+/g, '-')
    return `Surat-${namaJenis}-${namaFileNomor ? namaFileNomor + '-' : ''}${(item.guru?.nama_lengkap || 'guru').replace(/\s+/g, '-')}.pdf`
  }

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
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      alert('Gagal membuat pratinjau surat: ' + err.message)
    }
    setPreviewingId(null)
  }

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

  const daftarTampil = isAdmin ? items : items.filter((i) => i.guru_id === profil?.guru_id)
  const menungguCount = items.filter((i) => i.status === 'menunggu').length

  return (
    <Layout
      title="Surat Keterangan"
      subtitle={isAdmin ? 'Tinjau dan proses pengajuan surat keterangan dari guru' : 'Ajukan surat keterangan dan pantau statusnya'}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <FileCheck2 size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Surat Keterangan</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? menungguCount > 0
                  ? `${menungguCount} pengajuan menunggu persetujuan`
                  : 'Semua pengajuan sudah diproses'
                : 'Ajukan surat keterangan dan pantau statusnya di sini'}
            </p>
          </div>
        </div>
        <FileCheck2 size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {!isAdmin && (
        <form onSubmit={handleAjukan} className="card p-6 mb-6 space-y-3">
          <h3 className="font-display text-lg font-semibold mb-1">Ajukan Surat Keterangan Baru</h3>

          <div>
            <label className="label-field">Jenis Surat *</label>
            <select
              className="input-field w-full"
              value={jenisSurat}
              onChange={(e) => handleUbahJenisSurat(e.target.value)}
            >
              {JENIS_SURAT_PRESET.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.value === 'Lainnya' ? 'Lainnya (isi manual)' : j.value}
                </option>
              ))}
            </select>
          </div>

          {jenisSurat === 'Lainnya' && (
            <div>
              <label className="label-field">Nama Jenis Surat *</label>
              <input
                required
                className="input-field w-full"
                placeholder="mis. Bebas Pustaka, Rekomendasi, dll"
                value={jenisSuratLainnya}
                onChange={(e) => setJenisSuratLainnya(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="label-field">Isi Pernyataan *</label>
            <textarea
              required
              className="input-field w-full"
              rows={2}
              placeholder="Kalimat keterangan yang akan tertulis di surat"
              value={isiKeterangan}
              onChange={(e) => setIsiKeterangan(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field">Keperluan *</label>
            <textarea
              required
              className="input-field w-full"
              rows={2}
              placeholder="Keperluan surat (mis. untuk syarat KPR, tunjangan, dll)"
              value={keperluan}
              onChange={(e) => setKeperluan(e.target.value)}
            />
          </div>

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
                    <span className="text-sm font-medium text-ink-900">{item.jenis_surat || 'Aktif Mengajar'}</span>
                    {item.nomor_surat && (
                      <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink-900/[0.05] text-ink-700/70">
                        <FileText size={11} /> {item.nomor_surat}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-700/50 mt-1">
                    {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                    {formatTanggal(item.dibuat_pada)}
                  </p>
                  {item.keperluan && <p className="text-xs text-ink-700/60 mt-1">Keperluan: {item.keperluan}</p>}
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

                  {(isAdmin || (item.guru_id === profil?.guru_id && item.status === 'menunggu')) && (
                    <button
                      onClick={() => handleHapus(item)}
                      disabled={deletingId === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      title="Hapus pengajuan"
                    >
                      {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Hapus
                    </button>
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
