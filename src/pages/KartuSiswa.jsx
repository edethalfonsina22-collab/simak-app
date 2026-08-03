import { useEffect, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Camera, Loader2, IdCard, Library, Download } from 'lucide-react'

const CARD_W = 242 // ~85.6mm dalam points
const CARD_H = 153 // ~54mm dalam points
const MARGIN = 30
const GAP = 14
const COLS = 2
const ROWS = 4

// Ganti dengan domain Vercel Anda yang sebenarnya
const BASE_URL = 'https://domain-anda.vercel.app'

export default function KartuSiswa() {
  const [kelasList, setKelasList] = useState([])
  const [kelasId, setKelasId] = useState('')
  const [siswaList, setSiswaList] = useState([])
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploadingId, setUploadingId] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    supabase.from('kelas').select('id, nama_kelas').order('nama_kelas').then(({ data }) => {
      setKelasList(data || [])
      if (data?.length) setKelasId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (kelasId) loadSiswa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelasId])

  async function loadSiswa() {
    setLoading(true)
    const { data } = await supabase
      .from('siswa')
      .select('id, nama_lengkap, nis, foto_path, kelas(nama_kelas)')
      .eq('kelas_id', kelasId)
      .eq('status', 'aktif')
      .order('nama_lengkap')
    setSiswaList(data || [])
    setSelected({})
    setLoading(false)
  }

  function fotoUrl(path) {
    if (!path) return null
    return supabase.storage.from('foto-siswa').getPublicUrl(path).data.publicUrl
  }

  async function handleFotoUpload(siswaId, file) {
    setUploadingId(siswaId)
    const ext = file.name.split('.').pop()
    const path = `${siswaId}/foto.${ext}`
    const { error: uploadError } = await supabase.storage.from('foto-siswa').upload(path, file, { upsert: true })
    if (uploadError) {
      alert('Gagal upload foto: ' + uploadError.message)
      setUploadingId(null)
      return
    }
    await supabase.from('siswa').update({ foto_path: path }).eq('id', siswaId)
    await loadSiswa()
    setUploadingId(null)
  }

  function toggleSelect(id) {
    setSelected({ ...selected, [id]: !selected[id] })
  }

  function selectAll() {
    const all = {}
    siswaList.forEach((s) => { all[s.id] = true })
    setSelected(all)
  }

  async function fetchImageBytes(url) {
    const res = await fetch(url)
    return new Uint8Array(await res.arrayBuffer())
  }

  // Ubah QR data-URL (base64) menjadi bytes agar bisa di-embed pdf-lib
  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  async function generateQRBytes(siswaId) {
    const verifyUrl = `${BASE_URL}/verify/siswa/${siswaId}`
    const dataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 0 })
    return dataUrlToBytes(dataUrl)
  }

  async function generateKartu(jenis) {
    const terpilih = siswaList.filter((s) => selected[s.id])
    if (terpilih.length === 0) {
      alert('Pilih minimal 1 siswa dulu.')
      return
    }
    setGenerating(true)
    try {
      const pdfDoc = await PDFDocument.create()
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

      const perPage = COLS * ROWS
      const judulKartu = jenis === 'pelajar' ? 'KARTU PELAJAR' : 'KARTU PERPUSTAKAAN'
      const warna = jenis === 'pelajar' ? rgb(0.11, 0.19, 0.36) : rgb(0.31, 0.09, 0.09)

      for (let p = 0; p < Math.ceil(terpilih.length / perPage); p++) {
        const page = pdfDoc.addPage([595, 842])
        const kelompok = terpilih.slice(p * perPage, p * perPage + perPage)

        for (let i = 0; i < kelompok.length; i++) {
          const siswa = kelompok[i]
          const col = i % COLS
          const row = Math.floor(i / COLS)
          const x = MARGIN + col * (CARD_W + GAP)
          const y = 842 - MARGIN - CARD_H - row * (CARD_H + GAP)

          // Latar kartu
          page.drawRectangle({ x, y, width: CARD_W, height: CARD_H, color: rgb(1, 1, 1), borderColor: warna, borderWidth: 1.5 })
          // Header berwarna
          page.drawRectangle({ x, y: y + CARD_H - 28, width: CARD_W, height: 28, color: warna })
          page.drawText('SD NEGERI WARIA', { x: x + 10, y: y + CARD_H - 13, size: 8, font: fontBold, color: rgb(1, 1, 1) })
          page.drawText(judulKartu, { x: x + 10, y: y + CARD_H - 23, size: 7, font, color: rgb(1, 1, 1) })

          // Foto
          const fotoX = x + 10
          const fotoY = y + 14
          const fotoSize = 60
          if (siswa.foto_path) {
            try {
              const bytes = await fetchImageBytes(fotoUrl(siswa.foto_path))
              const isPng = siswa.foto_path.toLowerCase().endsWith('.png')
              const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
              page.drawImage(img, { x: fotoX, y: fotoY, width: fotoSize, height: fotoSize })
            } catch {
              page.drawRectangle({ x: fotoX, y: fotoY, width: fotoSize, height: fotoSize, color: rgb(0.9, 0.9, 0.9) })
            }
          } else {
            page.drawRectangle({ x: fotoX, y: fotoY, width: fotoSize, height: fotoSize, color: rgb(0.9, 0.9, 0.9) })
          }

          // Data siswa
          const textX = fotoX + fotoSize + 10
          let textY = y + CARD_H - 40
          page.drawText(siswa.nama_lengkap, { x: textX, y: textY, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
          textY -= 14
          page.drawText(`NIS: ${siswa.nis || '-'}`, { x: textX, y: textY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
          textY -= 12
          page.drawText(`Kelas: ${siswa.kelas?.nama_kelas || '-'}`, { x: textX, y: textY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
          textY -= 12
          page.drawText(`TP ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, { x: textX, y: textY, size: 7, font, color: rgb(0.5, 0.5, 0.5) })

          // QR Code (pojok kanan bawah kartu)
          try {
            const qrBytes = await generateQRBytes(siswa.id)
            const qrImg = await pdfDoc.embedPng(qrBytes)
            const qrSize = 30
            const qrX = x + CARD_W - qrSize - 10
            const qrY = y + 8
            page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize })
          } catch (err) {
            console.error('Gagal generate QR:', err)
          }
        }
      }

      const bytes = await pdfDoc.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${judulKartu.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
    } catch (err) {
      alert('Gagal membuat PDF: ' + err.message)
    }
    setGenerating(false)
  }

  const jumlahTerpilih = Object.values(selected).filter(Boolean).length

  return (
    <Layout title="Cetak Kartu" subtitle="Kartu Pelajar & Kartu Perpustakaan otomatis dari data siswa">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a0e0e] to-[#7a1515] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <IdCard size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Cetak Kartu</p>
            <p className="text-sm text-paper/70 mt-0.5">{jumlahTerpilih} siswa dipilih untuk dicetak</p>
          </div>
        </div>
        <IdCard size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5 flex flex-wrap items-center gap-3">
        <select className="input-field w-auto" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
          {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
        </select>
        <button onClick={selectAll} className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]">
          Pilih Semua di Kelas Ini
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => generateKartu('pelajar')} disabled={generating} className="btn-primary">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Cetak Kartu Pelajar
          </button>
          <button
            onClick={() => generateKartu('perpustakaan')}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-paper text-sm font-medium disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Library size={16} />}
            Cetak Kartu Perpustakaan
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <p className="text-sm text-ink-700/50 p-6">Memuat...</p>
        ) : siswaList.length === 0 ? (
          <p className="text-sm text-ink-700/50 p-6">Belum ada siswa aktif di kelas ini.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {siswaList.map((s) => (
              <li key={s.id} className="p-4 flex items-center gap-4">
                <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleSelect(s.id)} />
                <div className="w-11 h-11 rounded-full bg-ink-900/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                  {fotoUrl(s.foto_path) ? (
                    <img src={fotoUrl(s.foto_path)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-ink-700/40">{s.nama_lengkap?.[0]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-950">{s.nama_lengkap}</p>
                  <p className="text-xs text-ink-700/50">NIS: {s.nis || '-'}</p>
                </div>
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05] cursor-pointer shrink-0">
                  {uploadingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {s.foto_path ? 'Ganti Foto' : 'Upload Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingId === s.id}
                    onChange={(e) => e.target.files?.[0] && handleFotoUpload(s.id, e.target.files[0])}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-700/40 mt-4">
        Siswa tanpa foto akan tetap tercetak dengan kotak foto kosong. QR code di pojok kanan bawah untuk verifikasi. Kartu dicetak 8 per halaman A4, tinggal potong sesuai garis.
      </p>
    </Layout>
  )
}
