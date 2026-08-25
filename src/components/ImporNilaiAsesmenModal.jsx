// src/components/ImporNilaiAsesmenModal.jsx
//
// Tombol + modal "Impor Daftar Nilai Asesmen (Excel)" untuk halaman Ijazah.
// Menerima 1 atau beberapa file Excel dengan format "DAFTAR NILAI KOLEKTIF"
// (1 sheet = 1 peserta didik, seperti daftar_nilai_asesmen_2026.xlsx),
// mencocokkan tiap sheet ke data siswa yang SUDAH ADA lewat NIS/NISN
// (tidak pernah membuat siswa baru dari sini — kalau tidak cocok, baris itu
// ditandai "tidak ditemukan" supaya bisa dicek manual), lalu meng-upsert
// nilai akhir 9 mapel ke tabel `nilai_ijazah`.
//
// Pemakaian di Ijazah.jsx:
//   import ImporNilaiAsesmenModal from '../components/ImporNilaiAsesmenModal'
//   ...
//   <ImporNilaiAsesmenModal
//     siswaList={siswaList}
//     tahunPelajaranDefault={tahunPelajaran}
//     onSelesai={loadAll}
//   />

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { parseWorkbookNilaiAsesmen, MAPEL_ALIASES } from '../utils/parseNilaiAsesmen'
import { UploadCloud, X, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        resolve(XLSX.read(evt.target.result, { type: 'binary' }))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsBinaryString(file)
  })
}

export default function ImporNilaiAsesmenModal({ siswaList, tahunPelajaranDefault, onSelesai }) {
  const [open, setOpen] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [baris, setBaris] = useState([]) // hasil parse gabungan semua file yang diupload

  function resetState() {
    setBaris([])
    setError('')
    setDone(null)
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    resetState()
    setLoadingFile(true)
    try {
      const semuaBaris = []
      for (const file of files) {
        const wb = await readWorkbook(file)
        const hasilFile = parseWorkbookNilaiAsesmen(wb, siswaList, XLSX.utils)
        hasilFile.forEach((h) => semuaBaris.push({ ...h, namaFile: file.name }))
      }
      if (semuaBaris.length === 0) {
        setError('Tidak ditemukan sheet dengan format tabel nilai ("MATA PELAJARAN") di file yang diupload.')
      }
      setBaris(semuaBaris)
    } catch (err) {
      setError('Gagal membaca file Excel: ' + err.message)
    } finally {
      setLoadingFile(false)
      e.target.value = ''
    }
  }

  const barisCocok = baris.filter((b) => b.siswaId)
  const barisTidakCocok = baris.filter((b) => !b.siswaId)

  async function handleSimpan() {
    if (barisCocok.length === 0) return
    setSaving(true)
    setError('')
    try {
      // 1) Nilai akhir 9 mapel -> nilai_ijazah (dipakai halaman Ijazah, tidak berubah).
      const rows = barisCocok.map((b) => ({
        siswa_id: b.siswaId,
        tahun_pelajaran: b.tahunPelajaran || tahunPelajaranDefault,
        ...MAPEL_ALIASES.reduce((acc, m) => {
          acc[m.key] = b.nilai[m.key] ?? null
          return acc
        }, {}),
      }))
      const { error: upsertError } = await supabase
        .from('nilai_ijazah')
        .upsert(rows, { onConflict: 'siswa_id,tahun_pelajaran' })
      if (upsertError) throw upsertError

      // 2) Detail nilai per semester (IV-I s/d VI-II) + nilai asesmen ->
      //    nilai_rapor_semester, supaya bisa dicetak sebagai "Daftar Nilai
      //    Kolektif" persis format Excel-nya dan diedit lagi nanti.
      const rowsDetail = []
      barisCocok.forEach((b) => {
        MAPEL_ALIASES.forEach((m) => {
          const d = b.detail?.[m.key]
          if (!d) return
          rowsDetail.push({
            siswa_id: b.siswaId,
            tahun_pelajaran: b.tahunPelajaran || tahunPelajaranDefault,
            mapel_key: m.key,
            iv_1: d.semester?.[0] ?? null,
            iv_2: d.semester?.[1] ?? null,
            v_1: d.semester?.[2] ?? null,
            v_2: d.semester?.[3] ?? null,
            vi_1: d.semester?.[4] ?? null,
            vi_2: d.semester?.[5] ?? null,
            nilai_asesmen: d.nilaiAsesmen ?? null,
          })
        })
      })
      if (rowsDetail.length > 0) {
        const { error: detailError } = await supabase
          .from('nilai_rapor_semester')
          .upsert(rowsDetail, { onConflict: 'siswa_id,tahun_pelajaran,mapel_key' })
        if (detailError) throw detailError
      }

      setDone({ tersimpan: rows.length, dilewati: barisTidakCocok.length })
      onSelesai?.()
    } catch (err) {
      setError('Gagal menyimpan ke database: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <UploadCloud size={16} /> Impor Nilai Asesmen (Excel)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Impor Daftar Nilai Asesmen</h2>
              <button className="icon-btn" onClick={() => { setOpen(false); resetState() }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-ink-700/60 mb-3">
              Upload file Excel "Daftar Nilai Kolektif" (1 sheet = 1 peserta didik). Sistem akan
              membaca identitas (NIS/NISN) tiap sheet, mencocokkannya dengan data siswa yang{' '}
              <strong>sudah terdaftar</strong> di menu Siswa, lalu menyimpan nilai akhir 9 mapel
              (kolom <code>NILAI</code>) ke rekap nilai ijazah. Siswa yang NIS/NISN-nya tidak
              cocok dengan data siswa manapun akan ditandai dan <strong>tidak</strong> disimpan —
              perbaiki dulu datanya di menu Siswa lalu impor ulang.
            </p>

            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFiles}
              className="input-field mb-3"
            />

            {loadingFile && (
              <div className="flex items-center gap-2 text-sm text-ink-700/60 mb-3">
                <Loader2 size={16} className="animate-spin" /> Membaca file...
              </div>
            )}

            {baris.length > 0 && (
              <div className="mb-3">
                <div className="text-sm text-ink-700/70 mb-2">
                  {baris.length} sheet terbaca — {barisCocok.length} cocok dengan data siswa,{' '}
                  {barisTidakCocok.length} tidak ditemukan.
                </div>
                <div className="max-h-56 overflow-auto border rounded-lg text-xs">
                  <table className="w-full">
                    <thead className="bg-sage-50 sticky top-0">
                      <tr>
                        <th className="text-left p-1.5">Sheet / File</th>
                        <th className="text-left p-1.5">NIS</th>
                        <th className="text-left p-1.5">NISN</th>
                        <th className="text-left p-1.5">Nama di Excel</th>
                        <th className="text-left p-1.5">Tahun Pelajaran</th>
                        <th className="text-left p-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baris.map((b, idx) => (
                        <tr key={idx} className="border-t align-top">
                          <td className="p-1.5">{b.sheetName}<div className="text-ink-700/40">{b.namaFile}</div></td>
                          <td className="p-1.5">{b.nis || '-'}</td>
                          <td className="p-1.5">{b.nisn || '-'}</td>
                          <td className="p-1.5">{b.namaPeserta || '-'}</td>
                          <td className="p-1.5">{b.tahunPelajaran || tahunPelajaranDefault || '-'}</td>
                          <td className="p-1.5">
                            {b.siswaId ? (
                              <span className="text-sage-600">✓ {b.siswaNama}</span>
                            ) : (
                              <span className="text-red-600">Tidak ditemukan</span>
                            )}
                            {b.mapelTidakDikenali?.length > 0 && (
                              <div className="text-amber-600 flex items-center gap-1 mt-0.5">
                                <AlertTriangle size={12} />
                                Mapel tak dikenali: {b.mapelTidakDikenali.join(', ')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {done && (
              <div className="flex items-center gap-2 text-sm text-sage-600 mb-3">
                <CheckCircle2 size={16} />
                Berhasil! {done.tersimpan} siswa disimpan
                {done.dilewati > 0 ? `, ${done.dilewati} dilewati karena tidak cocok.` : '.'}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => { setOpen(false); resetState() }}>
                Tutup
              </button>
              <button
                className="btn-primary"
                onClick={handleSimpan}
                disabled={barisCocok.length === 0 || saving}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Simpan {barisCocok.length > 0 ? barisCocok.length : ''} Siswa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
