import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Hanya MENDENGARKAN channel 'app-online-presence' (tidak ikut track()
// dirinya sendiri), lalu mengembalikan Set berisi guru_id yang sedang
// online untuk sekolahId tertentu. Dipakai di sisi Superadmin, misalnya
// di StatusGuruModal atau di daftar sekolah PesanPusat.jsx.
export function useOnlineGuru(sekolahId) {
  const [onlineGuruIds, setOnlineGuruIds] = useState(new Set())

  useEffect(() => {
    const channel = supabase.channel('app-online-presence', {
      config: { presence: { key: `viewer-${Math.random().toString(36).slice(2)}` } },
    })

    function syncState() {
      const state = channel.presenceState()
      const ids = new Set()
      Object.values(state).forEach((presences) => {
        presences.forEach((p) => {
          if (p.guru_id && (!sekolahId || p.sekolah_id === sekolahId)) {
            ids.add(p.guru_id)
          }
        })
      })
      setOnlineGuruIds(ids)
    }

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sekolahId])

  return onlineGuruIds
}
