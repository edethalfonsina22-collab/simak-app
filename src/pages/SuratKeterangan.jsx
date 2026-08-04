import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SuratKeteranganForm from "../components/SuratKeteranganForm";

export default function SuratKeterangan() {
  const [showForm, setShowForm] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("surat_keterangan")
      .select("*, siswa:siswa_id(nama)")
      .order("created_at", { ascending: false });
    setList(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadList();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Surat Keterangan</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {showForm ? "Tutup Form" : "+ Buat Surat Baru"}
        </button>
      </div>

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
              <th className="p-2 border">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-center text-gray-500">
                  Belum ada surat keterangan.
                </td>
              </tr>
            )}
            {list.map((s) => (
              <tr key={s.id}>
                <td className="p-2 border">{s.nomor_surat}</td>
                <td className="p-2 border">{s.judul}</td>
                <td className="p-2 border">{s.siswa?.nama || "-"}</td>
                <td className="p-2 border">
                  {new Date(s.tanggal_surat).toLocaleDateString("id-ID")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
