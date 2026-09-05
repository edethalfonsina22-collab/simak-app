import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useCart } from "../lib/CartContext";
import Layout from "../components/Layout";

// =========================================================
// Komponen Toko
// - Semua user login: hanya bisa LIHAT data toko
// - Superadmin: bisa Tambah, Edit, Hapus, dan Import CSV toko
// - Semua user login: bisa BUKA modal Kelola Barang untuk LIHAT barang
//   per toko, tapi hanya superadmin yang bisa tambah/edit/hapus barang.
//
// PERBAIKAN (role):
// Role diambil dari AuthContext (satu sumber kebenaran untuk seluruh
// aplikasi), sama seperti Sidebar.jsx dan komponen lain.
//
// PERBAIKAN (RLS tabel toko):
// Tabel "toko" punya kolom created_by (uuid) dan policy RLS insert
// mensyaratkan auth.uid() = created_by. Insert & import CSV sekarang
// menyertakan created_by: user.id, diambil lewat supabase.auth.getUser().
//
// PERBAIKAN (foto barang):
// Form Tambah/Edit Barang sekarang punya input gambar. File diupload ke
// Supabase Storage bucket "barang-photos", lalu public URL-nya disimpan
// di kolom barang.foto_url. Pastikan bucket & kolom sudah dibuat di
// Supabase (lihat catatan migrasi terpisah).
//
// PERBAIKAN (keranjang belanja):
// Di modal Kelola Barang, tiap barang yang stoknya masih ada sekarang
// punya input jumlah + tombol "+ Keranjang" (pakai CartContext, lihat
// lib/CartContext.jsx). Ada juga tombol "🛒 Keranjang" di header modal
// yang menuju halaman /toko/:id/keranjang dan menampilkan jumlah item
// yang sudah dimasukkan untuk toko yang sedang dibuka.
// =========================================================

const BARANG_PHOTO_BUCKET = "barang-photos";

export default function Toko() {
  const { isSuperAdmin, profil, loading: authLoading } = useAuth();
  const { addItem, getCartCount } = useCart();

  const [tokoList, setTokoList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nama_toko: "",
    alamat: "",
    no_telp: "",
    deskripsi: "",
    status: "aktif",
  });

  // ---- state untuk modal Kelola Barang ----
  const [showBarangModal, setShowBarangModal] = useState(false);
  const [activeToko, setActiveToko] = useState(null); // toko yang sedang dikelola barangnya
  const [barangList, setBarangList] = useState([]);
  const [barangLoading, setBarangLoading] = useState(false);
  const [barangError, setBarangError] = useState("");
  const [editingBarangId, setEditingBarangId] = useState(null);
  const [barangForm, setBarangForm] = useState({
    nama_barang: "",
    kategori: "",
    harga: "",
    stok: "",
    satuan: "",
    foto_url: "",
  });
  const [barangPhotoFile, setBarangPhotoFile] = useState(null);
  const [barangPhotoPreview, setBarangPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Jumlah yang dipilih pembeli untuk tiap barang, sebelum ditambah ke keranjang
  const [qtyInput, setQtyInput] = useState({});

  const isSuperadmin = isSuperAdmin; // alias agar sisa kode di bawah tidak perlu diubah

  // ---------------------------------------------------
  // Ambil daftar toko
  // ---------------------------------------------------
  const fetchToko = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("toko")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setTokoList(data);
      setErrorMsg("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchToko();
  }, [fetchToko]);

  // ---------------------------------------------------
  // Form handlers - Toko
  // ---------------------------------------------------
  const resetForm = () => {
    setForm({
      nama_toko: "",
      alamat: "",
      no_telp: "",
      deskripsi: "",
      status: "aktif",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEdit = (item) => {
    if (!isSuperadmin) return;
    setForm({
      nama_toko: item.nama_toko || "",
      alamat: item.alamat || "",
      no_telp: item.no_telp || "",
      deskripsi: item.deskripsi || "",
      status: item.status || "aktif",
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperadmin) return;

    if (!form.nama_toko.trim()) {
      alert("Nama toko wajib diisi");
      return;
    }

    let result;
    if (editingId) {
      // update tidak perlu created_by
      result = await supabase.from("toko").update(form).eq("id", editingId);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Sesi login tidak ditemukan, silakan login ulang.");
        return;
      }

      result = await supabase
        .from("toko")
        .insert([{ ...form, created_by: user.id }]);
    }

    if (result.error) {
      alert("Gagal menyimpan: " + result.error.message);
      return;
    }

    resetForm();
    fetchToko();
  };

  const handleDelete = async (id) => {
    if (!isSuperadmin) return;
    if (!confirm("Yakin ingin menghapus toko ini?")) return;

    const { error } = await supabase.from("toko").delete().eq("id", id);
    if (error) {
      alert("Gagal menghapus: " + error.message);
      return;
    }
    fetchToko();
  };

  // ---------------------------------------------------
  // Import CSV (superadmin only)
  // Format kolom CSV: nama_toko,alamat,no_telp,deskripsi,status
  // ---------------------------------------------------
  const handleImportCSV = async (e) => {
    if (!isSuperadmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Sesi login tidak ditemukan, silakan login ulang.");
      return;
    }

    const text = await file.text();
    const rows = text
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (rows.length < 2) {
      alert("File CSV kosong atau tidak valid");
      return;
    }

    const headers = rows[0].split(",").map((h) => h.trim());
    const records = rows.slice(1).map((row) => {
      const values = row.split(",").map((v) => v.trim());
      const obj = { created_by: user.id };
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? "";
      });
      return obj;
    });

    const { error } = await supabase.from("toko").insert(records);
    if (error) {
      alert("Gagal import: " + error.message);
      return;
    }

    alert(`Berhasil import ${records.length} data toko`);
    e.target.value = "";
    fetchToko();
  };

  // ---------------------------------------------------
  // Kelola Barang - buka/tutup modal
  // ---------------------------------------------------
  const openBarangModal = async (toko) => {
    setActiveToko(toko);
    setShowBarangModal(true);
    setBarangError("");
    resetBarangForm();
    await fetchBarang(toko.id);
  };

  const closeBarangModal = () => {
    setShowBarangModal(false);
    setActiveToko(null);
    setBarangList([]);
    resetBarangForm();
  };

  const fetchBarang = useCallback(async (tokoId) => {
    setBarangLoading(true);
    const { data, error } = await supabase
      .from("barang")
      .select("*")
      .eq("toko_id", tokoId)
      .order("created_at", { ascending: false });

    if (error) {
      setBarangError(error.message);
    } else {
      setBarangList(data);
      setBarangError("");
    }
    setBarangLoading(false);
  }, []);

  // ---------------------------------------------------
  // Form handlers - Barang
  // ---------------------------------------------------
  const resetBarangForm = () => {
    setBarangForm({
      nama_barang: "",
      kategori: "",
      harga: "",
      stok: "",
      satuan: "",
      foto_url: "",
    });
    setEditingBarangId(null);
    setBarangPhotoFile(null);
    setBarangPhotoPreview("");
  };

  const handleBarangChange = (e) => {
    setBarangForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleBarangEdit = (item) => {
    if (!isSuperadmin) return;
    setBarangForm({
      nama_barang: item.nama_barang || "",
      kategori: item.kategori || "",
      harga: item.harga ?? "",
      stok: item.stok ?? "",
      satuan: item.satuan || "",
      foto_url: item.foto_url || "",
    });
    setEditingBarangId(item.id);
    setBarangPhotoFile(null);
    setBarangPhotoPreview(item.foto_url || "");
  };

  // Pilih file gambar -> tampilkan preview lokal (upload terjadi saat submit)
  const handleBarangPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setBarangPhotoFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar");
      e.target.value = "";
      return;
    }
    setBarangPhotoFile(file);
    setBarangPhotoPreview(URL.createObjectURL(file));
  };

  const uploadBarangPhoto = async (file, tokoId) => {
    const ext = file.name.split(".").pop();
    const path = `${tokoId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BARANG_PHOTO_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(BARANG_PHOTO_BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  };

  const handleBarangSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperadmin) return;
    if (!activeToko) return;

    if (!barangForm.nama_barang.trim()) {
      alert("Nama barang wajib diisi");
      return;
    }

    let foto_url = barangForm.foto_url;

    if (barangPhotoFile) {
      setUploadingPhoto(true);
      try {
        foto_url = await uploadBarangPhoto(barangPhotoFile, activeToko.id);
      } catch (err) {
        setUploadingPhoto(false);
        alert("Gagal upload foto: " + err.message);
        return;
      }
      setUploadingPhoto(false);
    }

    const payload = {
      ...barangForm,
      harga: barangForm.harga === "" ? null : Number(barangForm.harga),
      stok: barangForm.stok === "" ? null : Number(barangForm.stok),
      toko_id: activeToko.id,
      foto_url,
    };

    let result;
    if (editingBarangId) {
      result = await supabase
        .from("barang")
        .update(payload)
        .eq("id", editingBarangId);
    } else {
      result = await supabase.from("barang").insert([payload]);
    }

    if (result.error) {
      alert("Gagal menyimpan barang: " + result.error.message);
      return;
    }

    resetBarangForm();
    fetchBarang(activeToko.id);
  };

  const handleBarangDelete = async (id) => {
    if (!isSuperadmin) return;
    if (!confirm("Yakin ingin menghapus barang ini?")) return;

    const { error } = await supabase.from("barang").delete().eq("id", id);
    if (error) {
      alert("Gagal menghapus barang: " + error.message);
      return;
    }
    fetchBarang(activeToko.id);
  };

  // ---------------------------------------------------
  // Keranjang belanja
  // ---------------------------------------------------
  const getQty = (barangId) => qtyInput[barangId] ?? 1;

  const setQty = (barangId, qty) => {
    setQtyInput((prev) => ({ ...prev, [barangId]: qty }));
  };

  const handleTambahKeranjang = (item) => {
    if (!activeToko) return;
    const qty = getQty(item.id);
    addItem(activeToko.id, item, qty);
    setQty(item.id, 1);
  };

  const cartCount = activeToko ? getCartCount(activeToko.id) : 0;

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------
  if (authLoading || loading) {
    return (
      <Layout title="Data Toko" subtitle="Kelola daftar toko dan barangnya">
        <div>Memuat data toko...</div>
      </Layout>
    );
  }

  const headerActions = isSuperadmin && (
    <>
      <label className="px-3 py-2 text-sm bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
        Import CSV
        <input
          type="file"
          accept=".csv"
          onChange={handleImportCSV}
          className="hidden"
        />
      </label>
      <button
        onClick={() => {
          resetForm();
          setShowForm(true);
        }}
        className="px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
      >
        + Tambah Toko
      </button>
    </>
  );

  return (
    <Layout title="Data Toko" subtitle="Kelola daftar toko dan barangnya" actions={headerActions}>
      {errorMsg && (
        <div className="mb-4 text-sm text-red-600">{errorMsg}</div>
      )}

      {!isSuperadmin && (
        <p className="mb-4 text-sm text-gray-500">
          Anda login sebagai <b>{profil?.role ?? "user"}</b>. Hanya superadmin yang
          bisa menambah, mengedit, menghapus, atau mengimpor data toko.
        </p>
      )}

      {/* Form tambah/edit toko */}
      {showForm && isSuperadmin && (
        <form
          onSubmit={handleSubmit}
          className="p-4 mb-4 space-y-3 border rounded bg-gray-50"
        >
          <h2 className="font-medium">
            {editingId ? "Edit Toko" : "Tambah Toko"}
          </h2>

          <input
            name="nama_toko"
            value={form.nama_toko}
            onChange={handleChange}
            placeholder="Nama toko"
            className="w-full px-3 py-2 border rounded"
            required
          />
          <input
            name="alamat"
            value={form.alamat}
            onChange={handleChange}
            placeholder="Alamat"
            className="w-full px-3 py-2 border rounded"
          />
          <input
            name="no_telp"
            value={form.no_telp}
            onChange={handleChange}
            placeholder="No. Telp"
            className="w-full px-3 py-2 border rounded"
          />
          <textarea
            name="deskripsi"
            value={form.deskripsi}
            onChange={handleChange}
            placeholder="Deskripsi"
            className="w-full px-3 py-2 border rounded"
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Tabel daftar toko */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Nama Toko</th>
              <th className="px-3 py-2">Alamat</th>
              <th className="px-3 py-2">No. Telp</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tokoList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  Belum ada data toko
                </td>
              </tr>
            ) : (
              tokoList.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.nama_toko}</td>
                  <td className="px-3 py-2">{item.alamat}</td>
                  <td className="px-3 py-2">{item.no_telp}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        item.status === "aktif"
                          ? "text-green-600"
                          : "text-gray-400"
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    {/* Tombol Kelola Barang - tampil untuk SEMUA user */}
                    <button
                      onClick={() => openBarangModal(item)}
                      className="text-purple-600 hover:underline"
                    >
                      Kelola Barang
                    </button>

                    {isSuperadmin && (
                      <>
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= Modal Kelola Barang ================= */}
      {showBarangModal && activeToko && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Kelola Barang — {activeToko.nama_toko}
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  to={`/toko/${activeToko.id}/keranjang`}
                  className="relative px-3 py-2 text-sm border rounded hover:bg-gray-50"
                >
                  🛒 Keranjang
                  {cartCount > 0 && (
                    <span className="absolute flex items-center justify-center w-5 h-5 text-xs text-white bg-red-600 rounded-full -top-2 -right-2">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={closeBarangModal}
                  className="text-gray-500 hover:text-gray-800"
                >
                  ✕
                </button>
              </div>
            </div>

            {barangError && (
              <div className="mb-3 text-sm text-red-600">{barangError}</div>
            )}

            {!isSuperadmin && (
              <p className="mb-3 text-sm text-gray-500">
                Anda login sebagai <b>{profil?.role ?? "user"}</b>. Hanya
                superadmin yang bisa menambah, mengedit, atau menghapus
                barang.
              </p>
            )}

            {/* Form tambah/edit barang - hanya superadmin */}
            {isSuperadmin && (
            <form
              onSubmit={handleBarangSubmit}
              className="p-3 mb-4 space-y-2 border rounded bg-gray-50"
            >
              <h3 className="text-sm font-medium">
                {editingBarangId ? "Edit Barang" : "Tambah Barang"}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="nama_barang"
                  value={barangForm.nama_barang}
                  onChange={handleBarangChange}
                  placeholder="Nama barang"
                  className="px-3 py-2 border rounded col-span-2"
                  required
                />
                <input
                  name="kategori"
                  value={barangForm.kategori}
                  onChange={handleBarangChange}
                  placeholder="Kategori"
                  className="px-3 py-2 border rounded"
                />
                <input
                  name="satuan"
                  value={barangForm.satuan}
                  onChange={handleBarangChange}
                  placeholder="Satuan (pcs, kg, dll)"
                  className="px-3 py-2 border rounded"
                />
                <input
                  name="harga"
                  type="number"
                  value={barangForm.harga}
                  onChange={handleBarangChange}
                  placeholder="Harga"
                  className="px-3 py-2 border rounded"
                />
                <input
                  name="stok"
                  type="number"
                  value={barangForm.stok}
                  onChange={handleBarangChange}
                  placeholder="Stok"
                  className="px-3 py-2 border rounded"
                />

                {/* Input gambar barang */}
                <div className="col-span-2">
                  <label className="block mb-1 text-xs text-gray-500">
                    Foto Barang
                  </label>
                  <div className="flex items-center gap-3">
                    {barangPhotoPreview ? (
                      <img
                        src={barangPhotoPreview}
                        alt="Preview"
                        className="object-cover w-16 h-16 border rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-16 h-16 text-xs text-gray-400 border rounded bg-gray-100">
                        No Photo
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBarangPhotoChange}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingPhoto
                    ? "Mengupload foto..."
                    : editingBarangId
                    ? "Simpan Perubahan"
                    : "Tambah"}
                </button>
                {editingBarangId && (
                  <button
                    type="button"
                    onClick={resetBarangForm}
                    className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
            )}

            {/* Tabel barang */}
            {barangLoading ? (
              <div className="text-sm text-gray-500">Memuat barang...</div>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2">Foto</th>
                      <th className="px-3 py-2">Nama Barang</th>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2">Harga</th>
                      <th className="px-3 py-2">Stok</th>
                      <th className="px-3 py-2">Satuan</th>
                      <th className="px-3 py-2">Beli</th>
                      {isSuperadmin && <th className="px-3 py-2">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {barangList.length === 0 ? (
                      <tr>
                        <td colSpan={isSuperadmin ? 8 : 7} className="px-3 py-4 text-center text-gray-400">
                          Belum ada barang untuk toko ini
                        </td>
                      </tr>
                    ) : (
                      barangList.map((b) => {
                        const bisaDibeli = Number(b.stok) > 0;
                        return (
                        <tr key={b.id} className="border-t">
                          <td className="px-3 py-2">
                            {b.foto_url ? (
                              <img
                                src={b.foto_url}
                                alt={b.nama_barang}
                                className="object-cover w-10 h-10 border rounded"
                              />
                            ) : (
                              <div className="flex items-center justify-center w-10 h-10 text-[10px] text-gray-400 border rounded bg-gray-100">
                                -
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">{b.nama_barang}</td>
                          <td className="px-3 py-2">{b.kategori}</td>
                          <td className="px-3 py-2">{b.harga ?? "-"}</td>
                          <td className="px-3 py-2">{b.stok ?? "-"}</td>
                          <td className="px-3 py-2">{b.satuan}</td>
                          <td className="px-3 py-2">
                            {bisaDibeli ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max={b.stok}
                                  value={getQty(b.id)}
                                  onChange={(e) =>
                                    setQty(b.id, Number(e.target.value) || 1)
                                  }
                                  className="w-14 px-2 py-1 border rounded"
                                />
                                <button
                                  onClick={() => handleTambahKeranjang(b)}
                                  className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                                >
                                  + Keranjang
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Habis</span>
                            )}
                          </td>
                          {isSuperadmin && (
                            <td className="px-3 py-2 space-x-2">
                              <button
                                onClick={() => handleBarangEdit(b)}
                                className="text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleBarangDelete(b.id)}
                                className="text-red-600 hover:underline"
                              >
                                Hapus
                              </button>
                            </td>
                          )}
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
