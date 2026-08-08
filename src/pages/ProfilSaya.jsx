import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import GrafikAktivitas from '../components/GrafikAktivitas'
import { Camera, Loader2, Save, Users, School } from 'lucide-react'
// ASUMSI: menggunakan library `react-barcode` untuk membuat kode batang (linear barcode) di sisi klien.
// Install dulu kalau belum ada: npm install react-barcode
import Barcode from 'react-barcode'
// Menggunakan library `qrcode` (sudah ada di package.json) untuk membuat QR code sebagai data URL PNG.
import QRCode from 'qrcode'

export default function ProfilSaya() {
  const { profil } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  // Kelas & siswa yang diampu (sebagai wali kelas)
  const [kelasAsuh, setKelasAsuh] = useState([]) // [{ id, nama_kelas, siswa: [...] }]
  const [loadingSiswa, setLoadingSiswa] = useState(true)

  // QR code identitas guru (dibuat dari qrcode -> data URL PNG)
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    async function load() {
      if (!profil?.guru_id) {
        setLoading(false)
        setLoadingSiswa(false)
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

  useEffect(() => {
    async function loadSiswaAsuh() {
      if (!profil?.guru_id) {
        setLoadingSiswa(false)
        return
      }
      setLoadingSiswa(true)

      const { data: kelasList } = await supabase
        .from('kelas')
        .select('id, nama_kelas, tingkat')
        .eq('wali_kelas_id', profil.guru_id)
        .order('nama_kelas')

      if (!kelasList || kelasList.length === 0) {
        setKelasAsuh([])
        setLoadingSiswa(false)
        return
      }

      const kelasIds = kelasList.map((k) => k.id)
      const { data: siswaList } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nis, foto_path, kelas_id, status')
        .in('kelas_id', kelasIds)
        .eq('status', 'aktif')
        .order('nama_lengkap')

      const gabung = kelasList.map((k) => ({
        ...k,
        siswa: (siswaList || []).filter((s) => s.kelas_id === k.id),
      }))
      setKelasAsuh(gabung)
      setLoadingSiswa(false)
    }
    loadSiswaAsuh()
  }, [profil])

  // Buat QR code setiap kali id guru berubah/tersedia
  useEffect(() => {
    if (!data?.id) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(String(data.id), {
      width: 144,
      margin: 1,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [data?.id])

  function fotoUrl() {
    if (!data?.foto_profil_path) return null
    return supabase.storage.from('foto-profil').getPublicUrl(data.foto_profil_path).data.publicUrl
  }

  function fotoSiswaUrl(path) {
    if (!path) return null
    return supabase.storage.from('foto-siswa').getPublicUrl(path).data.publicUrl
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

  const totalSiswaAsuh = kelasAsuh.reduce((sum, k) => sum + k.siswa.length, 0)

  return (
    <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
      <form onSubmit={handleSave} className="max-w-2xl space-y-5">
        {/* Kartu identitas — background biru tua (navy), kontras elegan dengan aksen emas */}
        <div className="relative overflow-hidden rounded-xl p-6 flex items-center justify-between gap-5 bg-gradient-to-br from-blue-900 to-blue-950">
          {/* Dekorasi lingkaran samar di background, senada dengan aksen bulat di identitas guru */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          {/* Corak batik abstrak emas — motif kawung/parang disederhanakan, ditumpuk tipis di atas gradasi navy */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="batikEmas"
                x="0"
                y="0"
                width="72"
                height="72"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(8)"
              >
                {/* motif kawung: empat lengkung elips mengelilingi titik pusat */}
                <g fill="none" stroke="#d4af37" strokeWidth="1.1">
                  <ellipse cx="36" cy="24" rx="9" ry="14" opacity="0.55" />
                  <ellipse cx="36" cy="48" rx="9" ry="14" opacity="0.55" />
                  <ellipse cx="24" cy="36" rx="14" ry="9" opacity="0.55" />
                  <ellipse cx="48" cy="36" rx="14" ry="9" opacity="0.55" />
                  <circle cx="36" cy="36" r="3" opacity="0.7" />
                </g>
                {/* garis parang halus di sela-sela motif kawung */}
                <path
                  d="M0 72 L18 54 L36 72 L54 54 L72 72"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.8"
                  opacity="0.35"
                />
                <path
                  d="M0 0 L18 18 L0 36"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.8"
                  opacity="0.3"
                />
                <circle cx="8" cy="8" r="1.3" fill="#d4af37" opacity="0.4" />
                <circle cx="64" cy="16" r="1.3" fill="#d4af37" opacity="0.4" />
                <circle cx="16" cy="64" r="1.3" fill="#d4af37" opacity="0.4" />
              </pattern>
              <linearGradient id="batikFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#batikEmas)" />
            <rect x="0" y="0" width="100%" height="100%" fill="url(#batikFade)" />
          </svg>

          <div className="relative flex items-center gap-5 min-w-0">
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
            <div className="min-w-0">
              <p className="font-display font-semibold text-lg text-white truncate">{data.nama_lengkap}</p>
              <p className="text-sm text-blue-200/70">{data.nip ? `NIP ${data.nip}` : 'NIP belum diisi'}</p>
            </div>
          </div>

          {/* QR code — berseberangan (sisi kanan) dengan foto profil di sisi kiri */}
          <div className="relative shrink-0 w-[88px] h-[88px] p-2 rounded-lg bg-white shadow-md flex items-center justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code identitas guru" width={72} height={72} />
            ) : (
              <Loader2 size={18} className="animate-spin text-ink-700/30" />
            )}
          </div>
        </div>

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

      {/* Siswa yang diampu — hanya muncul kalau guru ini tercatat sebagai wali kelas di satu atau lebih kelas */}
      {!loadingSiswa && kelasAsuh.length > 0 && (
        <div className="max-w-2xl mt-5 space-y-4">
          <div className="relative overflow-hidden rounded-xl p-6 flex items-center gap-4 bg-gradient-to-br from-red-900 to-red-950">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0 text-white">
              <Users size={20} />
            </div>
            <div className="relative">
              <p className="font-display font-semibold text-lg text-white">
                {totalSiswaAsuh} siswa diampu
              </p>
              <p className="text-sm text-red-200/70 mt-0.5">
                Sebagai wali kelas di {kelasAsuh.length} kelas: {kelasAsuh.map((k) => k.nama_kelas).join(', ')}
              </p>
            </div>
          </div>

          {kelasAsuh.map((k) => (
            <div key={k.id} className="card relative overflow-hidden">
              <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 to-brass-400" />
              <div className="flex items-center gap-2 p-4 border-b border-ink-900/[0.06]">
                <School size={16} className="text-ink-700/50" />
                <p className="text-sm font-medium text-ink-950">
                  {k.nama_kelas} <span className="text-ink-700/40 font-normal">({k.siswa.length} siswa)</span>
                </p>
              </div>
              {k.siswa.length === 0 ? (
                <p className="text-sm text-ink-700/50 p-4">Belum ada siswa aktif di kelas ini.</p>
              ) : (
                <ul className="divide-y divide-ink-900/[0.06]">
                  {k.siswa.map((s) => (
                    <li key={s.id} className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-ink-900/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                        {fotoSiswaUrl(s.foto_path) ? (
                          <img src={fotoSiswaUrl(s.foto_path)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-ink-700/40">{s.nama_lengkap?.[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-950 truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-ink-700/50">NIS: {s.nis || '—'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Kode batang ID guru — jadi pemisah visual antara bagian profil dan grafik aktivitas */}
      <div className="max-w-2xl mt-5 flex flex-col items-center gap-2 py-4 border-t border-ink-900/[0.08]">
        <div className="p-3 rounded-lg bg-white ring-1 ring-ink-900/[0.08] shadow-sm">
          <Barcode
            value={String(data.id)}
            width={1.6}
            height={56}
            fontSize={12}
            background="#ffffff"
            lineColor="#1e3a5f"
          />
        </div>
        <p className="text-xs text-ink-700/50">ID Absensi Guru</p>
      </div>

      <div className="max-w-2xl mt-5">
        <GrafikAktivitas guruId={profil.guru_id} />
      </div>
    </Layout>
  )
}
