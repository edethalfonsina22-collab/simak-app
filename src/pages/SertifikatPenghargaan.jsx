import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { buildSertifikatDocxFile, downloadSertifikatDocx } from '../lib/generateSertifikatDocx'
import {
  Award, Search, Upload, Loader2, Download, Trash2, Sparkles, X, Eye,
} from 'lucide-react'

// Modal "Generate dengan AI" — sama pola dengan AiRppModal di ArsipRPP.jsx,
// tapi lebih sederhana: hanya menghasilkan 1 kalimat isi sertifikat/piagam
// lewat /api/generate-sertifikat (Gemini), lalu langsung membuat .docx dan
// menyimpan record-nya ke tabel sertifikat_penghargaan sekaligus (tidak ada
// langkah "isi form upload" terpisah seperti di RPP, karena datanya lebih ringkas).
function SertifikatAiModal({ isOpen, onClose, onSaved, penerimaTipe, namaPenerimaAwal, siswaId, guruId, defaultNamaKepalaSekolah, nipKepalaSekolah, tempatTtd, namaSekolah, session, profil }) {
  const [jenis, setJenis] = useState('sertifikat')
  const [namaPenerima, setNamaPenerima] = useState(namaPenerimaAwal || '')
  const [acaraPrestasi, setAcaraPrestasi] = useState('')
  const [penyelenggara, setPenyelenggara] = useState('')
  const [catatanTambahan, setCatatanTambahan] = useState('')
  const [tanggal, setTanggal] = useState('')

  const [loading, setLoading] = useState(false)
  const [deskripsi, setDeskripsi] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setNamaPenerima(namaPenerimaAwal || '')
      setJenis('sertifikat')
      setAcaraPrestasi('')
      setPenyelenggara('')
      setCatatanTambahan('')
      setTanggal('')
      setDeskripsi('')
      setErrorMsg('')
    }
  }, [isOpen, namaPenerimaAwal])

  if (!isOpen) return null

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setDeskripsi('')
    try {
      const res = await fetch('/api/generate-sertifikat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jenis, penerimaTipe, namaPenerima, acaraPrestasi, penyelenggara, catatanTambahan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses permintaan AI.')
      setDeskripsi(data?.result || '')
    } catch (err) {
      setErrorMsg('Gagal membuat teks: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setErrorMsg('')
    try {
      const judul = acaraPrestasi
      const docxData = {
        jenis,
        namaPenerima,
        namaSekolah,
        deskripsi,
        namaKepalaSekolah: defaultNamaKepalaSekolah,
        nipKepalaSekolah,
        tempatTtd,
        tanggal,
      }
      const file = await buildSertifikatDocxFile(docxData)

      const ext = 'docx'
      const path = `sertifikat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('sertifikat-files').upload(path, file)
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('sertifikat_penghargaan').insert({
        jenis,
        penerima_tipe: penerimaTipe,
        guru_id: penerimaTipe === 'guru' ? guruId : null,
        siswa_id: penerimaTipe === 'siswa' ? siswaId : null,
        nama_penerima: namaPenerima,
        judul,
        penyelenggara,
        tanggal: tanggal || null,
        deskripsi,
        file_path: path,
        file_nama: file.name,
        dibuat_oleh: session?.user?.id,
        nama_pembuat: profil?.nama_lengkap || session?.user?.email,
      })
      if (insertError) throw insertError

      onSaved()
      onClose()
    } catch (err) {
      setErrorMsg('Gagal menyimpan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePreviewDownload() {
    if (!deskripsi) return
    await downloadSertifikatDocx({
      jenis,
      namaPenerima,
      namaSekolah,
      deskripsi,
      namaKepalaSekolah: defaultNamaKepalaSekolah,
      nipKepalaSekolah,
      tempatTtd,
      tanggal,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-900/[0.08] bg-slate-50">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h3 className="font-display font-semibold text-ink-900">
              Buat {penerimaTipe === 'guru' ? 'Sertifikat/Penghargaan Saya' : 'Sertifikat/Penghargaan Siswa'} (AI)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setJenis('sertifikat')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border ${jenis === 'sertifikat' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}
              >
                Sertifikat
              </button>
              <button
                type="button"
                onClick={() => setJenis('penghargaan')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border ${jenis === 'penghargaan' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}
              >
                Piagam Penghargaan
              </button>
            </div>

            <input
              className="input-field w-full"
              placeholder="Nama Penerima"
              value={namaPenerima}
              onChange={(e) => setNamaPenerima(e.target.value)}
              required
              disabled={!!namaPenerimaAwal}
            />
            <input
              className="input-field w-full"
              placeholder={jenis === 'sertifikat' ? 'Nama Kegiatan/Acara (mis. Lomba Cerdas Cermat)' : 'Prestasi/Alasan Penghargaan (mis. Juara 1 OSN Matematika)'}
              value={acaraPrestasi}
              onChange={(e) => setAcaraPrestasi(e.target.value)}
              required
            />
            <input
              className="input-field w-full"
              placeholder="Penyelenggara (opsional)"
              value={penyelenggara}
              onChange={(e) => setPenyelenggara(e.target.value)}
            />
            <input
              className="input-field w-full"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
            <textarea
              className="input-field w-full text-xs"
              rows={2}
              placeholder="Catatan tambahan untuk AI (opsional)"
              value={catatanTambahan}
              onChange={(e) => setCatatanTambahan(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? 'Menyusun Teks...' : 'Generate Teks dengan AI'}
            </button>
          </form>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{errorMsg}</div>
          )}

          {deskripsi && (
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Teks Isi (bisa diedit)</p>
              <textarea
                className="w-full text-sm p-2 border rounded bg-white"
                rows={3}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePreviewDownload}
                  className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-100"
                >
                  Unduh Pratinjau .docx
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan ke Arsip'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SertifikatPenghargaan() {
  const { profil, session, isAdmin } = useAuth()
  const [tab, setTab] = useState('guru') // 'guru' | 'siswa'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const [schoolProfile, setSchoolProfile] = useState(null)

  const [siswaQuery, setSiswaQuery] = useState('')
  const [siswaResults, setSiswaResults] = useState([])
  const [siswaTerpilih, setSiswaTerpilih] = useState(null)

  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  async function loadItems() {
    setLoading(true)
    let q = supabase
      .from('sertifikat_penghargaan')
      .select('*, guru(nama_lengkap), siswa(nama_lengkap, nis)')
      .eq('penerima_tipe', tab)
      .order('dibuat_pada', { ascending: false })

    if (tab === 'guru' && !isAdmin) {
      q = q.eq('guru_id', profil?.guru_id)
    }
    if (tab === 'siswa' && !isAdmin) {
      q = q.eq('dibuat_oleh', session?.user?.id)
    }

    const { data } = await q
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profil?.guru_id])

  useEffect(() => {
    supabase
      .from('profil_sekolah')
      .select('*')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (!error) setSchoolProfile(data)
      })
  }, [])

  useEffect(() => {
    if (tab !== 'siswa' || siswaQuery.trim().length < 2) {
      setSiswaResults([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nis, kelas(nama_kelas)')
        .ilike('nama_lengkap', `%${siswaQuery}%`)
        .eq('status', 'aktif')
        .limit(8)
      setSiswaResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [siswaQuery, tab])

  async function getSignedUrl(path) {
    const { data, error } = await supabase.storage.from('sertifikat-files').createSignedUrl(path, 300)
    if (error) throw error
    return data.signedUrl
  }

  async function handleDownload(item) {
    try {
      const url = await getSignedUrl(item.file_path)
      const a = document.createElement('a')
      a.href = url
      a.download = item.file_nama
      a.click()
    } catch (err) {
      alert('Gagal unduh file: ' + err.message)
    }
  }

  async function handlePreview(item) {
    try {
      const url = await getSignedUrl(item.file_path)
      setPreview({ url, fileName: item.file_nama })
    } catch (err) {
      alert('Gagal membuka pratinjau: ' + err.message)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Hapus "${item.judul}" milik ${item.nama_penerima}?`)) return
    const { error } = await supabase.from('sertifikat_penghargaan').delete().eq('id', item.id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    await supabase.storage.from('sertifikat-files').remove([item.file_path])
    await loadItems()
  }

  const filtered = items.filter((item) => {
    const q = query.toLowerCase()
    return (
      item.nama_penerima?.toLowerCase().includes(q) ||
      item.judul?.toLowerCase().includes(q) ||
      item.penyelenggara?.toLowerCase().includes(q)
    )
  })

  function openAiModalUntukSiswa() {
    if (!siswaTerpilih) {
      alert('Pilih siswa terlebih dahulu.')
      return
    }
    setIsAiModalOpen(true)
  }

  return (
    <Layout title="Sertifikat & Penghargaan" subtitle="Arsip sertifikat kegiatan dan piagam penghargaan">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Award size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Sertifikat & Penghargaan</p>
            <p className="text-sm text-paper/70 mt-0.5">{items.length} arsip di tab ini</p>
          </div>
        </div>
        <Award size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('guru')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'guru' ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.05] text-ink-700/60 hover:bg-ink-900/[0.08]'
          }`}
        >
          Untuk Saya
        </button>
        <button
          onClick={() => setTab('siswa')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'siswa' ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.05] text-ink-700/60 hover:bg-ink-900/[0.08]'
          }`}
        >
          Untuk Siswa
        </button>
      </div>

      <div className="card p-6 mb-6">
        {tab === 'guru' ? (
          <>
            <h3 className="font-display text-lg font-semibold mb-3">Buat Sertifikat/Penghargaan Saya</h3>
            <p className="text-xs text-ink-700/50 mb-3">
              Dibuat atas nama {profil?.nama_lengkap || 'Anda'}.
            </p>
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
            >
              <Sparkles size={16} /> Generate dengan AI
            </button>
          </>
        ) : (
          <>
            <h3 className="font-display text-lg font-semibold mb-3">Buat Sertifikat/Penghargaan untuk Siswa</h3>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                className="input-field !pl-9"
                placeholder="Cari nama siswa..."
                value={siswaQuery}
                onChange={(e) => { setSiswaQuery(e.target.value); setSiswaTerpilih(null) }}
              />
            </div>
            {siswaResults.length > 0 && !siswaTerpilih && (
              <ul className="border border-slate-200 rounded-lg divide-y mb-3 max-h-40 overflow-y-auto">
                {siswaResults.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { setSiswaTerpilih(s); setSiswaQuery(s.nama_lengkap) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {s.nama_lengkap} <span className="text-ink-700/40 text-xs">· {s.kelas?.nama_kelas || '-'} · NIS {s.nis || '-'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {siswaTerpilih && (
              <p className="text-xs text-sage-600 mb-3">
                Siswa terpilih: <strong>{siswaTerpilih.nama_lengkap}</strong>
              </p>
            )}
            <button
              type="button"
              onClick={openAiModalUntukSiswa}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 transition-all disabled:opacity-40"
              disabled={!siswaTerpilih}
            >
              <Sparkles size={16} /> Generate dengan AI
            </button>
          </>
        )}
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            className="input-field !pl-9"
            placeholder="Cari nama penerima, judul, atau penyelenggara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Daftar Arsip</h3>
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada arsip.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {filtered.map((item) => (
              <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600">
                      {item.jenis === 'sertifikat' ? 'Sertifikat' : 'Penghargaan'}
                    </span>
                    <span className="text-sm font-medium text-ink-900 truncate">{item.nama_penerima}</span>
                  </div>
                  <p className="text-xs text-ink-700/50 mt-1">
                    {item.judul}{item.penyelenggara ? ` · ${item.penyelenggara}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handlePreview(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]">
                    <Eye size={14} /> Lihat
                  </button>
                  <button onClick={() => handleDownload(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]">
                    <Download size={14} /> Unduh
                  </button>
                  {(isAdmin || item.dibuat_oleh === session?.user?.id) && (
                    <button onClick={() => handleDelete(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SertifikatAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSaved={loadItems}
        penerimaTipe={tab}
        namaPenerimaAwal={tab === 'guru' ? (profil?.nama_lengkap || '') : (siswaTerpilih?.nama_lengkap || '')}
        siswaId={siswaTerpilih?.id}
        guruId={profil?.guru_id}
        defaultNamaKepalaSekolah={schoolProfile?.kepala_sekolah || ''}
        nipKepalaSekolah={schoolProfile?.nip_kepala_sekolah || ''}
        tempatTtd={schoolProfile?.tempat_ttd || ''}
        namaSekolah={schoolProfile?.nama_sekolah || ''}
        session={session}
        profil={profil}
      />

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-900/[0.08]">
              <p className="text-sm font-medium text-ink-900 truncate pr-4">{preview.fileName}</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-ink-900/[0.05] shrink-0">
                <X size={18} />
              </button>
            </div>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(preview.url)}&embedded=true`}
              title={preview.fileName}
              className="flex-1 w-full"
              style={{ border: 'none' }}
            />
          </div>
        </div>
      )}
    </Layout>
  )
}
