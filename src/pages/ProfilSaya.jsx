import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import GrafikAktivitas from '../components/GrafikAktivitas'
import { Camera, Loader2, Save } from 'lucide-react'

export default function ProfilSaya() {
  const { profil } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    async function load() {
      if (!profil?.guru_id) {
        setLoading(false)
        return
      }
      const { data: row } = await supabase
        .from('guru')
        .select('*')
        .eq('id', profil.guru_id)
        .maybeSingle()
      setData(row)
      setLoading(false)
    }
    load()
  }, [profil])

  function fotoUrl() {
    if (!data?.foto_profil_path) return null
    return supabase.storage.from('foto-profil').getPublicUrl(data.foto_profil_path).data.publicUrl
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)

    const ext = file.name.split('.').pop()
    const path = `${profil.guru_id}/foto.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('foto-profil')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Gagal upload foto: ' + uploadError.message)
      setUploadingFoto(false)
      return
    }

    const { error: updateError } = await supabase
      .from('guru')
      .update({ foto_profil_path: path })
      .eq('id', profil.guru_id)

    if (updateError) {
      alert('Gagal simpan foto: ' + updateError.message)
    } else {
      setData({ ...data, foto_profil_path: path })
    }
    setUploadingFoto(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('guru')
      .update({
        nama_lengkap: data.nama_lengkap,
        mata_pelajaran: data.mata_pelajaran,
        no_hp: data.no_hp,
        email: data.email,
        alamat: data.alamat,
        tanggal_lahir: data.tanggal_lahir || null,
        pendidikan_terakhir: data.pendidikan_terakhir,
        nuptk: data.nuptk,
        pangkat_golongan: data.pangkat_golongan,
      })
      .eq('id', profil.guru_id)

    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    } else {
      setSavedAt(new Date())
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
        <p className="text-sm text-ink-700/50">Memuat...</p>
      </Layout>
    )
  }

  if (!profil?.guru_id || !data) {
    return (
      <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
        <div className="card p-6">
          <p className="text-sm text-ink-700/60">
            Akun Anda belum terhubung ke data guru. Hubungi admin untuk menautkan akun ini ke salah satu data guru.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
      <form onSubmit={handleSave} className="max-w-2xl space-y-5">
        {/* Kartu identitas — background biru tua (navy), kontras elegan dengan aksen emas */}
        <div className="relative overflow-hidden rounded-xl p-6 flex items-center gap-5 bg-gradient-to-br from-blue-900 to-blue-950">
          {/* Dekorasi lingkaran samar di background, senada dengan aksen bulat di identitas guru */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-white/10 ring-2 ring-white/20 overflow-hidden flex items-center justify-center">
              {fotoUrl() ? (
                <img src={fotoUrl()} alt="Foto profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-display font-semibold text-white/70">
                  {data.nama_lengkap?.[0] || '?'}
                </span>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brass-400 flex items-center justify-center cursor-pointer shadow-md">
              {uploadingFoto ? (
                <Loader2 size={13} className="animate-spin text-ink-950" />
              ) : (
                <Camera size={13} className="text-ink-950" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} disabled={uploadingFoto} />
            </label>
          </div>
          <div className="relative">
            <p className="font-display font-semibold text-lg text-white">{data.nama_lengkap}</p>
            <p className="text-sm text-blue-200/70">{data.nip ? `NIP ${data.nip}` : 'NIP belum diisi'}</p>
          </div>
        </div>

        <GrafikAktivitas guruId={profil.guru_id} />

        <div className="card relative overflow-hidden p-6 space-y-4">
          <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Nama Lengkap</label>
              <input
                className="input w-full"
                value={data.nama_lengkap || ''}
                onChange={(e) => setData({ ...data, nama_lengkap: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Mata Pelajaran yang Diampu</label>
              <input
                className="input w-full"
                value={data.mata_pelajaran || ''}
                onChange={(e) => setData({ ...data, mata_pelajaran: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">NUPTK</label>
              <input
                className="input w-full"
                placeholder="mis. 1234567890123456"
                value={data.nuptk || ''}
                onChange={(e) => setData({ ...data, nuptk: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Pangkat / Golongan</label>
              <input
                className="input w-full"
                placeholder="mis. Penata Muda / III-a"
                value={data.pangkat_golongan || ''}
                onChange={(e) => setData({ ...data, pangkat_golongan: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Nomor HP</label>
              <input
                className="input w-full"
                value={data.no_hp || ''}
                onChange={(e) => setData({ ...data, no_hp: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Email</label>
              <input
                className="input w-full"
                type="email"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Tanggal Lahir</label>
              <input
                className="input w-full"
                type="date"
                value={data.tanggal_lahir || ''}
                onChange={(e) => setData({ ...data, tanggal_lahir: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Pendidikan Terakhir</label>
              <input
                className="input w-full"
                placeholder="mis. S1 Pendidikan Guru SD"
                value={data.pendidikan_terakhir || ''}
                onChange={(e) => setData({ ...data, pendidikan_terakhir: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-ink-700/60 mb-1 block">Alamat</label>
              <textarea
                className="input w-full"
                rows={2}
                value={data.alamat || ''}
                onChange={(e) => setData({ ...data, alamat: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            {savedAt && <span className="text-xs text-sage-500">Tersimpan</span>}
          </div>
        </div>
      </form>
    </Layout>
  )
}
