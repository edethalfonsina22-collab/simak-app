import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

// =========================================================
// Komponen Barang Toko
// - Semua user login: hanya bisa LIHAT barang + harga
// - Superadmin: bisa Tambah, Edit, Hapus barang
// URL: /toko/:id/barang
//
// PERBAIKAN:
// Sebelumnya komponen ini mengambil role sendiri lewat query manual ke
// tabel "profiles" (tidak ada di database ini — tabel yang benar adalah
// "profil", lihat AuthContext.jsx). Sekarang role diambil dari
// AuthContext, sama seperti Toko.jsx dan Sidebar.jsx.
//
// PERBAIKAN (foto barang):
// Form Tambah/Edit Barang sekarang punya input gambar. File diupload ke
// Supabase Storage bucket "barang-photos", lalu public URL-nya disimpan
// di kolom barang.foto_url. Pastikan bucket & kolom sudah dibuat di
// Supabase (lihat catatan migrasi terpisah).
// =========================================================

const BARANG_PHOTO_BUCKET = "barang-photos";

export default function BarangToko() {
  const { id: tokoId } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin, profil } = useAuth();

  const [toko, setToko] = useState(null);
  const [barangList, setBarangList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nama_barang: "",
    kategori: "",
    harga: "",
    stok: "",
    satuan: "pcs",
    deskripsi: "",
    status: "aktif",
    foto_url: "",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isSuperadmin = isSuperAdmin;

  const formatRupiah = (angka) => {
    const n = Number(angka) || 0;
    return n.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    });
  };

  // ---------------------------------------------------
  // Ambil info toko (untuk judul halaman)
  // ---------------------------------------------------
  const fetchToko = useCallback(async () => {
    const { data, error } = await supabase
      .from("toko")
      .select("id, nama_toko")
      .eq("id", tokoId)
      .single();

    if (error) {
      setErrorMsg("Toko tidak ditemukan: " + error.message);
      return;
    }
    setToko(data);
  }, [tokoId]);

  // ---------------------------------------------------
  // Ambil daftar barang milik toko ini
  // ---------------------------------------------------
  const fetchBarang = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("barang")
      .select("*")
      .eq("toko_id", tokoId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setBarangList(data);
      setErrorMsg("");
    }
    setLoading(false);
  }, [tokoId]);

  useEffect(() => {
    fetchToko();
    fetchBarang();
  }, [fetchToko, fetchBarang]);

  // ---------------------------------------------------
  // Form handlers
  // ---------------------------------------------------
  const resetForm = () => {
    setForm({
      nama_barang: "",
      kategori: "",
      harga: "",
      stok: "",
      satuan: "pcs",
      deskripsi: "",
      status: "aktif",
      foto_url: "",
    });
    setEditingId(null);
    setShowForm(false);
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEdit = (item) => {
    if (!isSuperadmin) return;
    setForm({
      nama_barang: item.nama_barang || "",
      kategori: item.kategori || "",
      harga: item.harga ?? "",
      stok: item.stok ?? "",
      satuan: item.satuan || "pcs",
      deskripsi: item.deskripsi || "",
      status: item.status || "aktif",
      foto_url: item.foto_url || "",
    });
    setEditingId(item.id);
    setShowForm(true);
    setPhotoFile(null);
    setPhotoPreview(item.foto_url || "");
  };

  // Pilih file gambar -> tampilkan preview lokal (upload terjadi saat submit)
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar");
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (file) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperadmin) return;

    if (!form.nama_barang.trim()) {
      alert("Nama barang wajib diisi");
      return;
    }
    if (form.harga === "" || Number(form.harga) < 0) {
      alert("Harga wajib diisi dengan angka yang valid");
      return;
    }

    let foto_url = form.foto_url;

    if (photoFile) {
      setUploadingPhoto(true);
      try {
        foto_url = await uploadPhoto(photoFile);
      } catch (err) {
        setUploadingPhoto(false);
        alert("Gagal upload foto: " + err.message);
        return;
      }
      setUploadingPhoto(false);
    }

    const payload = {
      ...form,
      toko_id: tokoId,
      harga: Number(form.harga),
      stok: Number(form.stok) || 0,
      foto_url,
    };

    let result;
    if (editingId) {
      result = await supabase.from("barang").update(payload).eq("id", editingId);
    } else {
      result = await supabase.from("barang").insert([payload]);
    }

    if (result.error) {
      alert("Gagal menyimpan: " + result.error.message);
      return;
    }

    resetForm();
    fetchBarang();
  };

  const handleDelete = async (id) => {
    if (!isSuperadmin) return;
    if (!confirm("Yakin ingin menghapus barang ini?")) return;

    const { error } = await supabase.from("barang").delete().eq("id", id);
    if (error) {
      alert("Gagal menghapus: " + error.message);
      return;
    }
    fetchBarang();
  };

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------
  if (loading) return <div className="p-4">Memuat data barang...</div>;

  return (
    <div className="p-4">
      <button
        onClick={() => navigate("/toko")}
        className="mb-3 text-sm text-blue-600 hover:underline"
      >
        &larr; Kembali ke Data Toko
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          Barang {toko ? `— ${toko.nama_toko}` : ""}
        </h1>

        {isSuperadmin && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            + Tambah Barang
          </button>
        )}
      </div>

      {errorMsg && <div className="mb-4 text-sm text-red-600">{errorMsg}</div>}

      {!isSuperadmin && (
        <p className="mb-4 text-sm text-gray-500">
          Anda login sebagai <b>{profil?.role ?? "user"}</b>. Hanya superadmin yang
          bisa menambah, mengedit, atau menghapus barang.
        </p>
      )}

      {/* Form tambah/edit barang */}
      {showForm && isSuperadmin && (
        <form
          onSubmit={handleSubmit}
          className="p-4 mb-4 space-y-3 border rounded bg-gray-50"
        >
          <h2 className="font-medium">
            {editingId ? "Edit Barang" : "Tambah Barang"}
          </h2>

          <input
            name="nama_barang"
            value={form.nama_barang}
            onChange={handleChange}
            placeholder="Nama barang"
            className="w-full px-3 py-2 border rounded"
            required
          />
          <input
            name="kategori"
            value={form.kategori}
            onChange={handleChange}
            placeholder="Kategori (opsional)"
            className="w-full px-3 py-2 border rounded"
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 text-xs text-gray-500">
                Harga (Rp)
              </label>
              <input
                type="number"
                name="harga"
                value={form.harga}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-xs text-gray-500">Stok</label>
              <input
                type="number"
                name="stok"
                value={form.stok}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs text-gray-500">Satuan</label>
              <input
                name="satuan"
                value={form.satuan}
                onChange={handleChange}
                placeholder="pcs"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          {/* Input gambar barang */}
          <div>
            <label className="block mb-1 text-xs text-gray-500">
              Foto Barang
            </label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="object-cover w-20 h-20 border rounded"
                />
              ) : (
                <div className="flex items-center justify-center w-20 h-20 text-xs text-gray-400 border rounded bg-gray-100">
                  No Photo
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="text-sm"
              />
            </div>
          </div>

          <textarea
            name="deskripsi"
            value={form.deskripsi}
            onChange={handleChange}
            placeholder="Deskripsi (opsional)"
            className="w-full px-3 py-2 border rounded"
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="aktif">Aktif</option>
            <option value="habis">Stok Habis</option>
            <option value="nonaktif">Nonaktif</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploadingPhoto}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadingPhoto ? "Mengupload foto..." : "Simpan"}
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

      {/* Tabel daftar barang */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Foto</th>
              <th className="px-3 py-2">Nama Barang</th>
              <th className="px-3 py-2">Kategori</th>
              <th className="px-3 py-2">Harga</th>
              <th className="px-3 py-2">Stok</th>
              <th className="px-3 py-2">Status</th>
              {isSuperadmin && <th className="px-3 py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {barangList.length === 0 ? (
              <tr>
                <td
                  colSpan={isSuperadmin ? 7 : 6}
                  className="px-3 py-4 text-center text-gray-400"
                >
                  Belum ada barang di toko ini
                </td>
              </tr>
            ) : (
              barangList.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    {item.foto_url ? (
                      <img
                        src={item.foto_url}
                        alt={item.nama_barang}
                        className="object-cover w-12 h-12 border rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-12 h-12 text-[10px] text-gray-400 border rounded bg-gray-100">
                        -
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{item.nama_barang}</td>
                  <td className="px-3 py-2">{item.kategori || "-"}</td>
                  <td className="px-3 py-2 font-medium">
                    {formatRupiah(item.harga)}
                  </td>
                  <td className="px-3 py-2">
                    {item.stok} {item.satuan}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        item.status === "aktif"
                          ? "text-green-600"
                          : item.status === "habis"
                          ? "text-orange-500"
                          : "text-gray-400"
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  {isSuperadmin && (
                    <td className="px-3 py-2 space-x-2">
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
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
