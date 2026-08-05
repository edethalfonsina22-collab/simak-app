import { useState } from "react";
import templates from "../data/templates";
import TemplateCard from "../components/TemplateCard";

export default function TemplateMateri() {
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const filtered = templates.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subject.toLowerCase().includes(search.toLowerCase())
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
          <div className="col-span-full text-center text-gray-500 py-12">
            Tidak ada template ditemukan.
          </div>
        ) : (
          filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setSelectedTemplate(template)}
            />
          ))
        )}
      </div>

      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
            <h2 className="text-2xl font-bold mb-4">
              {selectedTemplate.title}
            </h2>

            <img
              src={selectedTemplate.thumbnail}
              alt={selectedTemplate.title}
              className="w-full h-60 object-cover rounded-lg mb-4"
            />

            <div className="space-y-2">
              <p>
                <strong>Mapel:</strong> {selectedTemplate.subject}
              </p>

              <p>
                <strong>Kelas:</strong> {selectedTemplate.grade}
              </p>

              <p>
                <strong>Fase:</strong> {selectedTemplate.phase}
              </p>

              <p>
                <strong>Jenis:</strong> {selectedTemplate.type}
              </p>

              <p className="text-gray-600 mt-3">
                {selectedTemplate.description}
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 border rounded-lg"
              >
                Tutup
              </button>

              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                Gunakan Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
