import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Upload, Loader2, Trash2, Database, ChevronDown, ChevronUp } from 'lucide-react'

export default function BankSoal() {
  const { profil, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [mapelFilter, setMapelFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  const [deletingMapel, setDeletingMapel] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('bank_soal').select('*').order('mata_pelajaran').order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Nama file soal biasanya mengandung info kelas & mapel, contoh:
  // "soal_BAHASA_INDONESIA_KLS6_SMT1.xlsx" -> mata_pelajaran: "Bahasa Indonesia", kelas: "6"
  // Dipakai sebagai fallback kalau file Excel tidak punya kolom kelas/mata_pelajaran sendiri.
  function tebakDariNamaFile(filename) {
    const base = filename.replace(/\.[^/.]+$/, '') // buang ekstensi
    const tanpaPrefix = base.replace(/^soal[_\-\s]*/i, '')
    const kelasMatch = tanpaPrefix.match(/kls[_\-\s]*([0-9]+)/i)
    const kelas = kelasMatch ? kelasMatch[1] : ''

    let bagianMapel = kelasMatch ? tanpaPrefix.slice(0, kelasMatch.index) : tanpaPrefix
    // buang bagian semester kalau ada (misal "_SMT1") yang mungkin ikut kepotong di depan kelas
    bagianMapel = bagianMapel.replace(/[_\-\s]*smt[_\-\s]*[0-9]+/i, '')
    bagianMapel = bagianMapel.replace(/[_\-]+/g, ' ').trim()

    const mata_pelajaran = bagianMapel
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    return { kelas, mata_pelajaran }
  }

  // Ambil satu file Excel: kelas & mata pelajaran diambil dari kolom di file kalau ada,
  // kalau tidak ada kolomnya, ditebak dari nama file (lihat tebakDariNamaFile).
  // Mendukung banyak file sekaligus (upload massal).
  async function parseFile(file) {
    const soalRows = []
    const gagal = [] // { file, baris, alasan }
    const dariNamaFile = tebakDariNamaFile(file.name)

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)

    rows.forEach((r, idx) => {
      const baris = idx + 2 // baris 1 = header, data mulai baris 2 di Excel

      const kelas = String(r.kelas || r.Kelas || r.KELAS || dariNamaFile.kelas || '').trim()
      const mata_pelajaran = String(
        r.mata_pelajaran || r['Mata Pelajaran'] || r.mapel || r.Mapel || r.MAPEL || dariNamaFile.mata_pelajaran || ''
      ).trim()
      const soal = String(r.soal || r.Soal || '').trim()
      const pilihan_a = String(r.pilihan_a || r['Pilihan A'] || r.pilihan_A || '').trim()
      const pilihan_b = String(r.pilihan_b || r['Pilihan B'] || r.pilihan_B || '').trim()
      const pilihan_c = String(r.pilihan_c || r['Pilihan C'] || r.pilihan_C || '').trim()
      const pilihan_d = String(r.pilihan_d || r['Pilihan D'] || r.pilihan_D || '').trim()
      const jawaban_benar = String(r.jawaban_benar || r['Jawaban Benar'] || r.jawaban || '').trim().toUpperCase()

      // Lewati baris yang memang kosong total (bukan error, cuma baris kosong di Excel).
      // Kelas/mapel tidak dihitung di sini karena bisa terisi otomatis dari nama file.
      const semuaKosong = !soal && !pilihan_a && !pilihan_b && !pilihan_c && !pilihan_d && !jawaban_benar
      if (semuaKosong) return

      const alasanBaris = []
      if (!kelas) alasanBaris.push('kelas kosong (tidak ada kolom "kelas" & tidak terbaca dari nama file, contoh nama file yang benar: soal_BAHASA_INDONESIA_KLS6_SMT1.xlsx)')
      if (!mata_pelajaran) alasanBaris.push('mata pelajaran kosong (tidak ada kolom "mata_pelajaran" & tidak terbaca dari nama file)')
      if (!soal) alasanBaris.push('kolom "soal" kosong')
      if (!pilihan_a) alasanBaris.push('pilihan_a kosong')
      if (!pilihan_b) alasanBaris.push('pilihan_b kosong')
      if (!pilihan_c) alasanBaris.push('pilihan_c kosong')
      if (!pilihan_d) alasanBaris.push('pilihan_d kosong')
      if (!['A', 'B', 'C', 'D'].includes(jawaban_benar)) {
        alasanBaris.push(`jawaban_benar harus A/B/C/D (terbaca: "${jawaban_benar || '-'}")`)
      }

      if (alasanBaris.length > 0) {
        gagal.push({ file: file.name, baris, alasan: alasanBaris.join(', ') })
        return
      }

      soalRows.push({
        kelas,
        mata_pelajaran,
        soal,
        pilihan_a,
        pilihan_b,
        pilihan_c,
        pilihan_d,
        jawaban_benar,
        guru_id: profil.guru_id,
      })
    })

    return { soalRows, gagal }
  }

  // Upload massal: proses semua file Excel yang dipilih sekaligus.
  // Kelas & mata pelajaran tiap soal diambil dari isi file, bukan dari input form.
  async function handleUploadFiles(fileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setUploading(true)
    let semuaSoal = []
    let semuaGagal = []
    const gagalBaca = [] // file yang gagal dibaca sama sekali

    for (const file of files) {
      try {
        const { soalRows, gagal } = await parseFile(file)
        semuaSoal = semuaSoal.concat(soalRows)
        semuaGagal = semuaGagal.concat(gagal)
      } catch (err) {
        gagalBaca.push(`${file.name}: ${err.message}`)
      }
    }

    if (semuaSoal.length === 0) {
      const detailGagal = semuaGagal.length > 0
        ? '\n\nDetail baris gagal:\n' + semuaGagal.map((g) => `${g.file} baris ${g.baris}: ${g.alasan}`).join('\n')
        : ''
      const detailGagalBaca = gagalBaca.length > 0
        ? '\n\nFile gagal dibaca:\n' + gagalBaca.join('\n')
        : ''
      alert(
        'Tidak ada soal valid ditemukan. Pastikan kolom Excel: soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar (isi A/B/C/D). Kelas & mata pelajaran diambil dari kolom kelas/mata_pelajaran (kalau ada) atau ditebak dari nama file (contoh: soal_BAHASA_INDONESIA_KLS6_SMT1.xlsx).' +
        detailGagal + detailGagalBaca
      )
      setUploading(false)
      return
    }

    const { error } = await supabase.from('bank_soal').insert(semuaSoal)
    if (error) {
      alert('Gagal menyimpan soal: ' + error.message)
    } else {
      let pesan = `${semuaSoal.length} soal berhasil ditambahkan dari ${files.length} file.`
      if (semuaGagal.length > 0) {
        pesan += `\n\n${semuaGagal.length} baris ditolak dan TIDAK ikut diupload:\n` +
          semuaGagal.map((g) => `${g.file} baris ${g.baris}: ${g.alasan}`).join('\n')
      }
      if (gagalBaca.length > 0) {
        pesan += `\n\nFile gagal dibaca:\n` + gagalBaca.join('\n')
      }
      alert(pesan)
      await load()
    }
    setUploading(false)
  }

  async function handleDelete(item) {
    if (!confirm('Hapus soal ini dari Bank Soal?')) return
    const { error } = await supabase.from('bank_soal').delete().eq('id', item.id)
    if (error) alert('Gagal menghapus: ' + error.message)
    await load()
  }

  // Hapus seluruh soal dalam satu folder (kelas + mata pelajaran) sekaligus.
  // Kalau ada soal milik guru lain yang tidak boleh dihapus user ini (bukan admin),
  // soal tersebut dilewati dan user diberi tahu jumlahnya sebelum konfirmasi.
  async function handleDeleteMapel(label, soalFolder) {
    const idsBolehHapus = soalFolder.filter(canDelete).map((item) => item.id)

    if (idsBolehHapus.length === 0) {
      alert(`Tidak ada soal yang bisa Anda hapus di "${label}".`)
      return
    }

    const semuaBisaDihapus = idsBolehHapus.length === soalFolder.length
    const pesanKonfirmasi = semuaBisaDihapus
      ? `Hapus seluruh ${idsBolehHapus.length} soal pada "${label}"? Tindakan ini tidak bisa dibatalkan.`
      : `Anda hanya bisa menghapus ${idsBolehHapus.length} dari ${soalFolder.length} soal di "${label}" (sisanya milik guru lain). Lanjutkan menghapus yang bisa dihapus?`

    if (!confirm(pesanKonfirmasi)) return

    setDeletingMapel(label)
    const { error } = await supabase.from('bank_soal').delete().in('id', idsBolehHapus)
    setDeletingMapel('')

    if (error) {
      alert('Gagal menghapus folder: ' + error.message)
    }
    await load()
  }

  const canDelete = (item) => isAdmin || item.guru_id === profil?.guru_id

  // Folder dikelompokkan per Kelas + Mata Pelajaran supaya nama kelasnya selalu terlihat,
  // bukan cuma dikelompokkan per mata pelajaran saja.
  const grouped = items.reduce((acc, item) => {
    const key = `${item.kelas || '-'}||${item.mata_pelajaran}`
    if (!acc[key]) acc[key] = { kelas: item.kelas || '-', mata_pelajaran: item.mata_pelajaran, soal: [] }
    acc[key].soal.push(item)
    return acc
  }, {})

  const groupList = Object.values(grouped).sort((a, b) => {
    return a.mata_pelajaran.localeCompare(b.mata_pelajaran) || String(a.kelas).localeCompare(String(b.kelas), 'id', { numeric: true })
  })

  const mapelList = [...new Set(items.map((item) => item.mata_pelajaran))].sort()
  const groupTampil = mapelFilter ? groupList.filter((g) => g.mata_pelajaran === mapelFilter) : groupList

  return (
    <Layout title="Bank Soal" subtitle="Kumpulan soal tersimpan, siap dipakai ulang untuk Ujian Online">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Database size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Bank Soal</p>
            <p className="text-sm text-paper/70 mt-0.5">{items.length} soal tersimpan · {mapelList.length} mata pelajaran</p>
          </div>
        </div>
        <Database size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-6 mb-6 space-y-3">
        <h3 className="font-display text-lg font-semibold mb-1">Upload Soal Baru</h3>
        <div>
          <label className="eyebrow mb-1.5 block">File Excel (bisa pilih banyak file sekaligus)</label>
          <input
            className="input-field"
            type="file"
            accept=".xlsx,.xls"
            multiple
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files?.length) handleUploadFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        {uploading && <p className="text-xs text-ink-700/50 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Mengunggah...</p>}
        <p className="text-xs text-ink-700/40">
          Kolom Excel yang wajib: <code>soal</code>, <code>pilihan_a</code>, <code>pilihan_b</code>, <code>pilihan_c</code>, <code>pilihan_d</code>, <code>jawaban_benar</code> (isi A/B/C/D). Kelas & mata pelajaran otomatis diambil dari kolom <code>kelas</code>/<code>mata_pelajaran</code> kalau ada di file — kalau tidak ada, akan dibaca dari <b>nama file</b>, contoh: <code>soal_BAHASA_INDONESIA_KLS6_SMT1.xlsx</code> → mapel "Bahasa Indonesia", kelas "6". Bisa pilih beberapa file berbeda kelas/mapel sekaligus.
        </p>
      </div>

      {mapelList.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setMapelFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!mapelFilter ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.06] text-ink-700'}`}
          >
            Semua
          </button>
          {mapelList.map((m) => (
            <button
              key={m}
              onClick={() => setMapelFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mapelFilter === m ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.06] text-ink-700'}`}
            >
              {m} ({items.filter((item) => item.mata_pelajaran === m).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-700/50">Memuat...</p>
      ) : items.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-ink-700/50">Belum ada soal di Bank Soal. Upload lewat form di atas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupTampil.map((grup) => {
            const key = `${grup.kelas}||${grup.mata_pelajaran}`
            const label = `${grup.mata_pelajaran} · Kelas ${grup.kelas}`
            const isOpen = expanded[key]
            const soalFolder = grup.soal
            const adaYangBolehDihapus = soalFolder.some(canDelete)
            const sedangHapusFolder = deletingMapel === label
            return (
              <div key={key} className="card overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 gap-3">
                  <button
                    onClick={() => setExpanded({ ...expanded, [key]: !isOpen })}
                    className="flex-1 flex items-center justify-between min-w-0"
                  >
                    <p className="text-sm font-medium text-ink-950">
                      {grup.mata_pelajaran} <span className="text-brass-500 font-semibold">· Kelas {grup.kelas}</span>{' '}
                      <span className="text-ink-700/40 font-normal">({soalFolder.length} soal)</span>
                    </p>
                    {isOpen ? <ChevronUp size={16} className="text-ink-700/50 shrink-0" /> : <ChevronDown size={16} className="text-ink-700/50 shrink-0" />}
                  </button>
                  {adaYangBolehDihapus && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteMapel(label, soalFolder)
                      }}
                      disabled={sedangHapusFolder}
                      title={`Hapus seluruh soal ${label}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-50"
                    >
                      {sedangHapusFolder ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
                {isOpen && (
                  <ul className="divide-y divide-ink-900/[0.06] border-t border-ink-900/[0.06]">
                    {soalFolder.map((item, i) => (
                      <li key={item.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-ink-900">{i + 1}. {item.soal}</p>
                          <p className="text-xs text-ink-700/40 mt-1">Jawaban benar: {item.jawaban_benar}</p>
                        </div>
                        {canDelete(item) && (
                          <button
                            onClick={() => handleDelete(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
