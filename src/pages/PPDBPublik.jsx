import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Loader2, CheckCircle2, School } from 'lucide-react'

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Lainnya']

const emptyForm = {
  nama_lengkap: '',
  nik_siswa: '',
  nomor_kk: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  jenis_kelamin: 'L',
  agama: '',
  nama_ayah: '',
  nama_ibu: '',
  alamat: '',
  alamat_tinggal: '',
  no_hp_orang_tua: '',
  asal_sekolah: '',
}

// Ilustrasi anak SD melompat gembira sambil memegang buku.
// Dibuat sebagai SVG asli (bukan gambar/foto) agar ringan dan bebas hak cipta.
function IlustrasiSemangatSekolah() {
  return (
    <svg viewBox="0 0 400 360" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="haloGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FBEEDB" />
          <stop offset="100%" stopColor="#FBEEDB" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo lembut di belakang karakter */}
      <circle cx="200" cy="170" r="150" fill="url(#haloGlow)" />

      {/* Bayangan tanah */}
      <ellipse cx="200" cy="322" rx="70" ry="12" fill="#0B1220" opacity="0.08" />

      {/* Confetti / bintang melayang */}
      <g className="anim-float-a">
        <path d="M60 90 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" fill="#D9A441" />
      </g>
      <g className="anim-float-b">
        <circle cx="335" cy="120" r="6" fill="#6B9080" />
      </g>
      <g className="anim-float-c">
        <path d="M320 210 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="#D9524A" />
      </g>
      <g className="anim-float-a">
        <circle cx="75" cy="230" r="5" fill="#6FB1D9" />
      </g>
      <g className="anim-float-b">
        <path d="M95 150 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#6B9080" />
      </g>

      {/* Garis gerak melompat */}
      <g className="anim-bounce" opacity="0.5">
        <path d="M150 300 q25 10 50 0" stroke="#0B1220" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M235 300 q20 8 40 0" stroke="#0B1220" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>

      {/* Karakter: anak SD melompat memegang buku */}
      <g className="anim-bounce">
        {/* Tas ransel */}
        <rect x="150" y="150" width="46" height="58" rx="14" fill="#D9524A" />

        {/* Kaki (posisi melompat) */}
        <path d="M182 235 q-10 30 -34 42" stroke="#1F2A44" strokeWidth="18" strokeLinecap="round" fill="none" />
        <path d="M198 235 q18 22 14 48" stroke="#1F2A44" strokeWidth="18" strokeLinecap="round" fill="none" />
        {/* Sepatu */}
        <ellipse cx="146" cy="279" rx="14" ry="9" fill="#D9A441" />
        <ellipse cx="214" cy="285" rx="14" ry="9" fill="#D9A441" />

        {/* Badan / baju */}
        <rect x="163" y="165" width="54" height="72" rx="20" fill="#6B9080" />

        {/* Lengan kiri memegang buku ke atas */}
        <path d="M172 178 q-30 -6 -34 -46" stroke="#E8B48A" strokeWidth="15" strokeLinecap="round" fill="none" />
        {/* Lengan kanan mengayun */}
        <path d="M212 190 q30 10 34 40" stroke="#E8B48A" strokeWidth="15" strokeLinecap="round" fill="none" />

        {/* Buku di atas kepala */}
        <g transform="translate(112 108) rotate(-12)">
          <rect x="0" y="0" width="44" height="32" rx="3" fill="#E7A83D" />
          <rect x="4" y="4" width="36" height="24" rx="2" fill="#FFF8EC" />
          <line x1="22" y1="4" x2="22" y2="28" stroke="#E7A83D" strokeWidth="2" />
        </g>

        {/* Kepala */}
        <circle cx="190" cy="140" r="30" fill="#E8B48A" />
        {/* Rambut */}
        <path d="M162 132 q6 -34 40 -30 q22 2 20 26 q-14 -14 -32 -10 q-16 4 -18 20 q-8 -2 -10 -6 z" fill="#2B2118" />
        {/* Wajah gembira */}
        <circle cx="180" cy="142" r="3" fill="#1F2A44" />
        <circle cx="200" cy="142" r="3" fill="#1F2A44" />
        <path d="M178 152 q12 12 24 0" stroke="#1F2A44" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="172" cy="148" r="5" fill="#D9524A" opacity="0.25" />
        <circle cx="208" cy="148" r="5" fill="#D9524A" opacity="0.25" />
      </g>
    </svg>
  )
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
    setError('')

    if (form.nik_siswa.length !== 16) {
      setError('NIK Siswa harus terdiri dari 16 digit angka.')
      return
    }
    if (form.nomor_kk.length !== 16) {
      setError('Nomor KK harus terdiri dari 16 digit angka.')
      return
    }

    setMengirim(true)
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

  const gayaAnimasi = `
    @keyframes bounceGentle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-14px); }
    }
    @keyframes floatA {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(4px, -10px) rotate(15deg); }
    }
    @keyframes floatB {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(-6px, -14px); }
    }
    @keyframes floatC {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(-4px, 8px) rotate(-10deg); }
    }
    .anim-bounce { animation: bounceGentle 2.6s ease-in-out infinite; transform-origin: center; }
    .anim-float-a { animation: floatA 3.4s ease-in-out infinite; transform-origin: center; }
    .anim-float-b { animation: floatB 4s ease-in-out infinite; transform-origin: center; }
    .anim-float-c { animation: floatC 3.8s ease-in-out infinite; transform-origin: center; }
    @media (prefers-reduced-motion: reduce) {
      .anim-bounce, .anim-float-a, .anim-float-b, .anim-float-c { animation: none; }
    }
  `

  if (terkirim) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <style>{gayaAnimasi}</style>
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
      <style>{gayaAnimasi}</style>
      <div className="max-w-2xl mx-auto">
        {/* Hero semangat sekolah */}
        <div className="text-center mb-6">
          <div className="w-48 h-44 mx-auto mb-2">
            <IlustrasiSemangatSekolah />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950 tracking-tight">
            Ayo, Kita ke Sekolah!
          </h1>
          <p className="text-ink-700/70 mt-2 max-w-md mx-auto">
            Setiap langkah kecil hari ini adalah awal cerita besar esok hari. Yuk, daftarkan diri dan mulai petualangan belajarmu bersama kami!
          </p>
          {profil?.nama_sekolah && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full bg-ink-950 text-brass-400 text-sm font-medium">
              <School size={16} />
              {profil.nama_sekolah}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-4">
          <div>
            <label className="label-field">Nama Lengkap Calon Siswa *</label>
            <input required className="input-field" value={form.nama_lengkap} onChange={(e) => ubah('nama_lengkap', e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">NIK Siswa *</label>
              <input
                required
                className="input-field"
                placeholder="16 digit sesuai KK/KTP"
                inputMode="numeric"
                pattern="\d{16}"
                maxLength={16}
                value={form.nik_siswa}
                onChange={(e) => ubah('nik_siswa', e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="label-field">Nomor KK (Kartu Keluarga) *</label>
              <input
                required
                className="input-field"
                placeholder="16 digit sesuai Kartu Keluarga"
                inputMode="numeric"
                pattern="\d{16}"
                maxLength={16}
                value={form.nomor_kk}
                onChange={(e) => ubah('nomor_kk', e.target.value.replace(/\D/g, ''))}
              />
            </div>
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

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Jenis Kelamin</label>
              <select className="input-field" value={form.jenis_kelamin} onChange={(e) => ubah('jenis_kelamin', e.target.value)}>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="label-field">Agama</label>
              <select className="input-field" value={form.agama} onChange={(e) => ubah('agama', e.target.value)}>
                <option value="">— Pilih Agama —</option>
                {AGAMA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
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
            <label className="label-field">Alamat (sesuai KTP/KK)</label>
            <textarea className="input-field" rows={2} value={form.alamat} onChange={(e) => ubah('alamat', e.target.value)} />
          </div>

          <div>
            <label className="label-field">Alamat Tempat Tinggal (domisili saat ini)</label>
            <textarea className="input-field" rows={2} value={form.alamat_tinggal} onChange={(e) => ubah('alamat_tinggal', e.target.value)} />
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
