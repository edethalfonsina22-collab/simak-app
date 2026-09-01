import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOnlineGuru } from '../hooks/useOnlineGuru'
import { X, Circle } from 'lucide-react'

export default function StatusGuruModal({ sekolah, onClose }) {
  const [daftarGuru, setDaftarGuru] = useState([])
  const [loading, setLoading] = useState(true)
  const onlineIds = useOnlineGuru(sekolah?.id)

  useEffect(() => {
    if (!sekolah?.id) return
    let aktif = true
    setLoading(true)
    supabase
      .from('guru')
      .select('id, nama_lengkap, mata_pelajaran')
      .eq('sekolah_id', sekolah.id)
      .order('nama_lengkap')
      .then(({ data }) => {
        if (aktif) {
          setDaftarGuru(data || [])
          setLoading(false)
        }
      })
    return () => {
      aktif = false
    }
  }, [sekolah?.id])

  const terurut = [...daftarGuru].sort((a, b) => {
    const aOn = onlineIds.has(a.id) ? 0 : 1
    const bOn = onlineIds.has(b.id) ? 0 : 1
    return aOn - bOn || (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '')
  })

  const jumlahOnline = daftarGuru.filter((g) => onlineIds.has(g.id)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-900">Status Guru</p>
            <p className="text-[11px] text-slate-400">
              {sekolah?.nama_sekolah} — {jumlahOnline} dari {daftarGuru.length} guru online
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {loading ? (
            <p className="text-sm text-slate-400">Memuat...</p>
          ) : terurut.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada data guru untuk sekolah ini.</p>
          ) : (
            terurut.map((g) => {
              const online = onlineIds.has(g.id)
              return (
                <div key={g.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50">
                  <Circle
                    size={9}
                    className={online ? 'fill-green-500 text-green-500 shrink-0' : 'fill-slate-300 text-slate-300 shrink-0'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{g.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400 truncate">{g.mata_pelajaran || '-'}</p>
                  </div>
                  <span className={`text-[10px] font-medium shrink-0 ${online ? 'text-green-600' : 'text-slate-400'}`}>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
