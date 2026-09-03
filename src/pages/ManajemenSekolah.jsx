import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Check,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
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
  // State untuk hapus sekolah (+ pratinjau guru & siswa di dalamnya)
  // ------------------------------------------------------------
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [loadingIsi, setLoadingIsi] = useState(false)
  const [daftarGuru, setDaftarGuru] = useState([])
  const [jumlahSiswa, setJumlahSiswa] = useState(0)
  const [gagalMuatIsi, setGagalMuatIsi] = useState(false)
  const [pesanErrorIsi, setPesanErrorIsi] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

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
  // Buka modal hapus — sekaligus muat daftar guru & jumlah siswa
  // di sekolah itu, supaya bisa dicek dulu sebelum yakin menghapus.
  // ------------------------------------------------------------
  async function openDelete(sekolah) {
    setDeleteTarget(sekolah)
    setConfirmText('')
    setDaftarGuru([])
    setJumlahSiswa(0)
    setGagalMuatIsi(false)
    setPesanErrorIsi('')
    setLoadingIsi(true)

    try {
      // Daftar guru/staf yang terdaftar di sekolah ini (tabel guru).
      const { data: guruData, error: guruError } = await supabase
        .from('guru')
        .select('id, nama_lengkap, mata_pelajaran, status')
        .eq('sekolah_id', sekolah.id)
        .order('nama_lengkap')

      if (guruError) throw guruError

      setDaftarGuru(guruData || [])

      // Jumlah siswa di sekolah ini (tabel siswa), sekadar info tambahan.
      const { count, error: siswaError } = await supabase
        .from('siswa')
        .select('id', { count: 'exact', head: true })
        .eq('sekolah_id', sekolah.id)

      if (!siswaError) {
        setJumlahSiswa(count || 0)
      }
    } catch (err) {
      // Kalau gagal memuat (mis. nama tabel/kolom beda), tetap tampilkan modal
      // tapi beri peringatan supaya tidak menghapus secara membabi buta.
      setGagalMuatIsi(true)
      setPesanErrorIsi(err?.message || 'Terjadi kesalahan yang tidak diketahui.')
    } finally {
      setLoadingIsi(false)
    }
  }

  function closeDelete() {
    if (deleting) return
    setDeleteTarget(null)
    setConfirmText('')
    setDaftarGuru([])
    setJumlahSiswa(0)
    setGagalMuatIsi(false)
  }

  const konfirmasiCocok =
    deleteTarget &&
    confirmText.trim().toLowerCase() ===
      (deleteTarget.nama_sekolah || '').trim().toLowerCase()

  async function handleDelete() {
    if (!deleteTarget || !konfirmasiCocok) return

    setDeleting(true)

    const { error } = await supabase
      .from('sekolah')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      alert(
        'Gagal menghapus sekolah: ' +
          error.message +
          '\n\nKemungkinan masih ada data guru/siswa yang terhubung ke sekolah ini.'
      )
      setDeleting(false)
      return
    }

    // Kalau sekolah yang dihapus adalah sekolah aktif, kosongkan.
    if (deleteTarget.id === sekolahAktifId) {
      localStorage.removeItem(STORAGE_KEY)
      setSekolahAktifId('')
    }

    setDeleting(false)
    closeDelete()
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

                    <button
                      type="button"
                      onClick={() => openDelete(sekolah)}
                      className="flex items-center justify-center rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      title="Hapus sekolah"
                    >
                      <Trash2 size={16} />
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

      {/* =======================================================
          MODAL HAPUS SEKOLAH — tampilkan dulu isi (guru & siswa)
          supaya tidak salah hapus sekolah.
      ======================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <AlertTriangle size={20} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Hapus Sekolah
                  </p>

                  <h2 className="mt-0.5 text-lg font-bold text-slate-800">
                    {deleteTarget.nama_sekolah}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
              <p className="text-sm text-slate-600">
                Periksa dulu isi sekolah ini sebelum dihapus, supaya tidak
                salah hapus sekolah yang namanya mirip.
              </p>

              {loadingIsi ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-8 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Memuat data guru & siswa...
                </div>
              ) : gagalMuatIsi ? (
                <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                  Tidak bisa memuat daftar guru/siswa sekolah ini secara
                  otomatis. Pastikan Anda sudah benar-benar yakin dengan nama
                  sekolah di atas sebelum melanjutkan.
                  {pesanErrorIsi && (
                    <p className="mt-2 rounded-lg bg-amber-100/70 px-2 py-1.5 font-mono text-[11px] text-amber-800">
                      Detail teknis: {pesanErrorIsi}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                      <Users size={15} className="text-blue-500" />
                      {daftarGuru.length} guru/staf terdaftar
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                      <Users size={15} className="text-emerald-500" />
                      {jumlahSiswa} siswa terdaftar
                    </div>
                  </div>

                  {daftarGuru.length > 0 ? (
                    <div className="rounded-xl border border-slate-200">
                      <p className="border-b border-slate-100 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Daftar Guru / Staf di Sekolah Ini ({daftarGuru.length})
                      </p>

                      <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
                        {daftarGuru.map((g) => (
                          <li
                            key={g.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm text-slate-700"
                          >
                            <span className="min-w-0">
                              <span className="font-medium">
                                {g.nama_lengkap || 'Tanpa nama'}
                              </span>
                              {g.mata_pelajaran && (
                                <span className="ml-2 text-xs text-slate-400">
                                  ({g.mata_pelajaran})
                                </span>
                              )}
                            </span>

                            {g.status && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  g.status === 'aktif'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {g.status}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                      Tidak ada guru/staf yang terdaftar di sekolah ini.
                    </div>
                  )}

                  {(daftarGuru.length > 0 || jumlahSiswa > 0) && (
                    <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                      Sekolah ini masih memiliki data guru/staf dan/atau
                      siswa. Menghapus sekolah bisa gagal (jika data tersebut
                      masih terhubung) atau berdampak pada data mereka.
                      Pastikan ini benar-benar sekolah yang ingin dihapus.
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-slate-100 pt-4">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Ketik ulang nama sekolah untuk konfirmasi
                </label>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={deleteTarget.nama_sekolah}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  Ketik: <span className="font-semibold">{deleteTarget.nama_sekolah}</span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={!konfirmasiCocok || deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
