// supabase/functions/hapus-akun/index.ts
//
// Edge Function untuk menghapus akun secara PERMANEN, termasuk dari
// Supabase Auth (auth.users) — bukan cuma baris di tabel 'profil'.
//
// Kenapa harus lewat Edge Function (bukan langsung dari React)?
// Menghapus user dari auth.users butuh "service role key", yaitu key
// admin yang punya akses penuh ke seluruh database dan bisa melewati RLS.
// Key ini TIDAK BOLEH pernah dikirim/dipakai di kode frontend (browser),
// karena kalau bocor, siapa pun bisa mengontrol seluruh database Anda.
// Edge Function berjalan di server Supabase, jadi service role key aman
// di sana (diambil otomatis dari environment, tidak perlu di-hardcode).
//
// Siapa yang boleh memanggil ini:
//  - role 'superadmin'  → boleh hapus akun siapa saja
//  - role 'admin_utama' → hanya boleh hapus akun di sekolahnya sendiri
// Selain itu akan ditolak (403).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Preflight request dari browser (karena kita kirim header Authorization custom)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method tidak diizinkan' }, 405)
  }

  try {
    const { akun_id, guru_id } = await req.json()
    if (!akun_id) {
      return json({ error: 'akun_id wajib diisi' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Tidak ada token otorisasi' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client "atas nama pemanggil" — dipakai untuk memverifikasi siapa
    // yang sedang login berdasarkan token dari frontend.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: callerAuthErr,
    } = await callerClient.auth.getUser()

    if (callerAuthErr || !caller) {
      return json({ error: 'Sesi tidak valid, silakan login ulang.' }, 401)
    }

    // Client admin (service role) — dipakai untuk baca data lintas-RLS
    // dan melakukan penghapusan, termasuk ke auth.users.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfil, error: callerProfilErr } = await adminClient
      .from('profil')
      .select('role, sekolah_id')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerProfilErr || !callerProfil) {
      return json({ error: 'Profil pemanggil tidak ditemukan.' }, 403)
    }

    const { data: targetProfil, error: targetProfilErr } = await adminClient
      .from('profil')
      .select('sekolah_id')
      .eq('id', akun_id)
      .maybeSingle()

    if (targetProfilErr || !targetProfil) {
      return json({ error: 'Akun target tidak ditemukan (mungkin sudah terhapus).' }, 404)
    }

    const isSuperAdmin = callerProfil.role === 'superadmin'
    const isAdminUtamaSekolahSama =
      callerProfil.role === 'admin_utama' && callerProfil.sekolah_id === targetProfil.sekolah_id

    if (!isSuperAdmin && !isAdminUtamaSekolahSama) {
      return json({ error: 'Anda tidak berwenang menghapus akun ini.' }, 403)
    }

    // 1. Hapus data guru terkait (jika akun ini terhubung ke data guru)
    if (guru_id) {
      const { error: guruErr } = await adminClient.from('guru').delete().eq('id', guru_id)
      if (guruErr) {
        return json({ error: 'Gagal menghapus data guru: ' + guruErr.message }, 500)
      }
    }

    // 2. Hapus baris profil
    const { error: profilErr } = await adminClient.from('profil').delete().eq('id', akun_id)
    if (profilErr) {
      return json({ error: 'Gagal menghapus profil: ' + profilErr.message }, 500)
    }

    // 3. Hapus akun dari Supabase Auth — INI kunci perbaikannya, supaya
    //    akun benar-benar tidak bisa login lagi setelah dihapus.
    const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(akun_id)
    if (authDeleteErr) {
      return json(
        { error: 'Profil terhapus, tetapi gagal menghapus akun login: ' + authDeleteErr.message },
        500
      )
    }

    return json({ success: true }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga.' }, 500)
  }
})
