import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient' // sesuaikan kalau path client Supabase Anda beda
import { Video, Plus, Users } from 'lucide-react'

export default function Rapat() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [daftarRapat, setDaftarRapat] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [judulBaru, setJudulBaru] = useState('')
  const [membuat, setMembuat] = useState(false)

  const muatDaftarRapat = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('rapat')
      .select('*')
      .eq('status', 'aktif')
      .order('created_at', { ascending: false })

    if (!error) setDaftarRapat(data || [])
    setLoading(false)
  }

  useEffect(() => {
    muatDaftarRapat()
  }, [])

  const buatRapatBaru = async () => {
    if (!judulBaru.trim()) return
    setMembuat(true)

    const roomId = crypto.randomUUID()
    const namaUser =
      session?.user?.user_metadata?.full_name ||
      session?.user?.email ||
      'Pengguna'

    const { data, error } = await supabase
      .from('rapat')
      .insert({
        judul: judulBaru.trim(),
        room_id: roomId,
        dibuat_oleh: session.user.id,
        dibuat_oleh_nama: namaUser,
      })
      .select()
      .single()

    setMembuat(false)

    if (error) {
      alert('Gagal membuat rapat: ' + error.message)
      return
    }

    navigate(`/rapat/${data.room_id}`)
  }

  const gabungRapat = (roomId) => {
    navigate(`/rapat/${roomId}`)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Video size={24} /> Rapat Video
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Mulai Rapat Baru
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Memuat daftar rapat...</p>
      ) : daftarRapat.length === 0 ? (
        <p className="text-gray-500">Belum ada rapat aktif. Klik "Mulai Rapat Baru" untuk membuat.</p>
      ) : (
        <div className="space-y-3">
          {daftarRapat.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-white"
            >
              <div>
                <p className="font-semibold">{r.judul}</p>
                <p className="text-sm text-gray-500">
                  Dibuat oleh {r.dibuat_oleh_nama} ·{' '}
                  {new Date(r.created_at).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => gabungRapat(r.room_id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Users size={16} /> Gabung
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Mulai Rapat Baru</h2>
            <input
              type="text"
              value={judulBaru}
              onChange={(e) => setJudulBaru(e.target.value)}
              placeholder="Contoh: Rapat Guru Senin"
              className="w-full border rounded-lg px-3 py-2 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
              >
                Batal
              </button>
              <button
                onClick={buatRapatBaru}
                disabled={membuat || !judulBaru.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {membuat ? 'Membuat...' : 'Mulai Rapat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
