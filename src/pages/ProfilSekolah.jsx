import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Save, Loader2, CheckCircle2, ImagePlus, PenTool } from 'lucide-react'

const emptyForm = {
  nama_sekolah: '',
  npsn: '',
  alamat: '',
  telepon: '',
  email: '',
  kepala_sekolah: '',
  nip_kepala_sekolah: '',
  logo_path: '',
  ttd_kepala_sekolah_path: '',
  tahun_berdiri: '',
  akreditasi: '',
  visi: '',
  misi: '',
  sejarah: '',
  kabupaten: '',
  dinas_pendidikan: '',
  kecamatan: '',
  tempat_ttd: '', // <-- nama tempat untuk tanggal di surat/laporan (mis. "Masidang")
  // TAMBAHAN: dipakai di Halaman Identitas Rapor (kop identitas sekolah)
  kelurahan_desa: '',
  kode_pos: '',
  provinsi: '',
  website: '',
}

export default function ProfilSekolah() {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingTtd, setUploadingTtd] = useState(false)
  const [tersimpan, setTersimpan] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [ttdUrl, setTtdUrl] = useState('')

  async function muatData() {
    setLoading(true)
    const { data } = await supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle()
    if (data) {
      setForm({ ...emptyForm, ...data })
      if (data.logo_path) {
        const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(data.logo_path)
        setLogoUrl(pub.publicUrl)
      }
      if (data.ttd_kepala_sekolah_path) {
        const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(data.ttd_kepala_sekolah_path)
        setTtdUrl(pub.publicUrl)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    muatData()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setTersimpan(false)
    const { id, diperbarui_pada, ...payload } = form
    const { error } = await supabase
      .from('profil_sekolah')
      .update({ ...payload, diperbarui_pada: new Date().toISOString() })
      .eq('id', 1)
    setSaving(false)
    if (!error) {
      setTersimpan(true)
      setTimeout(() => setTersimpan(false), 3000)
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)

    const ext = file.name.split('.').pop()
    const path = `logo-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('profil-sekolah').upload(path, file, {
      upsert: true,
    })

    if (uploadError) {
      alert('Gagal upload logo: ' + uploadError.message)
      setUploadingLogo(false)
      return
    }

    const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(path)
    setLogoUrl(pub.publicUrl)
    setForm((f) => ({ ...f, logo_path: path }))
    setUploadingLogo(false)
  }

  // Upload gambar tanda tangan elektronik kepala sekolah — dipakai otomatis
  // di setiap surat yang dicetak untuk pengajuan yang sudah disetujui.
  async function handleTtdChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingTtd(true)

    const ext = file.name.split('.').pop()
    const path = `ttd-kepsek-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('profil-sekolah').upload(path, file, {
      upsert: true,
    })

    if (uploadError) {
      alert('Gagal upload tanda tangan: ' + uploadError.message)
      setUploadingTtd(false)
      return
    }

    const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(path)
    setTtdUrl(pub.publicUrl)
    setForm((f) => ({ ...f, ttd_kepala_sekolah_path: path }))
    setUploadingTtd(false)
  }

  function ubah(field, value) {
    setForm({ ...form, [field]: value })
  }

  if (loading) {
    return (
      <Layout title="Profil Sekolah" subtitle="Data umum, visi, misi, dan sejarah sekolah">
        <p className="text-center py-8 text-ink-700/50 text-sm">Memuat data...</p>
      </Layout>
    )
  }

  return (
    <Layout
      title="Profil Sekolah"
      subtitle="Data ini tampil di halaman PPDB publik dan dipakai untuk kop rapor & dokumen resmi lain"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        <div className="card p-6">
          <h3 className="font-display font-semibold text-ink-950 mb-4">Logo Sekolah</h3>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-ink-900/[0.1] flex items-center justify-center overflow-hidden bg-ink-900/[0.02] shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo sekolah" className="w-full h-full object-contain" />
              ) : (
                <ImagePlus size={24} className="text-ink-700/30" />
              )}
            </div>
            <div>
              <label className="btn-secondary cursor-pointer inline-flex">
                {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {uploadingLogo ? 'Mengunggah...' : 'Upload Logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploadingLogo} />
              </label>
              <p className="text-xs text-ink-700/50 mt-1.5">Format PNG/JPG, dipakai di kop rapor & dokumen resmi.</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-semibold text-ink-950 mb-4">Tanda Tangan Elektronik Kepala Sekolah</h3>
          <div className="flex items-center gap-4">
            <div className="w-32 h-20 rounded-lg border border-ink-900/[0.1] flex items-center justify-center overflow-hidden bg-ink-900/[0.02] shrink-0">
              {ttdUrl ? (
                <img src={ttdUrl} alt="Tanda tangan kepala sekolah" className="w-full h-full object-contain" />
              ) : (
                <PenTool size={24} className="text-ink-700/30" />
              )}
            </div>
            <div>
              <label className="btn-secondary cursor-pointer inline-flex">
                {uploadingTtd ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                {uploadingTtd ? 'Mengunggah...' : 'Upload Tanda Tangan'}
                <input type="file" accept="image/*" className="hidden" onChange={handleTtdChange} disabled={uploadingTtd} />
              </label>
              <p className="text-xs text-ink-700/50 mt-1.5">
                Gunakan PNG dengan latar transparan agar rapi. Sekali diunggah, tanda tangan ini otomatis
                terpasang di setiap Surat Keterangan Izin/Cuti yang dicetak untuk pengajuan yang sudah disetujui.
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-semibold text-ink-950 mb-4">Kop Surat / Kop Rapor</h3>
          <p className="text-xs text-ink-700/50 mb-4">
            Diisi kalau kop rapor perlu menampilkan susunan pemerintahan lengkap (kabupaten, dinas, kecamatan) di atas nama sekolah.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Kabupaten/Kota</label>
              <input
                className="input-field"
                placeholder="KABUPATEN KEPULAUAN ARU"
                value={form.kabupaten}
                onChange={(e) => ubah('kabupaten', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Dinas Pendidikan</label>
              <input
                className="input-field"
                placeholder="DINAS PENDIDIKAN DAN KEBUDAYAAN"
                value={form.dinas_pendidikan}
                onChange={(e) => ubah('dinas_pendidikan', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Kecamatan</label>
              <input
                className="input-field"
                placeholder="KECAMATAN ARU UTARA TIMUR BATULEY"
                value={form.kecamatan}
                onChange={(e) => ubah('kecamatan', e.target.value)}
              />
            </div>
            {/* Nama Tempat untuk tanggal di surat/laporan (menggantikan hardcode "Masidang") */}
            <div className="sm:col-span-2">
              <label className="label-field">Nama Tempat (untuk tanggal di surat/laporan)</label>
              <input
                className="input-field"
                placeholder="Contoh: Masidang"
                value={form.tempat_ttd}
                onChange={(e) => ubah('tempat_ttd', e.target.value)}
              />
              <p className="text-xs text-ink-700/50 mt-1.5">
                Muncul di baris tanggal sebelum tanda tangan kepala sekolah, contoh: "Masidang, 30 Juni 2026".
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-semibold text-ink-950 mb-4">Data Umum</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Nama Sekolah</label>
              <input className="input-field" value={form.nama_sekolah} onChange={(e) => ubah('nama_sekolah', e.target.value)} />
            </div>
            <div>
              <label className="label-field">NPSN</label>
              <input className="input-field" value={form.npsn} onChange={(e) => ubah('npsn', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Kepala Sekolah</label>
              <input className="input-field" value={form.kepala_sekolah} onChange={(e) => ubah('kepala_sekolah', e.target.value)} />
            </div>
            <div>
              <label className="label-field">NIP Kepala Sekolah</label>
              <input className="input-field" value={form.nip_kepala_sekolah} onChange={(e) => ubah('nip_kepala_sekolah', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Tahun Berdiri</label>
              <input className="input-field" value={form.tahun_berdiri} onChange={(e) => ubah('tahun_berdiri', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Akreditasi</label>
              <input className="input-field" placeholder="A / B / C" value={form.akreditasi} onChange={(e) => ubah('akreditasi', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Telepon</label>
              <input className="input-field" value={form.telepon} onChange={(e) => ubah('telepon', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Email Sekolah</label>
              <input className="input-field" value={form.email} onChange={(e) => ubah('email', e.target.value)} />
            </div>
            {/* TAMBAHAN: dipakai di Halaman Identitas Rapor */}
            <div>
              <label className="label-field">Website Sekolah</label>
              <input className="input-field" placeholder="https://..." value={form.website} onChange={(e) => ubah('website', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Kode Pos</label>
              <input className="input-field" value={form.kode_pos} onChange={(e) => ubah('kode_pos', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Kelurahan/Desa</label>
              <input className="input-field" value={form.kelurahan_desa} onChange={(e) => ubah('kelurahan_desa', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Provinsi</label>
              <input className="input-field" value={form.provinsi} onChange={(e) => ubah('provinsi', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Alamat</label>
              <textarea className="input-field" rows={2} value={form.alamat} onChange={(e) => ubah('alamat', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-semibold text-ink-950 mb-4">Visi & Misi</h3>
          <div className="space-y-4">
            <div>
              <label className="label-field">Visi</label>
              <textarea className="input-field" rows={2} value={form.visi} onChange={(e) => ubah('visi', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Misi (satu poin per baris)</label>
              <textarea
                className="input-field"
                rows={5}
                placeholder={'Contoh:\nMenyelenggarakan pendidikan yang berkualitas\nMembentuk karakter siswa yang berakhlak mulia'}
                value={form.misi}
                onChange={(e) => ubah('misi', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-semibold text-ink-950 mb-4">Sejarah Singkat</h3>
          <textarea className="input-field" rows={5} value={form.sejarah} onChange={(e) => ubah('sejarah', e.target.value)} />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Perubahan
          </button>
          {tersimpan && (
            <span className="flex items-center gap-1.5 text-sm text-sage-500">
              <CheckCircle2 size={16} /> Tersimpan
            </span>
          )}
        </div>
      </form>
    </Layout>
  )
}
