import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Plus, Trash2, X, Loader2, Upload, Download, CheckCircle2, AlertCircle, Pencil } from 'lucide-react'

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']
const emptyForm = { kelas_id: '', mata_pelajaran: '', guru_id: '', hari: 'Senin', jam_mulai: '', jam_selesai: '' }

// Regex validasi jam format HH:MM
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export default function Jadwal() {
  const [data, setData] = useState([])
  const [kelasList, setKelasList] = useState([])
  const [guruList, setGuruList] = useState([])
  const [filterKelas, setFilterKelas] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = mode tambah, isi id = mode edit

  // --- State untuk Import Massal ---
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importRows, setImportRows] = useState([]) // hasil parse + validasi
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null) // { success, failed }

  async function loadData() {
    setLoading(true)
    const [{ data: jadwal }, { data: kelas }, { data: guru }] = await Promise.all([
      supabase.from('jadwal').select('*, kelas(nama_kelas), guru(nama_lengkap)').order('hari').order('jam_mulai'),
      supabase.from('kelas').select('id, nama_kelas').order('nama_kelas'),
      supabase.from('guru').select('id, nama_lengkap').order('nama_lengkap'),
    ])
    setData(jadwal || [])
    setKelasList(kelas || [])
    setGuruList(guru || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, kelas_id: form.kelas_id || null, guru_id: form.guru_id || null }

    const { error } = editingId
      ? await supabase.from('jadwal').update(payload).eq('id', editingId)
      : await supabase.from('jadwal').insert(payload)

    setSaving(false)
    if (!error) {
      closeFormModal()
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  function handleEdit(j) {
    setForm({
      kelas_id: j.kelas_id || '',
      mata_pelajaran: j.mata_pelajaran || '',
      guru_id: j.guru_id || '',
      hari: j.hari,
      jam_mulai: j.jam_mulai?.slice(0, 5) || '',
      jam_selesai: j.jam_selesai?.slice(0, 5) || '',
    })
    setEditingId(j.id)
    setShowForm(true)
  }

  function closeFormModal() {
    setShowForm(false)
    setForm(emptyForm)
    setEditingId(null)
  }

  async function handleDelete(id) {
    if (!confirm('Hapus jadwal ini?')) return
    const { error } = await supabase.from('jadwal').delete().eq('id', id)
    if (!error) loadData()
  }

  const filtered = filterKelas ? data.filter((j) => j.kelas_id === filterKelas) : data

  // ================= IMPORT MASSAL =================

  function parseCSVLine(line) {
    // parser CSV sederhana yang tetap menghormati tanda kutip
    const result = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQuotes = !inQuotes; continue }
      if (c === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; continue }
      cur += c
    }
    result.push(cur.trim())
    return result
  }

  function buildPreview(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
    if (lines.length === 0) { setImportRows([]); return }

    // Deteksi & lewati baris header jika ada
    let startIdx = 0
    const firstCols = parseCSVLine(lines[0]).map((c) => c.toLowerCase())
    if (firstCols.includes('kelas') && firstCols.includes('hari')) startIdx = 1

    const rows = lines.slice(startIdx).map((line, idx) => {
      const cols = parseCSVLine(line)
      const [kelasNama, mapel, guruNama, hari, jamMulai, jamSelesai] = cols
      const errors = []

      const kelasMatch = kelasList.find((k) => k.nama_kelas?.toLowerCase() === (kelasNama || '').toLowerCase())
      if (!kelasNama) errors.push('Kelas kosong')
      else if (!kelasMatch) errors.push(`Kelas "${kelasNama}" tidak ditemukan`)

      if (!mapel) errors.push('Mata pelajaran kosong')

      const guruMatch = guruNama
        ? guruList.find((g) => g.nama_lengkap?.toLowerCase() === guruNama.toLowerCase())
        : null
      if (guruNama && !guruMatch) errors.push(`Guru "${guruNama}" tidak ditemukan`)

      const hariMatch = HARI.find((h) => h.toLowerCase() === (hari || '').toLowerCase())
      if (!hari) errors.push('Hari kosong')
      else if (!hariMatch) errors.push(`Hari "${hari}" tidak valid`)

      if (!jamMulai || !TIME_RE.test(jamMulai)) errors.push('Jam mulai tidak valid (format HH:MM)')
      if (!jamSelesai || !TIME_RE.test(jamSelesai)) errors.push('Jam selesai tidak valid (format HH:MM)')

      return {
        rowNumber: startIdx + idx + 1,
        raw: { kelasNama, mapel, guruNama, hari, jamMulai, jamSelesai },
        payload: errors.length === 0 ? {
          kelas_id: kelasMatch.id,
          mata_pelajaran: mapel,
          guru_id: guruMatch ? guruMatch.id : null,
          hari: hariMatch,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
        } : null,
        errors,
      }
    })

    setImportRows(rows)
  }

  function handleImportTextChange(e) {
    const text = e.target.value
    setImportText(text)
    buildPreview(text)
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      setImportText(text)
      buildPreview(text)
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const header = 'kelas,mata_pelajaran,guru,hari,jam_mulai,jam_selesai'
    const contoh = kelasList[0]
      ? `${kelasList[0].nama_kelas},Matematika,${guruList[0]?.nama_lengkap || ''},Senin,07:00,08:30`
      : 'Kelas 1A,Matematika,Nama Guru,Senin,07:00,08:30'
    const csv = `${header}\n${contoh}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_jadwal.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSubmit() {
    const validPayloads = importRows.filter((r) => r.errors.length === 0).map((r) => r.payload)
    if (validPayloads.length === 0) return

    setImporting(true)
    const { error } = await supabase.from('jadwal').insert(validPayloads)
    setImporting(false)

    if (error) {
      alert('Gagal mengimpor: ' + error.message)
      return
    }

    setImportResult({ success: validPayloads.length, failed: importRows.length - validPayloads.length })
    loadData()
  }

  function closeImportModal() {
    setShowImport(false)
    setImportText('')
    setImportRows([])
    setImportResult(null)
  }

  const validCount = importRows.filter((r) => r.errors.length === 0).length
  const invalidCount = importRows.length - validCount

  // ================= END IMPORT MASSAL =================

  return (
    <Layout title="Jadwal Pelajaran" subtitle="Susunan jam mengajar per kelas" actions={
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-[#6b0f1a] border border-[#6b0f1a]/20 hover:bg-[#6b0f1a]/5 transition-colors" onClick={() => setShowImport(true)}>
          <Upload size={16} /> Import Massal
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors shadow-sm shadow-[#6b0f1a]/30" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Jadwal
        </button>
      </div>
    }>
      <div className="min-h-screen bg-gradient-to-b from-[#fdf3f1] to-[#f7e6e3] -m-4 p-4 rounded-xl">
      <div className="bg-white rounded-xl border border-[#6b0f1a]/10 shadow-sm p-4 mb-4">
        <select className="max-w-xs px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
          <option value="">Semua Kelas</option>
          {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
        </select>
      </div>

      <div className="space-y-5">
        {HARI.map((hari) => {
          const items = filtered.filter((j) => j.hari === hari)
          if (items.length === 0) return null
          return (
            <div key={hari} className="bg-white rounded-xl border border-[#6b0f1a]/10 shadow-sm p-5">
              <h3 className="font-display text-base font-semibold mb-3 text-[#3b0a0a] flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-[#d4a017]"></span>
                {hari}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#6b0f1a] text-white">
                    <th className="text-left px-4 py-2.5 rounded-l-lg font-medium">Jam</th>
                    <th className="text-left px-4 py-2.5 font-medium">Kelas</th>
                    <th className="text-left px-4 py-2.5 font-medium">Mata Pelajaran</th>
                    <th className="text-left px-4 py-2.5 font-medium">Guru</th>
                    <th className="px-4 py-2.5 rounded-r-lg"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#6b0f1a]/8">
                  {items.map((j) => (
                    <tr key={j.id} className="hover:bg-[#6b0f1a]/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-[#6b0f1a]">{j.jam_mulai?.slice(0,5)} – {j.jam_selesai?.slice(0,5)}</td>
                      <td className="px-4 py-3">{j.kelas?.nama_kelas || '—'}</td>
                      <td className="px-4 py-3 font-medium text-[#3b0a0a]">{j.mata_pelajaran}</td>
                      <td className="px-4 py-3">{j.guru?.nama_lengkap || '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => handleEdit(j)} className="p-1.5 hover:bg-[#6b0f1a]/10 rounded-lg text-[#6b0f1a] mr-1"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(j.id)} className="p-1.5 hover:bg-[#6b0f1a]/10 rounded-lg text-[#8f1f22]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && <p className="text-sm text-[#6b0f1a]/50">Belum ada jadwal untuk ditampilkan.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3b0a0a]/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative border-t-4 border-[#6b0f1a]">
            <button type="button" onClick={closeFormModal} className="absolute top-4 right-4 text-[#6b0f1a]/40 hover:text-[#6b0f1a]"><X size={20} /></button>
            <h2 className="font-display text-xl font-semibold mb-4 text-[#3b0a0a]">{editingId ? 'Edit Jadwal' : 'Tambah Jadwal'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#6b0f1a]/70 uppercase tracking-wide mb-1.5 block">Kelas</label>
                <select required className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={form.kelas_id} onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}>
                  <option value="">Pilih kelas</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#6b0f1a]/70 uppercase tracking-wide mb-1.5 block">Mata Pelajaran</label>
                <input required className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={form.mata_pelajaran} onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#6b0f1a]/70 uppercase tracking-wide mb-1.5 block">Guru Pengajar</label>
                <select className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={form.guru_id} onChange={(e) => setForm({ ...form, guru_id: e.target.value })}>
                  <option value="">— Pilih guru —</option>
                  {guruList.map((g) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#6b0f1a]/70 uppercase tracking-wide mb-1.5 block">Hari</label>
                <select className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={form.hari} onChange={(e) => setForm({ ...form, hari: e.target.value })}>
                  {HARI.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#6b0f1a]/70 uppercase tracking-wide mb-1.5 block">Jam Mulai</label>
                  <input required type="time" className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b0f1a]/70 uppercase tracking-wide mb-1.5 block">Jam Selesai</label>
                  <input required type="time" className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f7e6e3] text-[#6b0f1a] hover:bg-[#efd3ce] transition-colors" onClick={closeFormModal}>Batal</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />} {editingId ? 'Update' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3b0a0a]/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 relative border-t-4 border-[#6b0f1a] max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={closeImportModal} className="absolute top-4 right-4 text-[#6b0f1a]/40 hover:text-[#6b0f1a]"><X size={20} /></button>
            <h2 className="font-display text-xl font-semibold mb-1 text-[#3b0a0a]">Import Jadwal Massal</h2>
            <p className="text-sm text-[#6b0f1a]/60 mb-4">Unggah file CSV atau tempel data langsung. Kolom: kelas, mata_pelajaran, guru, hari, jam_mulai, jam_selesai</p>

            {!importResult && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f7e6e3] text-[#6b0f1a] hover:bg-[#efd3ce] transition-colors cursor-pointer">
                    <Upload size={16} /> Pilih File CSV
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
                  </label>
                  <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-[#6b0f1a] border border-[#6b0f1a]/20 hover:bg-[#6b0f1a]/5 transition-colors">
                    <Download size={16} /> Unduh Template
                  </button>
                </div>

                <textarea
                  className="w-full h-32 px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors font-mono text-xs"
                  placeholder="kelas,mata_pelajaran,guru,hari,jam_mulai,jam_selesai&#10;Kelas 1A,Matematika,Budi Santoso,Senin,07:00,08:30"
                  value={importText}
                  onChange={handleImportTextChange}
                />

                {importRows.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-4 mb-2 text-sm">
                      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> {validCount} valid</span>
                      {invalidCount > 0 && <span className="inline-flex items-center gap-1 text-red-700"><AlertCircle size={14} /> {invalidCount} bermasalah</span>}
                    </div>
                    <div className="max-h-60 overflow-y-auto border border-[#6b0f1a]/10 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#6b0f1a] text-white">
                          <tr>
                            <th className="text-left px-3 py-2">#</th>
                            <th className="text-left px-3 py-2">Kelas</th>
                            <th className="text-left px-3 py-2">Mapel</th>
                            <th className="text-left px-3 py-2">Guru</th>
                            <th className="text-left px-3 py-2">Hari</th>
                            <th className="text-left px-3 py-2">Jam</th>
                            <th className="text-left px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#6b0f1a]/8">
                          {importRows.map((r) => (
                            <tr key={r.rowNumber} className={r.errors.length ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2">{r.rowNumber}</td>
                              <td className="px-3 py-2">{r.raw.kelasNama}</td>
                              <td className="px-3 py-2">{r.raw.mapel}</td>
                              <td className="px-3 py-2">{r.raw.guruNama || '—'}</td>
                              <td className="px-3 py-2">{r.raw.hari}</td>
                              <td className="px-3 py-2">{r.raw.jamMulai}–{r.raw.jamSelesai}</td>
                              <td className="px-3 py-2">
                                {r.errors.length === 0
                                  ? <span className="text-emerald-700">OK</span>
                                  : <span className="text-red-700">{r.errors.join('; ')}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f7e6e3] text-[#6b0f1a] hover:bg-[#efd3ce] transition-colors" onClick={closeImportModal}>Batal</button>
                  <button
                    type="button"
                    disabled={importing || validCount === 0}
                    onClick={handleImportSubmit}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors disabled:opacity-50"
                  >
                    {importing && <Loader2 size={16} className="animate-spin" />} Import {validCount > 0 ? `${validCount} Jadwal` : ''}
                  </button>
                </div>
              </>
            )}

            {importResult && (
              <div className="text-center py-8">
                <CheckCircle2 size={40} className="mx-auto text-emerald-600 mb-3" />
                <p className="font-medium text-[#3b0a0a]">Berhasil mengimpor {importResult.success} jadwal.</p>
                {importResult.failed > 0 && <p className="text-sm text-red-700 mt-1">{importResult.failed} baris dilewati karena tidak valid.</p>}
                <button type="button" onClick={closeImportModal} className="mt-5 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors">Tutup</button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </Layout>
  )
}
