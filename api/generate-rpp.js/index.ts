// Supabase Edge Function: generate-rpp
// Menerima { mataPelajaran, kelas, materi } dari frontend, memanggil OpenAI
// dari server (bukan dari browser), dan mengembalikan hasilnya.
//
// API key OpenAI TIDAK pernah dikirim ke browser — key hanya hidup sebagai
// secret di server Supabase.
//
// Deploy & setup (jalankan dari root project, folder yang punya folder `supabase/`):
//   npx supabase functions deploy generate-rpp
//   npx supabase secrets set OPENAI_API_KEY=sk-xxxxxxxx
//
// Setelah deploy, jangan lupa REVOKE key OpenAI yang lama (yang sempat
// ter-hardcode di ArsipRPP.jsx) di platform.openai.com/api-keys, lalu pakai
// key BARU untuk secret di atas.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ---- Verifikasi user login lewat Supabase (supaya function ini tidak
    // bisa dipanggil sembarangan orang dan menghabiskan kuota OpenAI kamu) ----
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Belum login.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sesi tidak valid, silakan login ulang.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---- Ambil input dari body ----
    const { mataPelajaran, kelas, materi } = await req.json()

    if (!mataPelajaran || !materi) {
      return new Response(JSON.stringify({ error: 'Mata Pelajaran dan Materi wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY belum diset di secrets Supabase.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const promptText = `Anda adalah asisten ahli kurikulum pendidikan Indonesia.
Buatkan draf RPP (Rencana Pelaksanaan Pembelajaran) ringkas dan terstruktur berdasarkan data berikut:
- Mata Pelajaran: ${mataPelajaran}
- Kelas/Semester: ${kelas || 'Sesuai'}
- Materi Pokok: ${materi}

Format RPP yang dihasilkan harus mencakup:
1. Tujuan Pembelajaran
2. Langkah-Langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
3. Metode & Media Pembelajaran
4. Penilaian / Asesmen`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.7,
      }),
    })

    const data = await openaiRes.json()

    if (!openaiRes.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Gagal memproses permintaan AI.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const hasil = data.choices?.[0]?.message?.content || 'Gagal menghasilkan RPP.'

    return new Response(JSON.stringify({ result: hasil }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Terjadi kesalahan.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
