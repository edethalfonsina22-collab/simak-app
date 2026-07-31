import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Save, Loader2, CheckCircle2 } from 'lucide-react'

const emptyForm = {
  nama_sekolah: '',
  npsn: '',
  alamat: '',
  telepon: '',
  email: '',
  kepala_sekolah: '',
  tahun_berdiri: '',
  akreditasi: '',
  visi: '',
  misi: '',
  sejarah: '',
}

export default function ProfilSekolah() {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tersimpan, setTersimpan] = useState(false)

  async function muatData() {
    setLoading(true)
    const { data } = await supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle()
    if (data) setForm({ ...emptyForm, ...data })
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
      subtitle="Data ini tampil di halaman PPDB publik dan bisa dipakai untuk keperluan administrasi lain"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
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
