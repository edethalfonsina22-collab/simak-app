import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Building2,
  Check,
  Edit3,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react'

import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const STORAGE_KEY = 'simak_sekolah_aktif'

const emptyForm = {
  nama_sekolah: '',
}

export default function ManajemenSekolah() {
  const { profil, isSuperAdmin } = useAuth()

  const [sekolahList, setSekolahList] = useState([])
  const [sekolahAktifId, setSekolahAktifId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ''
  )

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  // ------------------------------------------------------------
  // Ambil semua sekolah
  // ------------------------------------------------------------
  async function loadSekolah() {
    setLoading(true)

    const { data, error } = await supabase
      .from('sekolah')
      .select('id, nama_sekolah')
      .order('nama_sekolah')

    if (error) {
      alert('Gagal memuat data sekolah: ' + error.message)
      setSekolahList([])
      setLoading(false)
      return
    }

    const daftar = data || []
    setSekolahList(daftar)

    // Kalau sekolah aktif lama sudah tidak ada, kosongkan.
    if (
      sekolahAktifId &&
      !daftar.some((sekolah) => sekolah.id === sekolahAktifId)
    ) {
      localStorage.removeItem(STORAGE_KEY)
      setSekolahAktifId('')
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!isSuperAdmin) return
    loadSekolah()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  // ------------------------------------------------------------
  // Filter pencarian
  // ------------------------------------------------------------
  const filteredSekolah = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return sekolahList

    return sekolahList.filter((sekolah) =>
      (sekolah.nama_sekolah || '').toLowerCase().includes(keyword)
    )
  }, [sekolahList, search])

  // ------------------------------------------------------------
  // Sekolah yang sedang aktif
  // ------------------------------------------------------------
  const sekolahAktif = useMemo(
    () => sekolahList.find((sekolah) => sekolah.id === sekolahAktifId) || null,
    [sekolahList, sekolahAktifId]
  )

  // ------------------------------------------------------------
  // Pilih sekolah aktif
  // ------------------------------------------------------------
  function pilihSekolah(sekolah) {
    localStorage.setItem(STORAGE_KEY, sekolah.id)
    setSekolahAktifId(sekolah.id)

    // Beri tahu halaman lain bahwa sekolah aktif berubah.
    window.dispatchEvent(
      new CustomEvent('simak-sekolah-aktif-berubah', {
        detail: sekolah,
      })
    )
  }

  // ------------------------------------------------------------
  // Form tambah
  // ------------------------------------------------------------
  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  // ------------------------------------------------------------
  // Form edit
  // ------------------------------------------------------------
  function openEdit(sekolah) {
    setEditingId(sekolah.id)
    setForm({
      nama_sekolah: sekolah.nama_sekolah || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  // ------------------------------------------------------------
  // Simpan sekolah
  // ------------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault()

    const nama = form.nama_sekolah.trim()

    if (!nama) {
      alert('Nama sekolah wajib diisi.')
      return
    }

    setSaving(true)

    if (editingId) {
      const { error } = await supabase
        .from('sekolah')
        .update({
          nama_sekolah: nama,
        })
        .eq('id', editingId)

      if (error) {
        alert('Gagal mengubah sekolah: ' + error.message)
        setSaving(false)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('sekolah')
        .insert({
          nama_sekolah: nama,
        })
        .select('id, nama_sekolah')
        .single()

      if (error) {
        alert('Gagal menambahkan sekolah: ' + error.message)
        setSaving(false)
        return
      }

      // Kalau belum ada sekolah aktif, sekolah pertama otomatis menjadi aktif.
      if (!sekolahAktifId && data?.id) {
        localStorage.setItem(STORAGE_KEY, data.id)
        setSekolahAktifId(data.id)

        window.dispatchEvent(
          new CustomEvent('simak-sekolah-aktif-berubah', {
            detail: data,
          })
        )
      }
    }

    setSaving(false)
    closeForm()
    await loadSekolah()
  }

  // ------------------------------------------------------------
  // Hanya superadmin
  // ------------------------------------------------------------
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <Layout
      title="Manajemen Sekolah"
      subtitle="Kelola sekolah dan pilih sekolah aktif"
      actions={
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={17} />
          Tambah Sekolah
        </button>
      }
    >
      <div className="space-y-5">

        {/* =====================================================
            SEKOLAH AKTIF
        ====================================================== */}
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Building2 size={23} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Sekolah Aktif
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-800">
                  {sekolahAktif?.nama_sekolah || 'Belum ada sekolah dipilih'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Semua modul administrasi nantinya akan mengikuti sekolah
                  yang dipilih di sini.
                </p>
              </div>
            </div>

            {sekolahAktif && (
              <div className="flex items-center gap-2 self-start rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:self-center">
                <Check size={14} />
                Aktif
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            SEARCH
        ====================================================== */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama sekolah..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="text-sm text-slate-500">
            {filteredSekolah.length} sekolah
          </div>
        </div>

        {/* =====================================================
            LIST SEKOLAH
        ====================================================== */}
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Memuat data sekolah...
            </div>
          </div>
        ) : filteredSekolah.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Building2
              size={35}
              className="mx-auto text-slate-300"
            />

            <h3 className="mt-3 text-base font-semibold text-slate-700">
              {search
                ? 'Sekolah tidak ditemukan'
                : 'Belum ada sekolah'}
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              {search
                ? 'Coba gunakan kata kunci pencarian yang berbeda.'
                : 'Tambahkan sekolah pertama untuk mulai mengelola data.'}
            </p>

            {!search && (
              <button
                type="button"
                onClick={openAdd}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={17} />
                Tambah Sekolah
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSekolah.map((sekolah) => {
              const aktif = sekolah.id === sekolahAktifId

              return (
                <div
                  key={sekolah.id}
                  className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition ${
                    aktif
                      ? 'border-blue-400 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-200 hover:shadow-md'
                  }`}
                >
                  {aktif && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-blue-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      Sekolah Aktif
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                        aktif
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Building2 size={22} />
                    </div>

                    <div className="min-w-0 flex-1 pr-16">
                      <h3 className="truncate font-semibold text-slate-800">
                        {sekolah.nama_sekolah}
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        ID: {sekolah.id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => pilihSekolah(sekolah)}
                      disabled={aktif}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        aktif
                          ? 'cursor-default bg-emerald-50 text-emerald-600'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {aktif ? (
                        <>
                          <Check size={16} />
                          Sedang Dipilih
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Pilih Sekolah
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEdit(sekolah)}
                      className="flex items-center justify-center rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      title="Edit sekolah"
                    >
                      <Edit3 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =======================================================
          MODAL TAMBAH / EDIT
      ======================================================== */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  SIMAK
                </p>

                <h2 className="mt-0.5 text-lg font-bold text-slate-800">
                  {editingId ? 'Edit Sekolah' : 'Tambah Sekolah'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Nama Sekolah
                </label>

                <input
                  type="text"
                  required
                  autoFocus
                  value={form.nama_sekolah}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nama_sekolah: e.target.value,
                    })
                  }
                  placeholder="Contoh: SD Negeri 01 Manokwari"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {!editingId && (
                <div className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
                  Sekolah baru akan ditambahkan ke daftar sekolah SIMAK.
                  Anda dapat langsung memilihnya sebagai sekolah aktif.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <Loader2 size={16} className="animate-spin" />
                )}

                {editingId ? 'Simpan Perubahan' : 'Tambah Sekolah'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  )
}
