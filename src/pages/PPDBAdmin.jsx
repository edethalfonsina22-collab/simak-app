import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Check, X, Loader2, Copy, Printer, Trash2 } from 'lucide-react'

const TAB = [
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'diterima', label: 'Diterima' },
  { value: 'ditolak', label: 'Ditolak' },
]

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PPDBAdmin() {
  const [tab, setTab] = useState('menunggu')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [prosesId, setProsesId] = useState(null)
  const [profil, setProfil] = useState(null)

  useEffect(() => {
    supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle().then(({ data }) => setProfil(data))
  }, [])

  async function muatData() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('ppdb_pendaftar')
      .select('*')
      .eq('status', tab)
      .order('dibuat_pada', { ascending: false })
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

    // 1. Masukkan ke tabel siswa — field disesuaikan dengan skema Data Siswa terbaru
    const { error: errSiswa } = await supabase.from('siswa').insert({
      nama_lengkap: pendaftar.nama_lengkap,
      jenis_kelamin: pendaftar.jenis_kelamin,
      agama: pendaftar.agama,
      tempat_lahir: pendaftar.tempat_lahir,
      tanggal_lahir: pendaftar.tanggal_lahir,
      alamat: pendaftar.alamat,
      alamat_tinggal: pendaftar.alamat_tinggal,
      nama_ayah: pendaftar.nama_ayah,
      nama_ibu: pendaftar.nama_ibu,
      nama_orang_tua: pendaftar.nama_ayah || pendaftar.nama_ibu,
      no_hp_orang_tua: pendaftar.no_hp_orang_tua,
      nik: pendaftar.nik_siswa,
      nomor_kk: pendaftar.nomor_kk,
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
          <td>${d.tempat_lahir || '-'}, ${formatTanggal(d.tanggal_lahir)}</td>
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
              {(tab === 'menunggu' || tab === 'diterima' || tab === 'ditolak') && <th></th>}
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
                <td>{formatTanggal(d.tanggal_lahir)}</td>
                <td>{d.agama || '-'}</td>
                <td>{d.nama_ayah || '-'}</td>
                <td>{d.nama_ibu || '-'}</td>
                <td>{d.no_hp_orang_tua}</td>
                <td>{formatTanggal(d.dibuat_pada)}</td>
                {tab === 'menunggu' && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
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
                    </div>
                  </td>
                )}
                {(tab === 'diterima' || tab === 'ditolak') && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        className="icon-btn text-red-600"
                        onClick={() => hapus(d)}
                        disabled={prosesId === d.id}
                        title="Hapus"
                      >
                        {prosesId === d.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
