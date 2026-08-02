import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import {
  FileBadge,
  Loader2,
  Save,
  Plus,
  Trash2,
  ClipboardList,
  Sparkles,
  Dumbbell,
  NotebookPen,
  Printer,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan Nilai', icon: ClipboardList },
  { key: 'capaian', label: 'Deskripsi Capaian', icon: NotebookPen },
  { key: 'p5', label: 'P5', icon: Sparkles },
  { key: 'ekskul', label: 'Ekstrakurikuler', icon: Dumbbell },
  { key: 'catatan', label: 'Catatan Wali Kelas', icon: NotebookPen },
]

const CATATAN_KOSONG = {
  id: null,
  catatan: '',
  tinggi_badan: '',
  berat_badan: '',
  kondisi_kesehatan: '',
  keputusan: '',
}

export default function Rapor() {
  const navigate = useNavigate()

  const [siswaList, setSiswaList] = useState([])
  const [siswaId, setSiswaId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Ringkasan (nilai angka + presensi) — tetap dari tabel nilai & presensi_siswa
  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })

  // Deskripsi capaian per mapel — tabel capaian_mapel
  const [capaianList, setCapaianList] = useState([]) // [{id, mata_pelajaran, deskripsi_capaian}]

  // P5 — tabel rapor_p5 (read-only di sini, isi dari halaman/tab lain jika ada)
  const [p5List, setP5List] = useState([])

  // Ekstrakurikuler — tabel ekstrakurikuler_nilai
  const [ekskulList, setEkskulList] = useState([]) // [{id, nama_ekstrakurikuler, predikat, keterangan}]

  // Catatan wali kelas — tabel catatan_siswa
  const [catatan, setCatatan] = useState(CATATAN_KOSONG)

  useEffect(() => {
    supabase
      .from('siswa')
      .select('id, nama_lengkap, nis, kelas(nama_kelas)')
      .order('nama_lengkap')
      .then(({ data }) => setSiswaList(data || []))
  }, [])

  async function muatRapor() {
    if (!siswaId || !tahunAjaran) return
    setLoading(true)

    const [
      { data: nilaiRows },
      { data: presensiRows },
      { data: capaianRows },
      { data: p5Rows },
      { data: ekskulRows },
      { data: catatanRows },
    ] = await Promise.all([
      supabase
        .from('nilai')
        .select('mata_pelajaran, jenis, nilai')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase.from('presensi_siswa').select('status').eq('siswa_id', siswaId),
      supabase
        .from('capaian_mapel')
        .select('id, mata_pelajaran, deskripsi_capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('rapor_p5')
        .select('id, tema, dimensi, sub_elemen, capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .order('tema'),
      supabase
        .from('ekstrakurikuler_nilai')
        .select('id, nama_ekstrakurikuler, predikat, keterangan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('catatan_siswa')
        .select('id, catatan, tinggi_badan, berat_badan, kondisi_kesehatan, keputusan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .maybeSingle(),
    ])

    setNilai(nilaiRows || [])
    const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const p of presensiRows || []) {
      if (rekap[p.status] !== undefined) rekap[p.status]++
    }
    setPresensi(rekap)

    setP5List(p5Rows || [])
    setEkskulList(ekskulRows || [])
    setCatatan(catatanRows || CATATAN_KOSONG)

    // Gabungkan mapel dari nilai dengan mapel yang sudah punya deskripsi capaian,
    // supaya guru bisa isi deskripsi walau belum ada nilai angkanya.
    const mapelDariNilai = [...new Set((nilaiRows || []).map((n) => n.mata_pelajaran))]
    const mapelDariCapaian = (capaianRows || []).map((c) => c.mata_pelajaran)
    const semuaMapel = [...new Set([...mapelDariNilai, ...mapelDariCapaian])]
    setCapaianList(
      semuaMapel.map((mapel) => {
        const existing = (capaianRows || []).find((c) => c.mata_pelajaran === mapel)
        return {
          id: existing?.id || null,
          mata_pelajaran: mapel,
          deskripsi_capaian: existing?.deskripsi_capaian || '',
        }
      })
    )

    setLoading(false)
  }

  const siswaTerpilih = siswaList.find((s) => s.id === siswaId)

  // ---------- Ringkasan nilai ----------
  const rekapPerMapel = {}
  for (const n of nilai) {
    if (!rekapPerMapel[n.mata_pelajaran]) rekapPerMapel[n.mata_pelajaran] = []
    rekapPerMapel[n.mata_pelajaran].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapel).map(([mapel, nilaiArr]) => ({
    mapel,
    rataRata: (nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length).toFixed(1),
  }))

  // ---------- Deskripsi capaian ----------
  function ubahDeskripsi(mapel, teks) {
    setCapaianList((prev) =>
      prev.map((c) => (c.mata_pelajaran === mapel ? { ...c, deskripsi_capaian: teks } : c))
    )
  }

  async function simpanCapaian() {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    for (const c of capaianList) {
      if (c.id) {
        await supabase
          .from('capaian_mapel')
          .update({ deskripsi_capaian: c.deskripsi_capaian, diisi_oleh: user?.id })
          .eq('id', c.id)
      } else if (c.deskripsi_capaian.trim()) {
        await supabase.from('capaian_mapel').insert({
          siswa_id: siswaId,
          mata_pelajaran: c.mata_pelajaran,
          semester,
          tahun_ajaran: tahunAjaran,
          deskripsi_capaian: c.deskripsi_capaian,
          diisi_oleh: user?.id,
        })
      }
    }
    await muatRapor()
    setSaving(false)
  }

  // ---------- Ekstrakurikuler ----------
  function tambahBarisEkskul() {
    setEkskulList((prev) => [
      ...prev,
      { id: null, nama_ekstrakurikuler: '', predikat: '', keterangan: '' },
    ])
  }

  function ubahBarisEkskul(index, field, value) {
    setEkskulList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  async function hapusBarisEkskul(index) {
    const row = ekskulList[index]
    if (row.id) {
      await supabase.from('ekstrakurikuler_nilai').delete().eq('id', row.id)
    }
    setEkskulList((prev) => prev.filter((_, i) => i !== index))
  }

  async function simpanEkskul() {
    setSaving(true)
    for (const row of ekskulList) {
      if (!row.nama_ekstrakurikuler.trim()) continue
      if (row.id) {
        await supabase
          .from('ekstrakurikuler_nilai')
          .update({
            nama_ekstrakurikuler: row.nama_ekstrakurikuler,
            predikat: row.predikat,
            keterangan: row.keterangan,
          })
          .eq('id', row.id)
      } else {
        await supabase.from('ekstrakurikuler_nilai').insert({
          siswa_id: siswaId,
          semester,
          tahun_ajaran: tahunAjaran,
          nama_ekstrakurikuler: row.nama_ekstrakurikuler,
          predikat: row.predikat,
          keterangan: row.keterangan,
        })
      }
    }
    await muatRapor()
    setSaving(false)
  }

  // ---------- Catatan wali kelas ----------
  function ubahCatatan(field, value) {
    setCatatan((prev) => ({ ...prev, [field]: value }))
  }

  async function simpanCatatan() {
    setSaving(true)
    const payload = {
      siswa_id: siswaId,
      semester,
      tahun_ajaran: tahunAjaran,
      catatan: catatan.catatan,
      tinggi_badan: catatan.tinggi_badan,
      berat_badan: catatan.berat_badan,
      kondisi_kesehatan: catatan.kondisi_kesehatan,
      keputusan: catatan.keputusan,
    }
    if (catatan.id) {
      await supabase.from('catatan_siswa').update(payload).eq('id', catatan.id)
    } else {
      await supabase.from('catatan_siswa').insert(payload)
    }
    await muatRapor()
    setSaving(false)
  }

  function bukaCetak() {
    if (!siswaId || !tahunAjaran) return
    const params = new URLSearchParams({ siswaId, semester, tahunAjaran })
    navigate(`/rapor/cetak?${params.toString()}`)
  }

  return (
    <Layout title="Rapor Siswa" subtitle="Kelola nilai, deskripsi capaian, P5, ekstrakurikuler & catatan wali kelas">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a0e0e] to-[#7a1515] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <FileBadge size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Rapor Siswa</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {siswaTerpilih
                ? `${siswaTerpilih.nama_lengkap} · ${siswaTerpilih.kelas?.nama_kelas || '-'} · Semester ${semester} ${tahunAjaran}`
                : 'Pilih siswa untuk lihat & isi rapor'}
            </p>
          </div>
        </div>
        <FileBadge size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label-field">Pilih Siswa</label>
            <select className="input-field" value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
              <option value="">-- Pilih siswa --</option>
              {siswaList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_lengkap} {s.kelas?.nama_kelas ? `(${s.kelas.nama_kelas})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Semester</label>
            <select className="input-field" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
          <div>
            <label className="label-field">Tahun Ajaran</label>
            <input
              className="input-field"
              placeholder="2025/2026"
              value={tahunAjaran}
              onChange={(e) => setTahunAjaran(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={muatRapor} disabled={!siswaId || !tahunAjaran || loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Tampilkan Rapor
          </button>
          {siswaTerpilih && (
            <button className="btn-secondary" onClick={bukaCetak}>
              <Printer size={16} /> Buka Halaman Cetak
            </button>
          )}
        </div>
      </div>

      {siswaTerpilih && (
        <div className="card p-0 overflow-hidden">
          <div className="flex flex-wrap border-b border-ink-950/10">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-[#7a1515] border-b-2 border-[#7a1515]'
                      : 'text-ink-700/60 hover:text-ink-950'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6">
            {activeTab === 'ringkasan' && (
              <>
                {barisMapel.length > 0 ? (
                  <table className="table-shell mb-6">
                    <thead>
                      <tr>
                        <th>Mata Pelajaran</th>
                        <th>Rata-rata Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barisMapel.map((b) => (
                        <tr key={b.mapel}>
                          <td className="font-medium">{b.mapel}</td>
                          <td>{b.rataRata}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-ink-700/50 mb-6">Belum ada data nilai untuk periode ini.</p>
                )}

                <h4 className="font-display font-semibold text-ink-950 mb-3">Rekap Kehadiran</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-sage-500/10 p-3 text-center">
                    <p className="text-2xl font-display font-semibold text-sage-500">{presensi.hadir}</p>
                    <p className="text-xs text-ink-700/60">Hadir</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                    <p className="text-2xl font-display font-semibold text-amber-600">{presensi.izin}</p>
                    <p className="text-xs text-ink-700/60">Izin</p>
                  </div>
                  <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                    <p className="text-2xl font-display font-semibold text-blue-600">{presensi.sakit}</p>
                    <p className="text-xs text-ink-700/60">Sakit</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-2xl font-display font-semibold text-red-700">{presensi.alpa}</p>
                    <p className="text-xs text-ink-700/60">Alpa</p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'capaian' && (
              <>
                {capaianList.length === 0 && (
                  <p className="text-sm text-ink-700/50 mb-4">
                    Belum ada mata pelajaran. Isi nilai di menu Nilai terlebih dahulu, atau tunggu data muncul di sini.
                  </p>
                )}
                <div className="space-y-4">
                  {capaianList.map((c) => (
                    <div key={c.mata_pelajaran}>
                      <label className="label-field">{c.mata_pelajaran}</label>
                      <textarea
                        className="input-field min-h-[80px]"
                        placeholder={`Deskripsi capaian pembelajaran untuk ${c.mata_pelajaran}...`}
                        value={c.deskripsi_capaian}
                        onChange={(e) => ubahDeskripsi(c.mata_pelajaran, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                {capaianList.length > 0 && (
                  <button className="btn-primary mt-5" onClick={simpanCapaian} disabled={saving}>
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    <Save size={16} /> Simpan Deskripsi Capaian
                  </button>
                )}
              </>
            )}

            {activeTab === 'p5' && (
              <>
                {p5List.length === 0 ? (
                  <p className="text-sm text-ink-700/50">Belum ada data P5 untuk periode ini.</p>
                ) : (
                  <table className="table-shell">
                    <thead>
                      <tr>
                        <th>Tema</th>
                        <th>Dimensi</th>
                        <th>Sub-elemen</th>
                        <th>Capaian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p5List.map((p) => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.tema}</td>
                          <td>{p.dimensi}</td>
                          <td>{p.sub_elemen}</td>
                          <td>{p.capaian}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {activeTab === 'ekskul' && (
              <>
                <div className="space-y-3">
                  {ekskulList.map((row, i) => (
                    <div key={row.id || `baru-${i}`} className="grid sm:grid-cols-[2fr_1fr_2fr_auto] gap-3 items-start">
                      <input
                        className="input-field"
                        placeholder="Nama ekstrakurikuler"
                        value={row.nama_ekstrakurikuler}
                        onChange={(e) => ubahBarisEkskul(i, 'nama_ekstrakurikuler', e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="Predikat"
                        value={row.predikat}
                        onChange={(e) => ubahBarisEkskul(i, 'predikat', e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="Keterangan"
                        value={row.keterangan}
                        onChange={(e) => ubahBarisEkskul(i, 'keterangan', e.target.value)}
                      />
                      <button
                        className="btn-secondary !px-3"
                        onClick={() => hapusBarisEkskul(i)}
                        title="Hapus baris"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="btn-secondary" onClick={tambahBarisEkskul}>
                    <Plus size={16} /> Tambah Baris
                  </button>
                  <button className="btn-primary" onClick={simpanEkskul} disabled={saving}>
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    <Save size={16} /> Simpan Ekstrakurikuler
                  </button>
                </div>
              </>
            )}

            {activeTab === 'catatan' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label-field">Tinggi Badan (cm)</label>
                    <input
                      className="input-field"
                      value={catatan.tinggi_badan}
                      onChange={(e) => ubahCatatan('tinggi_badan', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label-field">Berat Badan (kg)</label>
                    <input
                      className="input-field"
                      value={catatan.berat_badan}
                      onChange={(e) => ubahCatatan('berat_badan', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="label-field">Kondisi Kesehatan</label>
                  <input
                    className="input-field"
                    placeholder="mis. Baik / perlu perhatian pada..."
                    value={catatan.kondisi_kesehatan}
                    onChange={(e) => ubahCatatan('kondisi_kesehatan', e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="label-field">Keputusan</label>
                  <select
                    className="input-field"
                    value={catatan.keputusan}
                    onChange={(e) => ubahCatatan('keputusan', e.target.value)}
                  >
                    <option value="">-- Belum ditentukan --</option>
                    <option value="Naik Kelas">Naik Kelas</option>
                    <option value="Tinggal Kelas">Tinggal Kelas</option>
                    <option value="Lulus">Lulus</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="label-field">Catatan Wali Kelas</label>
                  <textarea
                    className="input-field min-h-[100px]"
                    placeholder="Catatan perkembangan siswa dari wali kelas..."
                    value={catatan.catatan}
                    onChange={(e) => ubahCatatan('catatan', e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={simpanCatatan} disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  <Save size={16} /> Simpan Catatan
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
