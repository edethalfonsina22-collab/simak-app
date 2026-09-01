import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

// Dipasang SEKALI di Layout.jsx supaya jalan untuk semua halaman yang
// sudah login (admin, kepala_sekolah, admin_utama, guru). Setiap user
// "track" dirinya ke channel presence global 'app-online-presence' —
// begitu tab ditutup/koneksi putus, presence otomatis hilang (dianggap
// offline), tidak perlu heartbeat/polling manual.
//
// CATATAN: sesuaikan field `profil` di bawah (role, guru_id, nama) dengan
// struktur AuthContext yang sebenarnya kalau namanya berbeda.
export function usePresenceTracker() {
  const { session, profil, sekolahId } = useAuth()

  useEffect(() => {
    if (!session?.user?.id) return

    const channel = supabase.channel('app-online-presence', {
      config: { presence: { key: session.user.id } },
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: session.user.id,
          guru_id: profil?.guru_id || null,
          sekolah_id: sekolahId || null,
          role: profil?.role || null,
          nama: profil?.nama_lengkap || profil?.nama || session.user.email,
          online_at: new Date().toISOString(),
        })
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profil?.guru_id, profil?.role, sekolahId])
}
