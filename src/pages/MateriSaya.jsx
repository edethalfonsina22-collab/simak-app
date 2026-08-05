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
    loadMateri();
  }, []);

async function loadMateri() {
  setLoading(true);

  const { data, error } = await supabase
    .from("materi_saya")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (!error) {
    setMateri(data);
  }

  setLoading(false);
}

  async function hapusMateri(id) {
    if (!confirm("Yakin ingin menghapus materi ini?")) return;

    const { error } = await supabase
      .from("materi_pembelajaran")
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
        <p>Memuat data...</p>
      ) : materi.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center shadow">
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

{loading ? (

<tr>
<td colSpan="6" className="text-center py-8">
Memuat data...
</td>
</tr>

) : materi.length === 0 ? (

<tr>
<td colSpan="6" className="text-center py-8">
Belum ada materi.
</td>
</tr>

) : (

materi.map((item) => (

<tr key={item.id} className="border-t">

<td className="p-3">{item.judul}</td>

<td>{item.mapel}</td>

<td>{item.kelas}</td>

<td>{item.fase}</td>

<td>
{new Date(item.created_at).toLocaleDateString("id-ID")}
</td>

<td className="space-x-2">

<button
onClick={() => navigate(`/template-materi/${item.template_id}`)}
className="bg-blue-600 text-white px-3 py-1 rounded"
>
Lihat
</button>

<button
className="bg-yellow-500 text-white px-3 py-1 rounded"
>
Edit
</button>

<button
className="bg-red-600 text-white px-3 py-1 rounded"
>
Hapus
</button>

</td>

</tr>

))

)}

</tbody>

                <tr
                  key={item.id}
                  className="border-t"
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

                    <div className="flex gap-2 justify-center">

                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded"
                      >
                        Lihat
                      </button>

                      <button
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => hapusMateri(item.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded"
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
