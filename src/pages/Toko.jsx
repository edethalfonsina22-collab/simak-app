import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

// =========================================================
// Komponen Toko
// - Semua user login: hanya bisa LIHAT data
// - Superadmin: bisa Tambah, Edit, Hapus, dan Import CSV
// =========================================================
export default function Toko() {
  const [tokoList, setTokoList] = useState([]);
  const [role, setRole] = useState(null); // role user yang sedang login
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

  const isSuperadmin = role === "superadmin";

  // ---------------------------------------------------
  // Ambil role user yang sedang login
  // ---------------------------------------------------
  const fetchRole = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setRole(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Gagal mengambil role:", error.message);
      return;
    }
    setRole(data?.role ?? "user");
  }, []);

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
    fetchRole();
    fetchToko();
  }, [fetchRole, fetchToko]);

  // ---------------------------------------------------
  // Form handlers
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
      result = await supabase.from("toko").update(form).eq("id", editingId);
    } else {
      result = await supabase.from("toko").insert([form]);
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
      const obj = {};
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
  // Render
  // ---------------------------------------------------
  if (loading) return <div className="p-4">Memuat data toko...</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Data Toko</h1>

        {isSuperadmin && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-4 text-sm text-red-600">{errorMsg}</div>
      )}

      {!isSuperadmin && (
        <p className="mb-4 text-sm text-gray-500">
          Anda login sebagai <b>{role ?? "user"}</b>. Hanya superadmin yang
          bisa menambah, mengedit, menghapus, atau mengimpor data toko.
        </p>
      )}

      {/* Form tambah/edit */}
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
              {isSuperadmin && <th className="px-3 py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {tokoList.length === 0 ? (
              <tr>
                <td colSpan={isSuperadmin ? 5 : 4} className="px-3 py-4 text-center text-gray-400">
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
