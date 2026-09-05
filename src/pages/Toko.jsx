import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  MapPin,
  Phone,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Package,
  Upload,
  Settings2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useCart } from "../lib/CartContext";
import Layout from "../components/Layout";

// =========================================================
// Komponen Toko
// - Semua user login: klik NAMA TOKO / kartu toko langsung membuka
//   daftar barang toko tsb (tidak perlu lagi klik link "Kelola Barang").
// - Tamu (belum login): boleh lihat-lihat toko & barang dan mengisi
//   keranjang seperti biasa — login baru diwajibkan saat checkout
//   (lihat App.jsx & Login.jsx untuk alur redirect-nya).
// - Superadmin: bisa Tambah, Edit, Hapus, dan Import CSV toko, dan
//   tambah/edit/hapus barang lewat panel "Kelola Barang" yang bisa
//   ditampilkan/disembunyikan di dalam modal barang.
//
// PERBAIKAN (role): role diambil dari AuthContext.
// PERBAIKAN (RLS tabel toko): insert & import CSV menyertakan created_by.
// PERBAIKAN (foto barang): upload ke bucket Storage "barang-photos".
// PERBAIKAN (keranjang belanja): tiap barang yang stoknya masih ada
// punya stepper jumlah + tombol "Tambah ke Keranjang" (CartContext).
// Ikon 🛒 di header modal menuju /toko/:id/keranjang.
// PERBAIKAN (akses tamu): halaman ini & /toko/:id/keranjang kini bisa
// diakses tanpa login (lihat App.jsx) — teks di bawah header disesuaikan
// supaya tidak menampilkan "Login sebagai ..." untuk pengunjung tamu.
// PERBAIKAN (tampilan kartu toko): kartu toko sekarang berwarna solid
// berotasi (biru/hijau/ungu/oranye) mengikuti pola kartu di Dasbor,
// bukan lagi putih polos.
// =========================================================

const BARANG_PHOTO_BUCKET = "barang-photos";

// Palet warna kartu toko - berotasi sesuai urutan toko, meniru pola
// warna kartu ringkasan di Dasbor.
const CARD_COLORS = [
  {
    bg: "bg-blue-600",
    icon: "bg-white/15 text-white",
    badgeOn: "bg-white/20 text-white",
    badgeOff: "bg-white/10 text-blue-100",
    sub: "text-blue-100",
    link: "text-white",
  },
  {
    bg: "bg-emerald-600",
    icon: "bg-white/15 text-white",
    badgeOn: "bg-white/20 text-white",
    badgeOff: "bg-white/10 text-emerald-100",
    sub: "text-emerald-100",
    link: "text-white",
  },
  {
    bg: "bg-purple-600",
    icon: "bg-white/15 text-white",
    badgeOn: "bg-white/20 text-white",
    badgeOff: "bg-white/10 text-purple-100",
    sub: "text-purple-100",
    link: "text-white",
  },
  {
    bg: "bg-orange-500",
    icon: "bg-white/15 text-white",
    badgeOn: "bg-white/20 text-white",
    badgeOff: "bg-white/10 text-orange-100",
    sub: "text-orange-100",
    link: "text-white",
  },
];

function formatRupiah(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return "-";
  const angka = Number(nilai);
  if (Number.isNaN(angka)) return "-";
  return `Rp${angka.toLocaleString("id-ID")}`;
}

export default function Toko() {
  const { session, isSuperAdmin, profil, loading: authLoading } = useAuth();
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

  // ---- state untuk modal daftar barang ----
  const [showBarangModal, setShowBarangModal] = useState(false);
  const [activeToko, setActiveToko] = useState(null);
  const [barangList, setBarangList] = useState([]);
  const [barangLoading, setBarangLoading] = useState(false);
  const [barangError, setBarangError] = useState("");
  const [showBarangForm, setShowBarangForm] = useState(false); // panel kelola (superadmin)
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

  const isSuperadmin = isSuperAdmin;

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

  const handleEdit = (item, e) => {
    e?.stopPropagation();
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

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
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
  // Modal daftar barang - buka/tutup
  // ---------------------------------------------------
  const openBarangModal = async (toko) => {
    setActiveToko(toko);
    setShowBarangModal(true);
    setShowBarangForm(false);
    setBarangError("");
    resetBarangForm();
    await fetchBarang(toko.id);
  };

  const closeBarangModal = () => {
    setShowBarangModal(false);
    setActiveToko(null);
    setBarangList([]);
    setShowBarangForm(false);
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
    setShowBarangForm(true);
  };

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

  const setQty = (barangId, qty, stok) => {
    const batas = stok ? Number(stok) : 999;
    const bersih = Math.min(Math.max(1, qty), batas);
    setQtyInput((prev) => ({ ...prev, [barangId]: bersih }));
  };

  const handleTambahKeranjang = (item) => {
    if (!activeToko) return;
    const qty = getQty(item.id);
    addItem(activeToko.id, item, qty);
    setQty(item.id, 1, item.stok);
  };

  const cartCount = activeToko ? getCartCount(activeToko.id) : 0;

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------
  if (authLoading || loading) {
    return (
      <Layout title="Toko" subtitle="Pilih toko untuk mulai belanja">
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          Memuat data toko...
        </div>
      </Layout>
    );
  }

  const headerActions = isSuperadmin && (
    <>
      <label className="flex items-center gap-1.5 px-3 h-10 text-sm font-medium bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-600">
        <Upload size={15} />
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
        className="flex items-center gap-1.5 px-3 h-10 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        <Plus size={15} />
        Tambah Toko
      </button>
    </>
  );

  return (
    <Layout
      title="Toko"
      subtitle="Klik salah satu toko untuk lihat & beli barangnya"
      actions={headerActions}
    >
      {errorMsg && (
        <div className="mb-4 text-sm text-red-600">{errorMsg}</div>
      )}

      {!session ? (
        <p className="mb-5 text-sm text-slate-500">
          Anda belum login. Silakan lihat-lihat & isi keranjang dulu — login
          baru diminta saat checkout.
        </p>
      ) : (
        !isSuperadmin && (
          <p className="mb-5 text-sm text-slate-500">
            Login sebagai <b className="text-slate-700">{profil?.role ?? "user"}</b>.
            Klik kartu toko di bawah untuk melihat barang dan berbelanja.
          </p>
        )
      )}

      {/* Form tambah/edit toko */}
      {showForm && isSuperadmin && (
        <form
          onSubmit={handleSubmit}
          className="p-5 mb-6 space-y-3 border border-slate-200 rounded-xl bg-white shadow-sm"
        >
          <h2 className="font-display font-semibold text-slate-900">
            {editingId ? "Edit Toko" : "Tambah Toko"}
          </h2>

          <input
            name="nama_toko"
            value={form.nama_toko}
            onChange={handleChange}
            placeholder="Nama toko"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            required
          />
          <input
            name="alamat"
            value={form.alamat}
            onChange={handleChange}
            placeholder="Alamat"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <input
            name="no_telp"
            value={form.no_telp}
            onChange={handleChange}
            placeholder="No. Telp"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <textarea
            name="deskripsi"
            value={form.deskripsi}
            onChange={handleChange}
            placeholder="Deskripsi"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Grid kartu toko */}
      {tokoList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-xl">
          <Store size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Belum ada data toko</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokoList.map((item, idx) => {
            const c = CARD_COLORS[idx % CARD_COLORS.length];
            return (
              <div
                key={item.id}
                onClick={() => openBarangModal(item)}
                className={`group relative text-left p-5 ${c.bg} rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden`}
              >
                {isSuperadmin && (
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={(e) => handleEdit(item, e)}
                      title="Edit toko"
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-white/20 text-white hover:bg-white/30"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Hapus toko"
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-white/20 text-white hover:bg-red-500/80"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-3 mb-3 pr-14">
                  <div
                    className={`w-10 h-10 shrink-0 rounded-xl ${c.icon} flex items-center justify-center`}
                  >
                    <Store size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-white truncate">
                      {item.nama_toko}
                    </h3>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
                        item.status === "aktif" ? c.badgeOn : c.badgeOff
                      }`}
                    >
                      {item.status === "aktif" ? "Buka" : "Tutup"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {item.alamat && (
                    <p className={`flex items-start gap-1.5 text-xs ${c.sub}`}>
                      <MapPin size={13} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{item.alamat}</span>
                    </p>
                  )}
                  {item.no_telp && (
                    <p className={`flex items-center gap-1.5 text-xs ${c.sub}`}>
                      <Phone size={13} className="shrink-0" />
                      {item.no_telp}
                    </p>
                  )}
                </div>

                <div
                  className={`flex items-center justify-between text-sm font-medium ${c.link}`}
                >
                  <span>Lihat barang & belanja</span>
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= Modal Daftar Barang ================= */}
      {showBarangModal && activeToko && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeBarangModal}
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] overflow-y-auto bg-white rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Store size={16} />
                </div>
                <h2 className="font-display font-semibold text-slate-900 truncate">
                  {activeToko.nama_toko}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSuperadmin && (
                  <button
                    onClick={() => setShowBarangForm((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 h-9 text-sm font-medium rounded-lg border transition-colors ${
                      showBarangForm
                        ? "bg-slate-100 border-slate-200 text-slate-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Settings2 size={14} />
                    Kelola Barang
                  </button>
                )}
                <Link
                  to={`/toko/${activeToko.id}/keranjang`}
                  className="relative flex items-center gap-1.5 px-3 h-9 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
                >
                  <ShoppingCart size={15} />
                  <span className="hidden sm:inline">Keranjang</span>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white bg-red-500 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={closeBarangModal}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {barangError && (
                <div className="mb-3 text-sm text-red-600">{barangError}</div>
              )}

              {/* Panel kelola barang - superadmin, bisa disembunyikan */}
              {isSuperadmin && showBarangForm && (
                <form
                  onSubmit={handleBarangSubmit}
                  className="p-4 mb-5 space-y-2.5 border border-slate-200 rounded-xl bg-slate-50"
                >
                  <h3 className="text-sm font-semibold text-slate-700">
                    {editingBarangId ? "Edit Barang" : "Tambah Barang"}
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      name="nama_barang"
                      value={barangForm.nama_barang}
                      onChange={handleBarangChange}
                      placeholder="Nama barang"
                      className="px-3 py-2 border border-slate-200 rounded-lg col-span-2 text-sm bg-white"
                      required
                    />
                    <input
                      name="kategori"
                      value={barangForm.kategori}
                      onChange={handleBarangChange}
                      placeholder="Kategori"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />
                    <input
                      name="satuan"
                      value={barangForm.satuan}
                      onChange={handleBarangChange}
                      placeholder="Satuan (pcs, kg, dll)"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />
                    <input
                      name="harga"
                      type="number"
                      value={barangForm.harga}
                      onChange={handleBarangChange}
                      placeholder="Harga"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />
                    <input
                      name="stok"
                      type="number"
                      value={barangForm.stok}
                      onChange={handleBarangChange}
                      placeholder="Stok"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />

                    <div className="col-span-2">
                      <label className="block mb-1 text-xs text-slate-500">
                        Foto Barang
                      </label>
                      <div className="flex items-center gap-3">
                        {barangPhotoPreview ? (
                          <img
                            src={barangPhotoPreview}
                            alt="Preview"
                            className="object-cover w-14 h-14 border border-slate-200 rounded-lg"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-14 h-14 text-slate-300 border border-slate-200 rounded-lg bg-white">
                            <Package size={18} />
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

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={uploadingPhoto}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploadingPhoto
                        ? "Mengupload foto..."
                        : editingBarangId
                        ? "Simpan Perubahan"
                        : "Tambah Barang"}
                    </button>
                    {editingBarangId && (
                      <button
                        type="button"
                        onClick={resetBarangForm}
                        className="px-4 py-2 text-sm font-medium bg-slate-200 rounded-lg hover:bg-slate-300 text-slate-600"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* Grid barang */}
              {barangLoading ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  Memuat barang...
                </div>
              ) : barangList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-slate-200 rounded-xl">
                  <Package size={26} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">
                    Belum ada barang untuk toko ini
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {barangList.map((b) => {
                    const bisaDibeli = Number(b.stok) > 0;
                    return (
                      <div
                        key={b.id}
                        className="group relative border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow"
                      >
                        {isSuperadmin && (
                          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleBarangEdit(b)}
                              title="Edit barang"
                              className="w-6.5 h-6.5 p-1 flex items-center justify-center rounded-md bg-white/90 text-slate-500 hover:text-blue-600 shadow-sm"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleBarangDelete(b.id)}
                              title="Hapus barang"
                              className="w-6.5 h-6.5 p-1 flex items-center justify-center rounded-md bg-white/90 text-slate-500 hover:text-red-600 shadow-sm"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}

                        <div className="aspect-square bg-slate-50 flex items-center justify-center">
                          {b.foto_url ? (
                            <img
                              src={b.foto_url}
                              alt={b.nama_barang}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={24} className="text-slate-300" />
                          )}
                        </div>

                        <div className="p-3">
                          {b.kategori && (
                            <span className="inline-block mb-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
                              {b.kategori}
                            </span>
                          )}
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {b.nama_barang}
                          </p>
                          <p className="text-sm font-semibold text-blue-600 mt-0.5">
                            {formatRupiah(b.harga)}
                            {b.satuan && (
                              <span className="text-xs font-normal text-slate-400">
                                {" "}
                                /{b.satuan}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Stok: {b.stok ?? "-"}
                          </p>

                          {bisaDibeli ? (
                            <div className="mt-2.5 space-y-1.5">
                              <div className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg py-1">
                                <button
                                  onClick={() =>
                                    setQty(b.id, getQty(b.id) - 1, b.stok)
                                  }
                                  className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-sm font-medium text-slate-700">
                                  {getQty(b.id)}
                                </span>
                                <button
                                  onClick={() =>
                                    setQty(b.id, getQty(b.id) + 1, b.stok)
                                  }
                                  className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              <button
                                onClick={() => handleTambahKeranjang(b)}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                              >
                                <ShoppingCart size={13} />
                                Tambah
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2.5 py-1.5 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-lg">
                              Stok Habis
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
