import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import TemplateCard from "../components/TemplateCard";

export default function TemplateMateri() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const { data, error } = await supabase
      .from("materi_pembelajaran")
      .select("*")
      .order("judul", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setTemplates(data);
  }

  const filtered = templates.filter(
    (item) =>
      item.judul.toLowerCase().includes(search.toLowerCase()) ||
      item.mapel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">

        <div>
          <h1 className="text-3xl font-bold">
            📚 Template Materi Pembelajaran
          </h1>

          <p className="text-gray-500 mt-1">
            Pilih template siap pakai untuk mempercepat proses mengajar.
          </p>
        </div>

        <input
          type="text"
          placeholder="Cari template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-4 py-2 w-full md:w-72"
        />

      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

        {filtered.length === 0 ? (

          <div className="col-span-full text-center py-10 text-gray-500">
            Belum ada template.
          </div>

        ) : (

          filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setSelectedTemplate(template)}
              onUse={() => navigate(`/template-materi/${template.id}`)}
            />
          ))

        )}

      </div>

      {selectedTemplate && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">

            <h2 className="text-2xl font-bold mb-4">
              {selectedTemplate.judul}
            </h2>

            <img
              src={selectedTemplate.thumbnail}
              alt={selectedTemplate.judul}
              className="w-full h-72 object-cover rounded-lg mb-6"
            />

            <div className="space-y-2">

              <p>
                <strong>Mapel :</strong> {selectedTemplate.mapel}
              </p>

              <p>
                <strong>Kelas :</strong> {selectedTemplate.kelas}
              </p>

              <p>
                <strong>Fase :</strong> {selectedTemplate.fase}
              </p>

              <p>
                <strong>Jenis :</strong> {selectedTemplate.jenis}
              </p>

              <p className="mt-4 text-gray-600">
                {selectedTemplate.deskripsi}
              </p>

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setSelectedTemplate(null)}
                className="border px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Tutup
              </button>

              <button
                onClick={() =>
                  navigate(`/template-materi/${selectedTemplate.id}`)
                }
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Gunakan Template
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
