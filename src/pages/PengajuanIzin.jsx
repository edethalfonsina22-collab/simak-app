import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Send, CheckCircle2, XCircle, Clock, Loader2, CalendarClock } from 'lucide-react'

const STATUS_STYLE = {
  menunggu: 'bg-brass-400/15 text-brass-600',
  disetujui: 'bg-sage-500/15 text-sage-500',
  ditolak: 'bg-red-100 text-red-600',
}
const STATUS_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function rentangTanggal(mulai, selesai) {
  const hasil = []
  const cur = new Date(mulai)
  const akhir = new Date(selesai)
  while (cur <= akhir) {
    hasil.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return hasil
}

export default function PengajuanIzin() {
  const { profil, isAdmin, session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [mengajukan, setMengajukan] = useState(false)
  const [processingId, setProcessingId] = useState(null)

  // Form pengajuan (guru)
  const [form, setForm] = useState({
    jenis: 'Izin',
    tanggal_mulai: '',
    tanggal_selesai: '',
    alasan: '',
  })

  // Form penolakan admin, per baris
  const [rejectingId, setRejectingId] = useState(null)
  const [catatanTolak, setCatatanTolak] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pengajuan_izin')
      .select('*, guru(nama_lengkap)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAjukan(e) {
    e.preventDefault()
    if (!form.tanggal_mulai || !form.tanggal_selesai) return
    if (form.tanggal_selesai < form.tanggal_mulai) {
      alert('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    setMengajukan(true)
    const { error } = await supabase.from('pengajuan_izin').insert({
      guru_id: profil.guru_id,
      jenis: form.jenis,
      tanggal_mulai: form.tanggal_mulai,
      tanggal_selesai: form.tanggal_selesai,
      alasan: form.alasan,
    })
    setMengajukan(false)
    if (error) {
      alert('Gagal mengirim pengajuan: ' + error.message)
    } else {
      setForm({ jenis: 'Izin', tanggal_mulai: '', tanggal_selesai: '', alasan: '' })
      await load()
    }
  }

  // Tulis otomatis ke presensi_guru untuk tiap tanggal di rentang pengajuan
  async function catatKePresensi(item) {
    const tanggalList = rentangTanggal(item.tanggal_mulai, item.tanggal_selesai)
    // Hapus dulu baris presensi lama di tanggal-tanggal itu (kalau ada, mis. sudah tercatat 'hadir'/'alpa')
    // supaya tidak dobel, lalu tulis ulang sebagai 'izin'.
    await supabase.from('presensi_guru').delete().eq('guru_id', item.guru_id).in('tanggal', tanggalList)
    const rows = tanggalList.map((tanggal) => ({
      guru_id: item.guru_id,
      tanggal,
      status: 'izin',
      catatan: `${item.jenis}${item.alasan ? ' — ' + item.alasan : ''}`,
    }))
    const { error } = await supabase.from('presensi_guru').insert(rows)
    if (error) throw error
  }

  async function handleApprove(item) {
    setProcessingId(item.id)
    try {
      await catatKePresensi(item)
      const { error } = await supabase
        .from('pengajuan_izin')
        .update({
          status: 'disetujui',
          diproses_oleh: session.user.id,
          diproses_pada: new Date().toISOString(),
        })
        .eq('id', item.id)
      if (error) throw error
      await load()
    } catch (err) {
      alert('Gagal menyetujui pengajuan: ' + err.message)
    }
    setProcessingId(null)
  }

  async function handleReject(item) {
    setProcessingId(item.id)
    const { error } = await supabase
      .from('pengajuan_izin')
      .update({
        status: 'ditolak',
        catatan_admin: catatanTolak,
        diproses_oleh: session.user.id,
        diproses_pada: new Date().toISOString(),
      })
      .eq('id', item.id)
    if (error) alert('Gagal menolak pengajuan: ' + error.message)
    setRejectingId(null)
    setCatatanTolak('')
    setProcessingId(null)
    await load()
  }

  // Guru hanya melihat pengajuannya sendiri (RLS di database juga sudah membatasi ini,
  // filter di sini cuma untuk jaga-jaga & agar UI konsisten)
  const daftarTampil = isAdmin ? items : items.filter((i) => i.guru_id === profil?.guru_id)
  const menungguCount = items.filter((i) => i.status === 'menunggu').length

  return (
    <Layout
      title="Pengajuan Izin & Cuti"
      subtitle={isAdmin ? 'Tinjau dan proses pengajuan izin/cuti dari guru' : 'Ajukan izin atau cuti dan pantau statusnya'}
    >
      {/* Banner biru — senada dengan RPP & Presensi */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <CalendarClock size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Pengajuan Izin & Cuti</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {isAdmin
                ? menungguCount > 0
                  ? `${menungguCount} pengajuan menunggu persetujuan`
                  : 'Semua pengajuan sudah diproses'
                : 'Ajukan izin atau cuti dan pantau statusnya di sini'}
            </p>
          </div>
        </div>
        <CalendarClock size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {!isAdmin && (
        <form onSubmit={handleAjukan} className="card p-6 mb-6 space-y-3">
          <h3 className="font-display text-lg font-semibold mb-1">Ajukan Izin / Cuti Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="input-field"
              placeholder="Jenis (mis. Izin, Cuti, Sakit)"
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value })}
              required
            />
            <input
              type="date"
              className="input-field"
              value={form.tanggal_mulai}
              onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
              required
            />
            <input
              type="date"
              className="input-field"
              value={form.tanggal_selesai}
              onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
              required
            />
          </div>
          <textarea
            className="input-field w-full"
            rows={3}
            placeholder="Alasan / keterangan"
            value={form.alasan}
            onChange={(e) => setForm({ ...form, alasan: e.target.value })}
          />
          <button type="submit" disabled={mengajukan} className="btn-primary">
            {mengajukan ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {mengajukan ? 'Mengirim...' : 'Kirim Pengajuan'}
          </button>
        </form>
      )}

      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">
          {isAdmin ? 'Semua Pengajuan' : 'Riwayat Pengajuan Saya'}
        </h3>
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : daftarTampil.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada pengajuan.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {daftarTampil.map((item) => (
              <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${STATUS_STYLE[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="text-sm font-medium text-ink-900">{item.jenis}</span>
                  </div>
                  <p className="text-xs text-ink-700/50 mt-1">
                    {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                    {formatTanggal(item.tanggal_mulai)} — {formatTanggal(item.tanggal_selesai)}
                  </p>
                  {item.alasan && <p className="text-xs text-ink-700/60 mt-1">{item.alasan}</p>}
                  {item.status === 'ditolak' && item.catatan_admin && (
                    <p className="text-xs text-red-600 mt-1">Alasan ditolak: {item.catatan_admin}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && item.status === 'menunggu' && (
                    <>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={processingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sage-500/15 text-sage-500 disabled:opacity-50"
                      >
                        {processingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Setujui
                      </button>

                      {rejectingId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input-field !py-1.5 !text-xs w-40"
                            placeholder="Alasan tolak"
                            value={catatanTolak}
                            onChange={(e) => setCatatanTolak(e.target.value)}
                          />
                          <button
                            onClick={() => handleReject(item)}
                            disabled={processingId === item.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600"
                          >
                            Kirim
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingId(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600"
                        >
                          <XCircle size={14} /> Tolak
                        </button>
                      )}
                    </>
                  )}

                  {item.status === 'menunggu' && !isAdmin && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-700/40">
                      <Clock size={14} /> Menunggu persetujuan
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
