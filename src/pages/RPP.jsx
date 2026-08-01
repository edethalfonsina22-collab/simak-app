import { useEffect, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Upload, FileText, Download, CheckCircle2, XCircle, Clock, Loader2, NotebookPen } from 'lucide-react'

const STATUS_STYLE = {
  menunggu: 'bg-brass-400/15 text-brass-600',
  disetujui: 'bg-sage-500/15 text-sage-500',
  ditolak: 'bg-red-100 text-red-600',
}

const STATUS_LABEL = {
  menunggu: 'Menunggu',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
}

export default function RPP() {
  const { profil, isAdmin, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [processingId, setProcessingId] = useState(null)

  // Form upload (guru)
  const [form, setForm] = useState({
    judul: '',
    mata_pelajaran: '',
    kelas: '',
    semester: 'Ganjil',
    tahun_ajaran: '',
    file: null,
  })

  // Form persetujuan admin, per baris
  const [approvalForm, setApprovalForm] = useState({ nama: '', jabatan: 'Kepala Sekolah' })
  const [rejectingId, setRejectingId] = useState(null)
  const [catatanTolak, setCatatanTolak] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('rpp')
      .select('*, guru(nama_lengkap)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!form.file || !form.judul) return
    setUploading(true)

    const ext = form.file.name.split('.').pop()
    const path = `${profil.guru_id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('rpp-files')
      .upload(path, form.file)

    if (uploadError) {
      alert('Gagal upload file: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('rpp').insert({
      guru_id: profil.guru_id,
      judul: form.judul,
      mata_pelajaran: form.mata_pelajaran,
      kelas: form.kelas,
      semester: form.semester,
      tahun_ajaran: form.tahun_ajaran,
      file_path: path,
      file_nama: form.file.name,
    })

    if (insertError) {
      alert('Gagal simpan data RPP: ' + insertError.message)
    } else {
      setForm({ judul: '', mata_pelajaran: '', kelas: '', semester: 'Ganjil', tahun_ajaran: '', file: null })
      await load()
    }
    setUploading(false)
  }

  async function handleDownload(path, fileName) {
    const { data, error } = await supabase.storage.from('rpp-files').createSignedUrl(path, 60)
    if (error) {
      alert('Gagal buka file: ' + error.message)
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  async function generateLembarPersetujuan(item, nama, jabatan) {
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    let y = 780
    const draw = (text, opts = {}) => {
      page.drawText(text, {
        x: opts.x ?? 50,
        y,
        size: opts.size ?? 11,
        font: opts.bold ? bold : font,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= opts.gap ?? 22
    }

    draw('LEMBAR PERSETUJUAN RPP', { bold: true, size: 16, gap: 36 })
    draw(`Judul RPP     : ${item.judul}`)
    draw(`Guru          : ${item.guru?.nama_lengkap || '-'}`)
    draw(`Mata Pelajaran: ${item.mata_pelajaran || '-'}`)
    draw(`Kelas         : ${item.kelas || '-'}`)
    draw(`Semester      : ${item.semester || '-'} / ${item.tahun_ajaran || '-'}`, { gap: 48 })
    draw('Dengan ini menyatakan bahwa RPP tersebut di atas telah diperiksa')
    draw('dan disetujui untuk digunakan dalam kegiatan belajar mengajar.', { gap: 60 })
    draw(`${tanggal}`, { gap: 22 })
    draw(`${nama}`, { bold: true })
    draw(`${jabatan}`)

    const bytes = await pdfDoc.save()
    const path = `${item.guru_id}/lembar-persetujuan-${item.id}.pdf`

    const { error } = await supabase.storage
      .from('rpp-files')
      .upload(path, new Blob([bytes], { type: 'application/pdf' }), { upsert: true })

    if (error) throw error
    return path
  }

  async function handleApprove(item) {
    if (!approvalForm.nama) {
      alert('Isi nama penandatangan dulu.')
      return
    }
    setProcessingId(item.id)
    try {
      const lembarPath = await generateLembarPersetujuan(item, approvalForm.nama, approvalForm.jabatan)
      const { error } = await supabase
        .from('rpp')
        .update({
          status: 'disetujui',
          nama_penandatangan: approvalForm.nama,
          jabatan_penandatangan: approvalForm.jabatan,
          disetujui_oleh: session.user.id,
          disetujui_pada: new Date().toISOString(),
          lembar_persetujuan_path: lembarPath,
        })
        .eq('id', item.id)
      if (error) throw error
      await load()
    } catch (err) {
      alert('Gagal menyetujui RPP: ' + err.message)
    }
    setProcessingId(null)
  }

  async function handleReject(item) {
    setProcessingId(item.id)
    const { error } = await supabase
      .from('rpp')
      .update({ status: 'ditolak', catatan_admin: catatanTolak })
      .eq('id', item.id)
    if (error) alert('Gagal menolak RPP: ' + error.message)
    setRejectingId(null)
    setCatatanTolak('')
    setProcessingId(null)
    await load()
  }

  const menungguCount = items.filter((i) => i.status === 'menunggu').length

  return (
    <Layout title="RPP" subtitle={isAdmin ? 'Tinjau dan setujui RPP dari guru' : 'Upload dan pantau status persetujuan RPP Anda'}>
      {/* Banner biru — senada dengan Dokumen & Presensi */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <NotebookPen size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">RPP</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? menungguCount > 0
                  ? `${menungguCount} RPP menunggu persetujuan`
                  : 'Semua RPP sudah diproses'
                : 'Upload dan pantau status persetujuan RPP Anda'}
            </p>
          </div>
        </div>
        <NotebookPen size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {!isAdmin && (
        <form onSubmit={handleUpload} className="card p-6 mb-6 space-y-3">
          <h3 className="font-display text-lg font-semibold mb-1">Upload RPP Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="input-field"
              placeholder="Judul RPP"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              required
            />
            <input
              className="input-field"
              placeholder="Mata Pelajaran"
              value={form.mata_pelajaran}
              onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Kelas"
              value={form.kelas}
              onChange={(e) => setForm({ ...form, kelas: e.target.value })}
            />
            <select
              className="input-field"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
            <input
              className="input-field"
              placeholder="Tahun Ajaran (mis. 2026/2027)"
              value={form.tahun_ajaran}
              onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })}
            />
            <input
              className="input-field"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              required
            />
          </div>
          <button type="submit" disabled={uploading} className="btn-primary">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Mengunggah...' : 'Upload RPP'}
          </button>
        </form>
      )}

      {isAdmin && (
        <div className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder="Nama penandatangan (mis. Siti Aminah, S.Pd.)"
            value={approvalForm.nama}
            onChange={(e) => setApprovalForm({ ...approvalForm, nama: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="Jabatan"
            value={approvalForm.jabatan}
            onChange={(e) => setApprovalForm({ ...approvalForm, jabatan: e.target.value })}
          />
          <p className="sm:col-span-2 text-xs text-ink-700/50">
            Nama & jabatan ini akan otomatis dipakai setiap kali Anda menyetujui RPP di bawah.
          </p>
        </div>
      )}

      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Daftar RPP</h3>
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada RPP diupload.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {items.map((item) => (
              <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${STATUS_STYLE[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="text-sm font-medium text-ink-900 truncate">{item.judul}</span>
                  </div>
                  <p className="text-xs text-ink-700/50 mt-1">
                    {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                    {item.mata_pelajaran} · Kelas {item.kelas} · {item.semester} {item.tahun_ajaran}
                  </p>
                  {item.status === 'ditolak' && item.catatan_admin && (
                    <p className="text-xs text-red-600 mt-1">Alasan: {item.catatan_admin}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(item.file_path, item.file_nama)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                  >
                    <FileText size={14} /> File RPP
                  </button>

                  {item.status === 'disetujui' && item.lembar_persetujuan_path && (
                    <button
                      onClick={() => handleDownload(item.lembar_persetujuan_path, `Lembar-Persetujuan-${item.judul}.pdf`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sage-500 hover:bg-sage-500/10"
                    >
                      <Download size={14} /> Lembar Persetujuan
                    </button>
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
