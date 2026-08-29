import { useEffect, useState } from 'react'
import Tesseract from 'tesseract.js'
import { supabase } from '../lib/supabaseClient'
import { Loader2, CheckCircle2, School, ScanLine, Sparkles } from 'lucide-react'

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Lainnya']

const METODE_SCAN_OPTIONS = [
  { value: 'tesseract', label: 'OCR Cepat', desc: 'Offline, gratis, cocok untuk foto KK yang jelas dan tidak miring' },
  { value: 'ai', label: 'AI Scan', desc: 'Lebih akurat untuk foto buram, miring, atau pencahayaan kurang baik' },
]

const emptyForm = {
  nama_lengkap: '',
  nik_siswa: '',
  nomor_kk: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  tahun_lahir: '',
  jenis_kelamin: 'L',
  agama: '',
  nama_ayah: '',
  nik_ayah: '',
  tahun_lahir_ayah: '',
  nama_ibu: '',
  nik_ibu: '',
  tahun_lahir_ibu: '',
  alamat: '',
  alamat_tinggal: '',
  no_hp_orang_tua: '',
  asal_sekolah: '',
}

// ---------------------------------------------------------------------
// Utilitas OCR: membaca teks dari foto Kartu Keluarga (KK) dengan
// Tesseract.js, lalu mencoba mengekstrak Nomor KK, Alamat, dan daftar
// anggota keluarga (Nama + NIK) dari teks hasil OCR.
//
// Catatan: OCR tidak pernah 100% akurat, apalagi untuk foto yang buram,
// miring, atau pencahayaan kurang baik. Karena itu, hasil ekstraksi ini
// HANYA dipakai untuk MENGISI OTOMATIS kolom form — semua kolom tetap
// bisa diedit manual oleh pengguna sebelum formulir dikirim.
// ---------------------------------------------------------------------
function parseTeksKK(rawText) {
  const text = rawText.replace(/\r/g, '')
  const baris = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // Nomor KK: 16 digit, biasanya muncul di baris dekat kata "No"
  let nomorKK = ''
  const kkDenganLabel = text.match(/No[^\d]{0,15}(\d{16})/i)
  if (kkDenganLabel) {
    nomorKK = kkDenganLabel[1]
  } else {
    const kkFallback = text.match(/\b(\d{16})\b/)
    if (kkFallback) nomorKK = kkFallback[1]
  }

  // Alamat: teks setelah kata "Alamat" sampai baris/label berikutnya
  let alamat = ''
  const alamatMatch = text.match(/Alamat\s*[:\-]?\s*(.+)/i)
  if (alamatMatch) {
    alamat = alamatMatch[1]
      .split(/\n|Kode Pos|RT\s*\/\s*RW|Desa|Kelurahan|Kecamatan/i)[0]
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Anggota keluarga: cari baris yang mengandung deretan 16 digit (NIK),
  // lalu ambil sisa teks di baris yang sama sebagai perkiraan nama.
  const anggota = []
  const nikRegex = /(\d{16})/
  baris.forEach((line) => {
    const m = line.match(nikRegex)
    if (!m) return
    const nik = m[1]
    if (nik === nomorKK) return // lewati jika ini nomor KK, bukan NIK individu

    let nama = line
      .replace(nik, '')
      .replace(/[^A-Za-z.'\- ]/g, ' ')
      .replace(/\b(NIK|Nama|Lengkap|No)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    anggota.push({ nik, nama: nama || '(nama tidak terbaca, mohon isi manual)' })
  })

  return { nomorKK, alamat, anggota }
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

  // --- State untuk fitur OCR Kartu Keluarga ---
  const [kkPreviewUrl, setKkPreviewUrl] = useState('')
  const [metodeScan, setMetodeScan] = useState('tesseract')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrError, setOcrError] = useState('')
  const [anggotaTerdeteksi, setAnggotaTerdeteksi] = useState([])

  useEffect(() => {
    supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle().then(({ data }) => setProfil(data))
  }, [])

  useEffect(() => {
    // Bersihkan object URL preview saat komponen unmount / gambar diganti
    return () => {
      if (kkPreviewUrl) URL.revokeObjectURL(kkPreviewUrl)
    }
  }, [kkPreviewUrl])

  // --- Metode 1: OCR lokal dengan Tesseract (fitur lama, tidak diubah) ---
  async function scanKKDenganTesseract(file) {
    const { data: { text } } = await Tesseract.recognize(file, 'ind', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setOcrProgress(Math.round(m.progress * 100))
        }
      },
    })
    const hasil = parseTeksKK(text)
    return { nomorKK: hasil.nomorKK, alamat: hasil.alamat, anggota: hasil.anggota, peringatan: null }
  }

  // --- Metode 2 (baru): AI Scan via backend endpoint yang memanggil Gemini ---
  // Endpoint ini sudah mengembalikan data terstruktur (bukan teks polos),
  // jadi tidak perlu parseTeksKK di sini.
  async function scanKKDenganAI(file) {
    setOcrProgress(0)
    const base64 = await fileToBase64(file)

    const res = await fetch('/api/ai-scan-kk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType: file.type }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const pesan = data?.error || `Server AI Scan gagal (${res.status}).`
      throw new Error(res.status === 503 ? `${pesan} Coba pakai OCR Cepat sementara, atau ulangi beberapa saat lagi.` : pesan)
    }

    const data = await res.json()
    return {
      nomorKK: data.nomor_kk || '',
      alamat: data.alamat || '',
      anggota: (data.anggota || []).map((a) => ({ nama: a.nama, nik: a.nik, statusHubungan: a.status_hubungan })),
      peringatan: data.peringatan || null,
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1]) // buang prefix data:...;base64,
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'))
      reader.readAsDataURL(file)
    })
  }

  async function handleUploadKK(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setKkPreviewUrl(URL.createObjectURL(file))
    setOcrError('')
    setAnggotaTerdeteksi([])
    setOcrLoading(true)
    setOcrProgress(0)

    try {
      const hasil =
        metodeScan === 'ai' ? await scanKKDenganAI(file) : await scanKKDenganTesseract(file)

      setForm((prev) => ({
        ...prev,
        nomor_kk: hasil.nomorKK || prev.nomor_kk,
        alamat: hasil.alamat || prev.alamat,
      }))
      setAnggotaTerdeteksi(hasil.anggota)

      if (hasil.peringatan) {
        setOcrError(hasil.peringatan)
      } else if (!hasil.nomorKK && hasil.anggota.length === 0) {
        setOcrError('Teks pada foto tidak terbaca dengan baik. Coba unggah foto yang lebih jelas dan terang, atau isi kolom secara manual.')
      }
    } catch (err) {
      setOcrError('Gagal membaca gambar: ' + err.message)
    } finally {
      setOcrLoading(false)
    }
  }

  function terapkanAnggota(anggota, target) {
    if (target === 'siswa') {
      setForm((prev) => ({ ...prev, nama_lengkap: anggota.nama, nik_siswa: anggota.nik }))
    } else if (target === 'ayah') {
      setForm((prev) => ({ ...prev, nama_ayah: anggota.nama, nik_ayah: anggota.nik }))
    } else if (target === 'ibu') {
      setForm((prev) => ({ ...prev, nama_ibu: anggota.nama, nik_ibu: anggota.nik }))
    }
  }

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
    const payload = {
      ...form,
      tahun_lahir: form.tahun_lahir ? Number(form.tahun_lahir) : null,
      tahun_lahir_ayah: form.tahun_lahir_ayah ? Number(form.tahun_lahir_ayah) : null,
      tahun_lahir_ibu: form.tahun_lahir_ibu ? Number(form.tahun_lahir_ibu) : null,
    }
    const { error: err } = await supabase.from('ppdb_pendaftar').insert(payload)
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

          {/* --- Blok Upload & OCR Kartu Keluarga --- */}
          <div className="rounded-xl border border-dashed border-ink-950/15 bg-paper/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ScanLine size={18} className="text-brass-500" />
              <p className="text-sm font-semibold text-ink-950">Isi Otomatis dari Foto Kartu Keluarga (opsional)</p>
            </div>
            <p className="text-xs text-ink-700/60">
              Unggah foto/scan KK yang jelas dan tidak buram. Sistem akan membaca teksnya dan mencoba mengisi Nomor KK, Alamat, dan data anggota keluarga secara otomatis. <strong>Selalu periksa kembali</strong> hasilnya sebelum mengirim formulir.
            </p>

            {/* Pilihan metode scan (baru) */}
            <div className="grid sm:grid-cols-2 gap-2">
              {METODE_SCAN_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMetodeScan(m.value)}
                  className={`text-left rounded-lg border p-2.5 transition ${
                    metodeScan === m.value
                      ? 'border-ink-950 bg-ink-950/5'
                      : 'border-ink-950/10 hover:border-ink-950/25'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-950">
                    {m.value === 'ai' && <Sparkles size={12} className="text-brass-500" />}
                    {m.label}
                  </span>
                  <span className="block text-[11px] text-ink-700/60 mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={handleUploadKK}
              className="block w-full text-sm text-ink-700/80 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-ink-950 file:text-white file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
            />

            {kkPreviewUrl && (
              <img src={kkPreviewUrl} alt="Pratinjau foto KK" className="max-h-40 rounded-lg border border-ink-950/10 object-contain" />
            )}

            {ocrLoading && (
              <div className="flex items-center gap-2 text-sm text-ink-700/70">
                <Loader2 size={16} className="animate-spin" />
                {metodeScan === 'ai'
                  ? 'Membaca dokumen dengan AI...'
                  : `Membaca dokumen... ${ocrProgress}%`}
              </div>
            )}

            {ocrError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{ocrError}</p>}

            {anggotaTerdeteksi.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-950">Anggota keluarga terdeteksi — klik untuk mengisi kolom terkait:</p>
                {anggotaTerdeteksi.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg border border-ink-950/10 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{a.nama}</span>
                      <span className="text-ink-700/60"> — NIK {a.nik || '(tidak terbaca)'}</span>
                      {a.statusHubungan && <span className="text-ink-700/40"> · {a.statusHubungan}</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => terapkanAnggota(a, 'siswa')} className="px-2 py-1 rounded-md bg-sage-500/10 text-sage-700 text-xs font-medium hover:bg-sage-500/20">
                        Isi sbg Siswa
                      </button>
                      <button type="button" onClick={() => terapkanAnggota(a, 'ayah')} className="px-2 py-1 rounded-md bg-brass-500/10 text-brass-700 text-xs font-medium hover:bg-brass-500/20">
                        Isi sbg Ayah
                      </button>
                      <button type="button" onClick={() => terapkanAnggota(a, 'ibu')} className="px-2 py-1 rounded-md bg-ink-950/5 text-ink-950 text-xs font-medium hover:bg-ink-950/10">
                        Isi sbg Ibu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
          <div>
            <label className="label-field">Tahun Lahir (isi jika tanggal pasti tidak diketahui)</label>
            <input
              type="number"
              placeholder="Contoh: 2019"
              className="input-field"
              value={form.tahun_lahir}
              onChange={(e) => ubah('tahun_lahir', e.target.value)}
            />
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
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label-field">Nama Ayah</label>
              <input className="input-field" value={form.nama_ayah} onChange={(e) => ubah('nama_ayah', e.target.value)} />
            </div>
            <div>
              <label className="label-field">NIK Ayah</label>
              <input
                className="input-field"
                placeholder="16 digit"
                inputMode="numeric"
                maxLength={16}
                value={form.nik_ayah}
                onChange={(e) => ubah('nik_ayah', e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="label-field">Tahun Lahir Ayah</label>
              <input
                type="number"
                placeholder="Contoh: 1988"
                className="input-field"
                value={form.tahun_lahir_ayah}
                onChange={(e) => ubah('tahun_lahir_ayah', e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label-field">Nama Ibu</label>
              <input className="input-field" value={form.nama_ibu} onChange={(e) => ubah('nama_ibu', e.target.value)} />
            </div>
            <div>
              <label className="label-field">NIK Ibu</label>
              <input
                className="input-field"
                placeholder="16 digit"
                inputMode="numeric"
                maxLength={16}
                value={form.nik_ibu}
                onChange={(e) => ubah('nik_ibu', e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="label-field">Tahun Lahir Ibu</label>
              <input
                type="number"
                placeholder="Contoh: 1990"
                className="input-field"
                value={form.tahun_lahir_ibu}
                onChange={(e) => ubah('tahun_lahir_ibu', e.target.value)}
              />
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
