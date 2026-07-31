import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Loader2, CheckCircle2, School } from 'lucide-react'

const emptyForm = {
  nama_lengkap: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  jenis_kelamin: 'L',
  nama_ayah: '',
  nama_ibu: '',
  alamat: '',
  no_hp_orang_tua: '',
  asal_sekolah: '',
}

export default function PPDBPublik() {
  const [profil, setProfil] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [mengirim, setMengirim] = useState(false)
  const [terkirim, setTerkirim] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle().then(({ data }) => setProfil(data))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setMengirim(true)
    setError('')
    const { error: err } = await supabase.from('ppdb_pendaftar').insert(form)
    setMengirim(false)
    if (err) {
      setError('Gagal mengirim formulir: ' + err.message)
    } else {
      setTerkirim(true)
    }
  }

  function ubah(field, value) {
    setForm({ ...form, [field]: value })
  }

  if (terkirim) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg p-8">
          <div className="w-16 h-16 rounded-full bg-sage-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-sage-500" />
          </div>
          <h1 className="font-display text-xl font-semibold text-ink-950 mb-2">Pendaftaran Terkirim</h1>
          <p className="text-sm text-ink-700/70">
            Terima kasih, formulir pendaftaran <strong>{form.nama_lengkap}</strong> sudah kami terima.
            Pihak sekolah akan menghubungi Anda melalui nomor HP yang didaftarkan untuk info selanjutnya.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-ink-950 flex items-center justify-center mx-auto mb-3">
            <School size={26} className="text-brass-400" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Formulir Pendaftaran Siswa Baru
          </h1>
          {profil?.nama_sekolah && (
            <p className="text-ink-700/60 mt-1">{profil.nama_sekolah}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-4">
          <div>
            <label className="label-field">Nama Lengkap Calon Siswa *</label>
            <input required className="input-field" value={form.nama_lengkap} onChange={(e) => ubah('nama_lengkap', e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Tempat Lahir</label>
              <input className="input-field" value={form.tempat_lahir} onChange={(e) => ubah('tempat_lahir', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Tanggal Lahir</label>
              <input type="date" className="input-field" value={form.tanggal_lahir} onChange={(e) => ubah('tanggal_lahir', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-field">Jenis Kelamin</label>
            <select className="input-field" value={form.jenis_kelamin} onChange={(e) => ubah('jenis_kelamin', e.target.value)}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Nama Ayah</label>
              <input className="input-field" value={form.nama_ayah} onChange={(e) => ubah('nama_ayah', e.target.value)} />
            </div>
            <div>
              <label className="label-field">Nama Ibu</label>
              <input className="input-field" value={form.nama_ibu} onChange={(e) => ubah('nama_ibu', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-field">Alamat</label>
            <textarea className="input-field" rows={2} value={form.alamat} onChange={(e) => ubah('alamat', e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">No. HP Orang Tua/Wali *</label>
              <input
                required
                className="input-field"
                placeholder="08xxxxxxxxxx"
                value={form.no_hp_orang_tua}
                onChange={(e) => ubah('no_hp_orang_tua', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Asal TK/PAUD (opsional)</label>
              <input className="input-field" value={form.asal_sekolah} onChange={(e) => ubah('asal_sekolah', e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" className="btn-primary w-full justify-center" disabled={mengirim}>
            {mengirim && <Loader2 size={16} className="animate-spin" />}
            Kirim Pendaftaran
          </button>
        </form>
      </div>
    </div>
  )
}
