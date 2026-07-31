import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { useAuth } from '../lib/AuthContext'
import { eksporExcelMultiSheet, unduhJSON } from '../lib/exportUtils'
import { DatabaseBackup, Download, FileJson, Loader2, ShieldCheck, AlertTriangle, Clock } from 'lucide-react'

// Semua tabel data sekolah yang perlu ikut di-backup
const DAFTAR_TABEL = [
  'siswa', 'guru', 'kelas', 'jadwal', 'presensi_siswa', 'presensi_guru',
  'nilai', 'pengumuman', 'inventaris', 'agenda', 'surat', 'keuangan',
]

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Backup() {
  const { session } = useAuth()
  const [riwayat, setRiwayat] = useState([])
  const [loadingRiwayat, setLoadingRiwayat] = useState(true)
  const [sedangBackup, setSedangBackup] = useState(false)

  async function muatRiwayat() {
    setLoadingRiwayat(true)
    const { data } = await supabase
      .from('backup_log')
      .select('*')
      .order('dibuat_pada', { ascending: false })
      .limit(20)
    setRiwayat(data || [])
    setLoadingRiwayat(false)
  }

  useEffect(() => {
    muatRiwayat()
  }, [])

  async function ambilSemuaData() {
    const hasil = {}
    for (const tabel of DAFTAR_TABEL) {
      const { data, error } = await supabase.from(tabel).select('*')
      hasil[tabel] = error ? [] : data
    }
    return hasil
  }

  async function buatBackup(format) {
    setSedangBackup(true)
    try {
      const semuaData = await ambilSemuaData()
      const namaFile = `backup-simak-${new Date().toISOString().slice(0, 10)}`

      if (format === 'excel') {
        eksporExcelMultiSheet(
          DAFTAR_TABEL.map((t) => ({ nama: t, rows: semuaData[t] })),
          namaFile
        )
      } else {
        unduhJSON(semuaData, namaFile)
      }

      // Catat riwayat backup ke database
      await supabase.from('backup_log').insert({
        dibuat_oleh: session?.user?.email || 'tidak diketahui',
        jumlah_tabel: DAFTAR_TABEL.length,
        catatan: `Format: ${format === 'excel' ? 'Excel' : 'JSON'}`,
      })
      muatRiwayat()
    } catch (err) {
      alert('Gagal membuat backup: ' + err.message)
    } finally {
      setSedangBackup(false)
    }
  }

  const backupTerakhir = riwayat[0]
  const hariSejakBackup = backupTerakhir
    ? Math.floor((Date.now() - new Date(backupTerakhir.dibuat_pada)) / (1000 * 60 * 60 * 24))
    : null
  const perluDiingatkan = hariSejakBackup === null || hariSejakBackup >= 7

  return (
    <Layout title="Backup Data" subtitle="Unduh salinan seluruh data sekolah untuk keamanan jangka panjang">
      {perluDiingatkan && (
        <div className="card p-4 mb-5 flex items-center gap-3 border-l-4 border-amber-500 bg-amber-500/5">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm text-ink-700/80">
            {backupTerakhir
              ? `Sudah ${hariSejakBackup} hari sejak backup terakhir. Disarankan membuat backup rutin, minimal 1x per minggu.`
              : 'Belum pernah ada backup yang dibuat. Disarankan membuat backup pertama sekarang.'}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-lg bg-sage-500/10 flex items-center justify-center text-sage-500">
              <DatabaseBackup size={20} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-ink-950">Buat Backup Sekarang</h3>
              <p className="text-xs text-ink-700/50">
                Mengunduh seluruh data ({DAFTAR_TABEL.length} tabel: siswa, guru, nilai, presensi, keuangan, dll)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button className="btn-primary" onClick={() => buatBackup('excel')} disabled={sedangBackup}>
              {sedangBackup ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Unduh sebagai Excel
            </button>
            <button className="btn-secondary" onClick={() => buatBackup('json')} disabled={sedangBackup}>
              {sedangBackup ? <Loader2 size={16} className="animate-spin" /> : <FileJson size={16} />}
              Unduh sebagai JSON (teknis)
            </button>
          </div>
          <p className="text-xs text-ink-700/40 mt-3">
            Simpan file hasil unduhan di tempat aman — Google Drive, flashdisk, atau email ke diri sendiri.
            Format Excel mudah dibuka & dibaca; format JSON lebih cocok kalau suatu saat data perlu dipulihkan kembali oleh developer.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-display font-semibold text-ink-950">Backup Otomatis Supabase</h3>
          </div>
          <p className="text-sm text-ink-700/70">
            Database Anda (Supabase) sebenarnya juga punya cadangan otomatis di sisi server.
            Untuk mengaktifkan/memperpanjang retensi backup otomatis harian, cek menu
            <strong> Database → Backups</strong> di dashboard Supabase Anda — beberapa opsi
            memerlukan paket berbayar.
          </p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display font-semibold text-ink-950 mb-4">Riwayat Backup</h3>
        {loadingRiwayat && <p className="text-sm text-ink-700/50">Memuat riwayat...</p>}
        {!loadingRiwayat && riwayat.length === 0 && (
          <p className="text-sm text-ink-700/50">Belum ada riwayat backup.</p>
        )}
        {!loadingRiwayat && riwayat.length > 0 && (
          <div className="space-y-2">
            {riwayat.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-ink-900/5 last:border-0">
                <div className="flex items-center gap-3">
                  <Clock size={15} className="text-ink-700/40" />
                  <div>
                    <p className="text-sm font-medium text-ink-950">{formatTanggal(r.dibuat_pada)}</p>
                    <p className="text-xs text-ink-700/50">{r.dibuat_oleh} · {r.catatan} · {r.jumlah_tabel} tabel</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
