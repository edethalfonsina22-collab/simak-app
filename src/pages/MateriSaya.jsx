import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function MateriSaya() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [materi, setMateri] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      loadMateri();
    }
  }, [session]);

  async function loadMateri() {
    setLoading(true);

    const { data, error } = await supabase
      .from("materi_saya")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
    } else {
      setMateri(data);
    }

    setLoading(false);
  }

  async function hapusMateri(id) {
    const konfirmasi = window.confirm(
      "Yakin ingin menghapus materi ini?"
    );

    if (!konfirmasi) return;

    const { error } = await supabase
      .from("materi_saya")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadMateri();
  }

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        📚 Materi Saya
      </h1>

      {loading ? (

        <div className="bg-white rounded-xl shadow p-10 text-center">
          Memuat data...
        </div>

      ) : materi.length === 0 ? (

        <div className="bg-white rounded-xl shadow p-10 text-center">
          Belum ada materi yang disimpan.
        </div>

      ) : (

        <div className="bg-white rounded-xl shadow overflow-hidden">

          <table className="w-full">

            <thead className="bg-slate-100">

              <tr>
                <th className="text-left p-4">Judul</th>
                <th className="text-left p-4">Mapel</th>
                <th className="text-left p-4">Kelas</th>
                <th className="text-left p-4">Fase</th>
                <th className="text-left p-4">Tanggal</th>
                <th className="text-center p-4">Aksi</th>
              </tr>

            </thead>

            <tbody>

              {materi.map((item) => (

                <tr
                  key={item.id}
                  className="border-t hover:bg-slate-50"
                >

                  <td className="p-4 font-medium">
                    {item.judul}
                  </td>

                  <td className="p-4">
                    {item.mapel}
                  </td>

                  <td className="p-4">
                    {item.kelas}
                  </td>

                  <td className="p-4">
                    {item.fase}
                  </td>

                  <td className="p-4">
                    {new Date(item.created_at).toLocaleDateString("id-ID")}
                  </td>

                  <td className="p-4">

                    <div className="flex justify-center gap-2">

                      <button
                        onClick={() =>
                          navigate(`/template-materi/${item.template_id}`)
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        Lihat
                      </button>

                      <button
                        onClick={() =>
                          navigate(`/materi/edit/${item.id}`)
                        }
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => hapusMateri(item.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                      >
                        Hapus
                      </button>

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
}
