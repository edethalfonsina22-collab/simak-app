import { useEffect, useMemo, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Upload, FileText, Download, CheckCircle2, XCircle, Clock, Loader2, NotebookPen, Wand2, Users } from 'lucide-react'
import { findRppTemplate } from '../data/rppTemplates'
import { buildRppDocxFile } from '../lib/generateRppDocx'

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

const NEW_VALUE = '__baru__'

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

  // Mode dropdown vs input manual (untuk Mata Pelajaran & Kelas baru)
  const [mapelIsNew, setMapelIsNew] = useState(false)
  const [kelasIsNew, setKelasIsNew] = useState(false)
  // Nilai dropdown Materi yang sedang dipilih (untuk mengisi Judul RPP)
  const [materiPilihan, setMateriPilihan] = useState('')
  const [generatingTemplate, setGeneratingTemplate] = useState(false)

  // Form persetujuan admin, per baris
  const [approvalForm, setApprovalForm] = useState({ nama: '', jabatan: 'Kepala Sekolah' })
  const [rejectingId, setRejectingId] = useState(null)
  const [catatanTolak, setCatatanTolak] = useState('')

  // ---- Upload massal RPP (admin) ----
  const [guruList, setGuruList] = useState([])
  const [bulkCommon, setBulkCommon] = useState({
    mata_pelajaran: '',
    kelas: '',
    semester: 'Ganjil',
    tahun_ajaran: '',
  })
  const [bulkFiles, setBulkFiles] = useState([]) // { id, file, guru_id, judul }
  const [bulkApplyGuru, setBulkApplyGuru] = useState('')
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResults, setBulkResults] = useState([]) // { id, name, ok, message }

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

  // Ambil daftar guru untuk keperluan upload massal (hanya admin)
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('guru')
      .select('id, nama_lengkap')
      .order('nama_lengkap')
      .then(({ data, error }) => {
        if (!error) setGuruList(data || [])
      })
  }, [isAdmin])

  // ---- Daftar Mata Pelajaran & Kelas yang sudah pernah ada, untuk dropdown ----
  const mapelOptions = useMemo(() => {
    return [...new Set(items.map((i) => i.mata_pelajaran).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    )
  }, [items])

  const kelasOptions = useMemo(() => {
    return [...new Set(items.map((i) => i.kelas).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
  }, [items])

  // ---- Daftar Materi (judul RPP) yang cocok dengan Mata Pelajaran + Kelas terpilih ----
  const materiOptions = useMemo(() => {
    if (!form.mata_pelajaran || !form.kelas) return []
    return [
      ...new Set(
        items
          .filter((i) => i.mata_pelajaran === form.mata_pelajaran && i.kelas === form.kelas)
          .map((i) => i.judul)
          .filter(Boolean)
      ),
    ]
  }, [items, form.mata_pelajaran, form.kelas])

  // Template RPP siap-pakai untuk kombinasi Mata Pelajaran + Kelas yang dipilih
  const rppTemplate = useMemo(
    () => findRppTemplate(form.mata_pelajaran, form.kelas),
    [form.mata_pelajaran, form.kelas]
  )

  async function handleGenerateTemplate() {
    if (!rppTemplate) return
    setGeneratingTemplate(true)
    try {
      const file = await buildRppDocxFile(rppTemplate)
      setForm((f) => ({ ...f, judul: rppTemplate.materiPokok, file }))
      setMateriPilihan(rppTemplate.materiPokok)
    } catch (err) {
      alert('Gagal membuat file RPP: ' + err.message)
    }
    setGeneratingTemplate(false)
  }

  function handleMapelSelect(value) {
    if (value === NEW_VALUE) {
      setMapelIsNew(true)
      setForm((f) => ({ ...f, mata_pelajaran: '' }))
    } else {
      setForm((f) => ({ ...f, mata_pelajaran: value }))
    }
    // Ganti mata pelajaran -> reset pilihan materi lama
    setMateriPilihan('')
  }

  function handleKelasSelect(value) {
    if (value === NEW_VALUE) {
      setKelasIsNew(true)
      setForm((f) => ({ ...f, kelas: '' }))
    } else {
      setForm((f) => ({ ...f, kelas: value }))
    }
    setMateriPilihan('')
  }

  function handleMateriSelect(value) {
    setMateriPilihan(value)
    if (value === NEW_VALUE) {
      setForm((f) => ({ ...f, judul: '' }))
    } else if (value) {
      setForm((f) => ({ ...f, judul: value }))
    }
  }

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
      setMapelIsNew(false)
      setKelasIsNew(false)
      setMateriPilihan('')
      await load()
    }
    setUploading(false)
  }

  // ---- Upload massal: handlers ----
  function handleBulkFilesSelect(e) {
    const selected = Array.from(e.target.files || [])
    const mapped = selected.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      guru_id: '',
      judul: '',
    }))
    setBulkFiles((prev) => [...prev, ...mapped])
    setBulkResults([])
    e.target.value = ''
  }

  function updateBulkFile(id, patch) {
    setBulkFiles((prev) => prev.map((bf) => (bf.id === id ? { ...bf, ...patch } : bf)))
  }

  function removeBulkFile(id) {
    setBulkFiles((prev) => prev.filter((bf) => bf.id !== id))
    setBulkResults((prev) => prev.filter((r) => r.id !== id))
  }

  function applyGuruToAll() {
    if (!bulkApplyGuru) return
    setBulkFiles((prev) => prev.map((bf) => ({ ...bf, guru_id: bulkApplyGuru })))
  }

  async function handleBulkSubmit() {
    if (!bulkCommon.mata_pelajaran || !bulkCommon.kelas || !bulkCommon.tahun_ajaran) {
      alert('Isi Mata Pelajaran, Kelas, dan Tahun Ajaran dulu (berlaku untuk semua file).')
      return
    }
    if (bulkFiles.length === 0) return

    setBulkUploading(true)
    const results = []

    for (const bf of bulkFiles) {
      if (!bf.guru_id || !bf.judul) {
        results.push({
          id: bf.id,
          name: bf.file.name,
          ok: false,
          message: 'Guru/Judul belum diisi',
        })
        continue
      }

      try {
        const ext = bf.file.name.split('.').pop()
        const path = `${bf.guru_id}/${Date.now()}-${bf.id}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('rpp-files')
          .upload(path, bf.file)
        if (uploadError) throw new Error('Upload file gagal: ' + uploadError.message)

        const { error: insertError } = await supabase.from('rpp').insert({
          guru_id: bf.guru_id,
          judul: bf.judul,
          mata_pelajaran: bulkCommon.mata_pelajaran,
          kelas: bulkCommon.kelas,
          semester: bulkCommon.semester,
          tahun_ajaran: bulkCommon.tahun_ajaran,
          file_path: path,
          file_nama: bf.file.name,
        })
        // Cek error insert secara eksplisit — supaya kalau RLS menolak simpan data,
        // ini langsung kelihatan per file dan tidak diam-diam gagal.
        if (insertError) throw new Error('Simpan data gagal (cek RLS/izin): ' + insertError.message)

        results.push({ id: bf.id, name: bf.file.name, ok: true, message: 'Berhasil diupload' })
      } catch (err) {
        results.push({ id: bf.id, name: bf.file.name, ok: false, message: err.message })
      }
    }

    setBulkResults(results)
    setBulkUploading(false)

    // Hapus dari daftar hanya file yang berhasil — yang gagal tetap tampil supaya bisa dicoba lagi
    const successIds = results.filter((r) => r.ok).map((r) => r.id)
    setBulkFiles((prev) => prev.filter((bf) => !successIds.includes(bf.id)))

    await load()
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
            {/* ---- Mata Pelajaran: dropdown, bisa tambah baru ---- */}
            {mapelIsNew || mapelOptions.length === 0 ? (
              <div className="flex gap-2">
                <input
                  className="input-field"
                  placeholder="Mata Pelajaran baru"
                  value={form.mata_pelajaran}
                  onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })}
                  autoFocus={mapelIsNew}
                />
                {mapelOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMapelIsNew(false)
                      setForm((f) => ({ ...f, mata_pelajaran: '' }))
                    }}
                    className="text-xs text-ink-700/50 shrink-0 px-2"
                  >
                    Pilih dari daftar
                  </button>
                )}
              </div>
            ) : (
              <select
                className="input-field"
                value={form.mata_pelajaran}
                onChange={(e) => handleMapelSelect(e.target.value)}
              >
                <option value="">Pilih Mata Pelajaran</option>
                {mapelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value={NEW_VALUE}>+ Mata Pelajaran baru...</option>
              </select>
            )}

            {/* ---- Kelas: dropdown, bisa tambah baru ---- */}
            {kelasIsNew || kelasOptions.length === 0 ? (
              <div className="flex gap-2">
                <input
                  className="input-field"
                  placeholder="Kelas baru"
                  value={form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                  autoFocus={kelasIsNew}
                />
                {kelasOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setKelasIsNew(false)
                      setForm((f) => ({ ...f, kelas: '' }))
                    }}
                    className="text-xs text-ink-700/50 shrink-0 px-2"
                  >
                    Pilih dari daftar
                  </button>
                )}
              </div>
            ) : (
              <select
                className="input-field"
                value={form.kelas}
                onChange={(e) => handleKelasSelect(e.target.value)}
              >
                <option value="">Pilih Kelas</option>
                {kelasOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
                <option value={NEW_VALUE}>+ Kelas baru...</option>
              </select>
            )}

            {/* ---- Template siap pakai: muncul kalau ada template untuk mapel+kelas ini ---- */}
            {rppTemplate && (
              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl bg-sage-500/10 px-3 py-2.5">
                <p className="text-xs text-ink-700">
                  Template RPP <strong>{rppTemplate.materiPokok}</strong> tersedia untuk {rppTemplate.mataPelajaran} Kelas {rppTemplate.kelas}.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateTemplate}
                  disabled={generatingTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sage-500 text-white disabled:opacity-50 shrink-0"
                >
                  {generatingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  Pakai Template
                </button>
              </div>
            )}

            {/* ---- Materi: muncul otomatis begitu Mata Pelajaran + Kelas terpilih ---- */}
            {materiOptions.length > 0 && (
              <div className="sm:col-span-2">
                <select
                  className="input-field"
                  value={materiPilihan}
                  onChange={(e) => handleMateriSelect(e.target.value)}
                >
                  <option value="">Pilih Materi yang sudah ada (opsional)</option>
                  {materiOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={NEW_VALUE}>+ Materi baru...</option>
                </select>
                <p className="text-[11px] text-ink-700/40 mt-1">
                  Memilih materi akan mengisi otomatis kolom Judul RPP di bawah.
                </p>
              </div>
            )}

            <input
              className="input-field"
              placeholder="Judul RPP"
              value={form.judul}
              onChange={(e) => {
                setForm({ ...form, judul: e.target.value })
                setMateriPilihan(NEW_VALUE)
              }}
              required
            />
            <input
              className="input-field"
              placeholder="Tahun Ajaran (mis. 2026/2027)"
              value={form.tahun_ajaran}
              onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })}
            />
            <select
              className="input-field"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
            <div>
              <input
                className="input-field"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                required
              />
              {form.file && rppTemplate && form.file.name.startsWith('RPP_') && (
                <p className="text-[11px] text-sage-500 mt-1">File dibuat otomatis dari template.</p>
              )}
            </div>
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

      {/* ---- Upload Massal RPP (admin) ---- */}
      {isAdmin && (
        <div className="card p-6 mb-6">
          <h3 className="font-display text-lg font-semibold mb-1">Upload Massal RPP</h3>
          <p className="text-xs text-ink-700/50 mb-4">
            Upload banyak file RPP sekaligus untuk beberapa guru. Mata Pelajaran, Kelas, Semester, dan Tahun
            Ajaran di bawah berlaku sama untuk semua file — tinggal tentukan Guru dan Judul per file sebelum
            diupload.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <input
              className="input-field"
              placeholder="Mata Pelajaran"
              list="mapel-list-bulk"
              value={bulkCommon.mata_pelajaran}
              onChange={(e) => setBulkCommon({ ...bulkCommon, mata_pelajaran: e.target.value })}
            />
            <datalist id="mapel-list-bulk">
              {mapelOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            <input
              className="input-field"
              placeholder="Kelas"
              list="kelas-list-bulk"
              value={bulkCommon.kelas}
              onChange={(e) => setBulkCommon({ ...bulkCommon, kelas: e.target.value })}
            />
            <datalist id="kelas-list-bulk">
              {kelasOptions.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>

            <select
              className="input-field"
              value={bulkCommon.semester}
              onChange={(e) => setBulkCommon({ ...bulkCommon, semester: e.target.value })}
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>

            <input
              className="input-field"
              placeholder="Tahun Ajaran (mis. 2026/2027)"
              value={bulkCommon.tahun_ajaran}
              onChange={(e) => setBulkCommon({ ...bulkCommon, tahun_ajaran: e.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="btn-primary inline-flex items-center gap-2 cursor-pointer w-fit">
              <Upload size={16} />
              Pilih File RPP
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleBulkFilesSelect}
              />
            </label>
            <span className="text-xs text-ink-700/50 ml-3">
              {bulkFiles.length > 0 ? `${bulkFiles.length} file dipilih` : 'Belum ada file dipilih'}
            </span>
          </div>

          {bulkFiles.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Users size={14} className="text-ink-700/40" />
                <select
                  className="input-field !py-1.5 !text-xs w-56"
                  value={bulkApplyGuru}
                  onChange={(e) => setBulkApplyGuru(e.target.value)}
                >
                  <option value="">Set guru untuk semua file...</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama_lengkap}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyGuruToAll}
                  className="text-xs font-medium text-ink-700 px-2.5 py-1.5 rounded-lg hover:bg-ink-900/[0.05]"
                >
                  Terapkan ke semua
                </button>
              </div>

              <ul className="divide-y divide-ink-900/[0.06] mb-4">
                {bulkFiles.map((bf) => {
                  const result = bulkResults.find((r) => r.id === bf.id)
                  return (
                    <li key={bf.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText size={14} className="text-ink-700/40 shrink-0" />
                        <span className="text-xs text-ink-700 truncate">{bf.file.name}</span>
                      </div>
                      <select
                        className="input-field !py-1.5 !text-xs sm:w-48 shrink-0"
                        value={bf.guru_id}
                        onChange={(e) => updateBulkFile(bf.id, { guru_id: e.target.value })}
                      >
                        <option value="">Pilih Guru</option>
                        {guruList.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nama_lengkap}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input-field !py-1.5 !text-xs sm:w-56 shrink-0"
                        placeholder="Judul RPP"
                        value={bf.judul}
                        onChange={(e) => updateBulkFile(bf.id, { judul: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeBulkFile(bf.id)}
                        className="text-ink-700/40 hover:text-red-600 shrink-0 p-1"
                        title="Hapus dari daftar"
                      >
                        <XCircle size={16} />
                      </button>
                      {result && (
                        <span
                          className={`text-[11px] font-medium shrink-0 flex items-center gap-1 ${
                            result.ok ? 'text-sage-500' : 'text-red-600'
                          }`}
                        >
                          {result.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {result.ok ? 'Berhasil' : result.message}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={bulkUploading}
                className="btn-primary"
              >
                {bulkUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {bulkUploading ? 'Mengunggah...' : `Upload ${bulkFiles.length} File`}
              </button>

              {bulkResults.length > 0 && bulkResults.some((r) => !r.ok) && (
                <p className="text-xs text-red-600 mt-2">
                  Beberapa file gagal diupload — lihat keterangan di samping masing-masing file di atas. File
                  yang gagal tetap ada di daftar supaya bisa dicoba lagi tanpa perlu memilih ulang filenya.
                </p>
              )}
            </>
          )}
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
