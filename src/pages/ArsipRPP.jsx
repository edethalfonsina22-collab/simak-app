import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { FileText, Download, Archive, Search } from 'lucide-react'

export default function ArsipRPP() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('rpp')
      .select('*, guru(nama_lengkap)')
      .eq('status', 'disetujui')
      .order('disetujui_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDownload(path, fileName) {
    const { data, error } = await supabase.storage.from('rpp-files').createSignedUrl(path, 60)
    if (error) {
      alert('Gagal buka file: ' + error.message)
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  const filtered = items.filter((item) => {
    const q = query.toLowerCase()
    return (
      item.judul?.toLowerCase().includes(q) ||
      item.mata_pelajaran?.toLowerCase().includes(q) ||
      item.guru?.nama_lengkap?.toLowerCase().includes(q) ||
      item.kelas?.toLowerCase().includes(q)
    )
  })

  return (
    <Layout title="Arsip RPP" subtitle="Kumpulan RPP yang sudah disetujui">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Archive size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Arsip RPP</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {items.length} RPP telah disetujui dan tersimpan di arsip
            </p>
          </div>
        </div>
        <Archive size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            className="input-field !pl-9"
            placeholder="Cari judul, mata pelajaran, guru, atau kelas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Daftar Arsip</h3>
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada RPP yang disetujui.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {filtered.map((item) => (
              <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sage-500/15 text-sage-500">
                      Disetujui
                    </span>
                    <span className="text-sm font-medium text-ink-900 truncate">{item.judul}</span>
                  </div>
                  <p className="text-xs text-ink-700/50 mt-1">
                    {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                    {item.mata_pelajaran} · Kelas {item.kelas} · {item.semester} {item.tahun_ajaran}
                  </p>
                  {item.disetujui_pada && (
                    <p className="text-[11px] text-ink-700/40 mt-0.5">
                      Disetujui pada{' '}
                      {new Date(item.disetujui_pada).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(item.file_path, item.file_nama)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                  >
                    <FileText size={14} /> File RPP
                  </button>

                  {item.lembar_persetujuan_path && (
                    <button
                      onClick={() =>
                        handleDownload(
                          item.lembar_persetujuan_path,
                          `Lembar-Persetujuan-${item.judul}.pdf`
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sage-500 hover:bg-sage-500/10"
                    >
                      <Download size={14} /> Lembar Persetujuan
                    </button>
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
