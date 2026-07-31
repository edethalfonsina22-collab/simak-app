import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Membantu Anda cepat sadar kalau file .env belum diisi dengan benar
  console.error(
    'Supabase belum terkonfigurasi. Pastikan file .env berisi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu restart "npm run dev".'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
