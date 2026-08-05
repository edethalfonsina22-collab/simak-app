import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import templates from "../data/templates";

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const template = templates.find((t) => t.id === Number(id));

  if (!template) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">
          Template tidak ditemukan
        </h1>

        <button
          onClick={() => navigate("/template-materi")}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Kembali
        </button>
      </div>
    );
  }

  const [judul, setJudul] = useState(template.title);
  const [deskripsi, setDeskripsi] = useState(template.description);

  return (
    <div className="max-w-5xl mx-auto p-6">

      <button
        onClick={() => navigate(-1)}
        className="mb-6 border px-4 py-2 rounded-lg hover:bg-gray-100"
      >
        ← Kembali
      </button>

      <div className="bg-white rounded-xl shadow p-6">

        <h1 className="text-3xl font-bold mb-6">
          Editor Template Materi
        </h1>

        <img
          src={template.thumbnail}
          alt={template.title}
          className="w-full h-72 object-cover rounded-lg mb-6"
        />

        <div className="space-y-5">

          <div>
            <label className="font-semibold">
              Judul
            </label>

            <input
              value={judul}
              onChange={(e)=>setJudul(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 mt-2"
            />
          </div>

          <div>
            <label className="font-semibold">
              Deskripsi
            </label>

            <textarea
              rows={8}
              value={deskripsi}
              onChange={(e)=>setDeskripsi(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 mt-2"
            />
          </div>

          <div className="flex gap-3">

            <button
              className="bg-blue-600 text-white px-6 py-3 rounded-lg"
            >
              Simpan
            </button>

            <button
              className="border px-6 py-3 rounded-lg"
            >
              Cetak PDF
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
