import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SuratKeteranganForm from "../components/SuratKeteranganForm";
import Layout from "../components/Layout";
import { Trash2 } from "lucide-react";

export default function SuratKeterangan() {
  const [showForm, setShowForm] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function loadList() {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("surat_keterangan")
      .select(
        "*, siswa:siswa_id(nama_lengkap), guru:guru_id(nama_lengkap)"
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[surat_keterangan] gagal dimuat:", error);
      setLoadError("Gagal memuat daftar surat: " + error.message);
      setList([]);
      setLoading(false);
      return;
    }
    setList(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadList();
  }, []);

  async function handleDelete(id, judul) {
    if (!confirm(`Hapus surat "${judul || "ini"}"? Tindakan ini tidak bisa dibatalkan.`)) return;

    setDeletingId(id);
    const { error } = await supabase.from("surat_keterangan").delete().eq("id", id);
    setDeletingId(null);

    if (error) {
      alert("Gagal menghapus surat: " + error.message);
      return;
    }

    setList((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <Layout
      title="Surat Keterangan"
      subtitle="Buat dan kelola surat keterangan siswa/guru"
      actions={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {showForm ? "Tutup Form" : "+ Buat Surat Baru"}
        </button>
      }
    >
      {loadError && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm p-3 rounded mb-4">
          {loadError}
        </div>
      )}
      {showForm && (
        <div className="bg-white border rounded p-4 mb-6">
          <SuratKeteranganForm
            onSaved={() => {
              loadList();
            }}
          />
        </div>
      )}
      {loading ? (
        <p>Memuat...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">Nomor Surat</th>
              <th className="p-2 border">Judul</th>
              <th className="p-2 border">Siswa</th>
              <th className="p-2 border">Guru</th>
              <th className="p-2 border">Tanggal</th>
              <th className="p-2 border">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-center text-gray-500">
                  Belum ada surat keterangan.
                </td>
              </tr>
            )}
            {list.map((s) => (
              <tr key={s.id}>
                <td className="p-2 border">{s.nomor_surat}</td>
                <td className="p-2 border">{s.judul}</td>
                <td className="p-2 border">{s.siswa?.nama_lengkap || "-"}</td>
                <td className="p-2 border">{s.guru?.nama_lengkap || "-"}</td>
                <td className="p-2 border">
                  {new Date(s.tanggal_surat).toLocaleDateString("id-ID")}
                </td>
                <td className="p-2 border">
                  <button
                    onClick={() => handleDelete(s.id, s.judul)}
                    disabled={deletingId === s.id}
                    className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-sm disabled:opacity-50"
                    title="Hapus surat"
                  >
                    <Trash2 size={14} />
                    {deletingId === s.id ? "Menghapus..." : "Hapus"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
