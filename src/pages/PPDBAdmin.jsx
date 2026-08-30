import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { useAuth } from '../lib/AuthContext'
import { Check, X, Loader2, Copy, Printer, Trash2, Eye } from 'lucide-react'

const TAB = [
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'diterima', label: 'Diterima' },
  { value: 'ditolak', label: 'Ditolak' },
]

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTempatTanggalLahir(d) {
  const tempat = d.tempat_lahir || ''
  const tanggal = d.tanggal_lahir ? formatTanggal(d.tanggal_lahir) : (d.tahun_lahir ? `Tahun ${d.tahun_lahir}` : '-')
  if (tempat && tanggal !== '-') return `${tempat}, ${tanggal}`
  return tempat || tanggal
}

// Baris label-nilai yang dipakai di dalam modal Detail Pendaftar.
// Field yang kosong tetap ditampilkan sebagai "-" agar admin tahu
// field tsb memang tidak diisi oleh pendaftar, bukan hilang saat ditarik.
function BarisDetail({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-ink-950/5 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-ink-700/40">{label}</span>
      <span className="text-sm text-ink-950 break-words">{value || '-'}</span>
    </div>
  )
}

function ModalDetailPendaftar({ pendaftar, onClose }) {
  if (!pendaftar) return null
  const d = pendaftar

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-ink-950">
            Detail Pendaftaran — {d.nama_lengkap}
          </h3>
          <button className="icon-btn" onClick={onClose} title="Tutup">
            <X size={16} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6">
          <div>
            <p className="text-xs font-semibold text-brass-600 mt-2 mb-1">Data Calon Siswa</p>
            <BarisDetail label="Nama Lengkap" value={d.nama_lengkap} />
            <BarisDetail label="NIK Siswa" value={d.nik_siswa} />
            <BarisDetail label="Nomor KK" value={d.nomor_kk} />
            <BarisDetail label="Jenis Kelamin" value={d.jenis_kelamin === 'P' ? 'Perempuan' : d.jenis_kelamin === 'L' ? 'Laki-laki' : '-'} />
            <BarisDetail label="Agama" value={d.agama} />
            <BarisDetail label="Tempat, Tanggal Lahir" value={formatTempatTanggalLahir(d)} />
            <BarisDetail label="Asal TK/PAUD" value={d.asal_sekolah} />
          </div>

          <div>
            <p className="text-xs font-semibold text-brass-600 mt-2 mb-1">Data Ayah</p>
            <BarisDetail label="Nama Ayah" value={d.nama_ayah} />
            <BarisDetail label="NIK Ayah" value={d.nik_ayah} />
            <BarisDetail label="Tahun Lahir Ayah" value={d.tahun_lahir_ayah} />

            <p className="text-xs font-semibold text-brass-600 mt-3 mb-1">Data Ibu</p>
            <BarisDetail label="Nama Ibu" value={d.nama_ibu} />
            <BarisDetail label="NIK Ibu" value={d.nik_ibu} />
            <BarisDetail label="Tahun Lahir Ibu" value={d.tahun_lahir_ibu} />
          </div>
        </div>

        <p className="text-xs font-semibold text-brass-600 mt-3 mb-1">Alamat & Kontak</p>
        <BarisDetail label="Alamat (sesuai KTP/KK)" value={d.alamat} />
        <BarisDetail label="Alamat Tempat Tinggal (domisili saat ini)" value={d.alamat_tinggal} />
        <BarisDetail label="No. HP Orang Tua/Wali" value={d.no_hp_orang_tua} />

        <p className="text-xs font-semibold text-brass-600 mt-3 mb-1">Lainnya</p>
        <BarisDetail label="Status Pendaftaran" value={d.status} />
        <BarisDetail label="Tanggal Daftar" value={formatTanggal(d.dibuat_pada)} />
      </div>
    </div>
  )
}

export default function PPDBAdmin() {
  const { profil: authProfil } = useAuth()
  const sekolahId = authProfil?.sekolah_id
  const [tab, setTab] = useState('menunggu')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [prosesId, setProsesId] = useState(null)
  const [profil, setProfil] = useState(null)
  const [detailPendaftar, setDetailPendaftar] = useState(null)

  useEffect(() => {
    if (!sekolahId) return
    supabase.from('profil_sekolah').select('*').eq('sekolah_id', sekolahId).maybeSingle().then(({ data }) => setProfil(data))
  }, [sekolahId])

  async function muatData() {
    setLoading(true)
    // select('*') sudah menarik SELURUH kolom yang diisi lewat form PPDB Publik
    // (termasuk nik_siswa, nomor_kk, alamat_tinggal, nik_ayah/ibu, tahun lahir,
    // dan asal_sekolah) — tidak ada kolom yang sengaja dikecualikan di sini.
    const { data: rows, error } = await supabase
      .from('ppdb_pendaftar')
      .select('*')
      .eq('status', tab)
      .order('dibuat_pada', { ascending: false })
    if (error) {
      alert('Gagal memuat data pendaftar: ' + error.message)
    }
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    muatData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function terima(pendaftar) {
    if (!confirm(`Terima ${pendaftar.nama_lengkap} dan tambahkan ke Data Siswa?`)) return
    setProsesId(pendaftar.id)

    // 1. Masukkan ke tabel siswa — SEMUA field yang diisi di formulir PPDB Publik
    //    ikut dibawa, termasuk NIK ayah/ibu, tahun lahir siswa/ayah/ibu, alamat
    //    domisili, dan asal TK/PAUD, agar tidak ada data yang tercecer.
    const { error: errSiswa } = await supabase.from('siswa').insert({
      nama_lengkap: pendaftar.nama_lengkap,
      jenis_kelamin: pendaftar.jenis_kelamin,
      agama: pendaftar.agama,
      tempat_lahir: pendaftar.tempat_lahir,
      tanggal_lahir: pendaftar.tanggal_lahir,
      tahun_lahir: pendaftar.tahun_lahir,
      alamat: pendaftar.alamat,
      alamat_tinggal: pendaftar.alamat_tinggal,
      nama_ayah: pendaftar.nama_ayah,
      nik_ayah: pendaftar.nik_ayah,
      tahun_lahir_ayah: pendaftar.tahun_lahir_ayah,
      nama_ibu: pendaftar.nama_ibu,
      nik_ibu: pendaftar.nik_ibu,
      tahun_lahir_ibu: pendaftar.tahun_lahir_ibu,
      nama_orang_tua: pendaftar.nama_ayah || pendaftar.nama_ibu,
      no_hp_orang_tua: pendaftar.no_hp_orang_tua,
      nik: pendaftar.nik_siswa,
      nomor_kk: pendaftar.nomor_kk,
      asal_sekolah: pendaftar.asal_sekolah,
      status: 'aktif',
    })

    if (errSiswa) {
      alert('Gagal menambahkan ke Data Siswa: ' + errSiswa.message)
      setProsesId(null)
      return
    }

    // 2. Tandai status pendaftaran sebagai diterima
    const { error: errUpdate } = await supabase
      .from('ppdb_pendaftar')
      .update({ status: 'diterima' })
      .eq('id', pendaftar.id)

    setProsesId(null)
    if (errUpdate) {
      alert('Data siswa berhasil ditambahkan, tapi gagal update status pendaftaran: ' + errUpdate.message)
    }
    muatData()
  }

  async function tolak(pendaftar) {
    if (!confirm(`Tolak pendaftaran ${pendaftar.nama_lengkap}?`)) return
    setProsesId(pendaftar.id)
    const { error } = await supabase.from('ppdb_pendaftar').update({ status: 'ditolak' }).eq('id', pendaftar.id)
    setProsesId(null)
    if (!error) muatData()
    else alert('Gagal: ' + error.message)
  }

  async function hapus(pendaftar) {
    const pesan =
      tab === 'diterima'
        ? `Hapus data pendaftaran ${pendaftar.nama_lengkap} dari daftar ini? (Data siswa yang sudah masuk ke Data Siswa tidak akan terhapus)`
        : `Hapus data pendaftaran ${pendaftar.nama_lengkap} yang ditolak ini secara permanen?`
    if (!confirm(pesan)) return
    setProsesId(pendaftar.id)
    const { error } = await supabase.from('ppdb_pendaftar').delete().eq('id', pendaftar.id)
    setProsesId(null)
    if (!error) muatData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const linkPublik = `${window.location.origin}/ppdb`

  function salinLink() {
    navigator.clipboard.writeText(linkPublik)
    alert('Link pendaftaran disalin: ' + linkPublik)
  }

  function cetakDaftarSiswaBaru() {
    if (data.length === 0) {
      alert('Belum ada siswa baru yang diterima untuk dicetak.')
      return
    }

    const namaSekolah = profil?.nama_sekolah || ''
    const npsn = profil?.npsn ? `NPSN: ${profil.npsn}` : ''
    const alamatSekolah = profil?.alamat || ''
    const namaKepsek = profil?.kepala_sekolah || ''
    const nipKepsek = profil?.nip_kepala_sekolah ? `NIP. ${profil.nip_kepala_sekolah}` : ''
    const tempatTtd = profil?.tempat_ttd || ''
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const baris = data
      .map(
        (d, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${d.nama_lengkap || '-'}</td>
          <td>${d.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
          <td>${d.agama || '-'}</td>
          <td>${d.tempat_lahir || '-'}, ${d.tanggal_lahir ? formatTanggal(d.tanggal_lahir) : (d.tahun_lahir || '-')}</td>
          <td>${d.nik_siswa || '-'}</td>
          <td>${d.nomor_kk || '-'}</td>
          <td>${d.nama_ayah || '-'}</td>
          <td>${d.nama_ibu || '-'}</td>
          <td>${d.no_hp_orang_tua || '-'}</td>
          <td>${d.alamat || '-'}</td>
        </tr>`
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Daftar Nama Siswa Baru</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; }
          .kop { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
          .kop h1 { font-size: 16px; margin: 0; text-transform: uppercase; }
          .kop p { font-size: 11px; margin: 2px 0 0; }
          h2.judul { text-align: center; font-size: 13px; text-decoration: underline; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333; padding: 4px 6px; }
          th { background: #eee; text-align: center; }
          .footer { margin-top: 40px; display: flex; justify-content: flex-end; }
          .ttd { text-align: center; width: 240px; }
          .ttd .garis { margin-top: 60px; border-top: 1px solid #111; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="kop">
          <h1>${namaSekolah}</h1>
          <p>${alamatSekolah}</p>
          <p>${npsn}</p>
        </div>
        <h2 class="judul">DAFTAR NAMA SISWA BARU (PPDB)</h2>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Lengkap</th>
              <th>Jenis Kelamin</th>
              <th>Agama</th>
              <th>Tempat, Tanggal Lahir</th>
              <th>NIK</th>
              <th>No. KK</th>
              <th>Nama Ayah</th>
              <th>Nama Ibu</th>
              <th>No. HP</th>
              <th>Alamat</th>
            </tr>
          </thead>
          <tbody>
            ${baris}
          </tbody>
        </table>
        <div class="footer">
          <div class="ttd">
            <p>${tempatTtd}${tempatTtd ? ', ' : ''}${tanggalCetak}</p>
            <p>Kepala Sekolah</p>
            <div class="garis"></div>
            <p><strong>${namaKepsek}</strong></p>
            <p>${nipKepsek}</p>
          </div>
        </div>
      </body>
      </html>
    `

    const jendela = window.open('', '_blank')
    jendela.document.write(html)
    jendela.document.close()
    jendela.onload = () => {
      jendela.focus()
      jendela.print()
    }
  }

  return (
    <Layout
      title="PPDB — Pendaftaran Siswa Baru"
      subtitle="Kelola calon siswa yang mendaftar lewat formulir online"
      actions={
        <button className="btn-secondary" onClick={salinLink}>
          <Copy size={16} /> Salin Link Pendaftaran
        </button>
      }
    >
      <div className="card p-4 mb-4">
        <p className="text-sm text-ink-700/60">
          Bagikan link ini ke calon orang tua siswa untuk mendaftar secara online:
        </p>
        <p className="text-sm font-medium text-ink-950 mt-1 break-all">{linkPublik}</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {TAB.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.value ? 'bg-ink-950 text-paper' : 'bg-white text-ink-700/60 hover:bg-ink-900/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'diterima' && (
          <button className="btn-secondary" onClick={cetakDaftarSiswaBaru}>
            <Printer size={16} /> Cetak Daftar Nama Siswa Baru
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nama Calon Siswa</th>
              <th>Tanggal Lahir</th>
              <th>Agama</th>
              <th>Nama Ayah</th>
              <th>Nama Ibu</th>
              <th>No. HP</th>
              <th>Tanggal Daftar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
            {!loading && data.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-ink-700/50">Tidak ada pendaftar di status ini.</td></tr>
            )}
            {data.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.nama_lengkap}</td>
                <td>{d.tanggal_lahir ? formatTanggal(d.tanggal_lahir) : (d.tahun_lahir || '-')}</td>
                <td>{d.agama || '-'}</td>
                <td>{d.nama_ayah || '-'}</td>
                <td>{d.nama_ibu || '-'}</td>
                <td>{d.no_hp_orang_tua}</td>
                <td>{formatTanggal(d.dibuat_pada)}</td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      className="icon-btn text-ink-700/60"
                      onClick={() => setDetailPendaftar(d)}
                      title="Lihat Detail Lengkap"
                    >
                      <Eye size={15} />
                    </button>
                    {tab === 'menunggu' && (
                      <>
                        <button
                          className="icon-btn text-sage-500"
                          onClick={() => terima(d)}
                          disabled={prosesId === d.id}
                          title="Terima"
                        >
                          {prosesId === d.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        </button>
                        <button
                          className="icon-btn text-red-600"
                          onClick={() => tolak(d)}
                          disabled={prosesId === d.id}
                          title="Tolak"
                        >
                          <X size={15} />
                        </button>
                      </>
                    )}
                    {(tab === 'diterima' || tab === 'ditolak') && (
                      <button
                        className="icon-btn text-red-600"
                        onClick={() => hapus(d)}
                        disabled={prosesId === d.id}
                        title="Hapus"
                      >
                        {prosesId === d.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDetailPendaftar pendaftar={detailPendaftar} onClose={() => setDetailPendaftar(null)} />
    </Layout>
  )
}
