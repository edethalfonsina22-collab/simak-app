import { useState } from "react";
import templates from "../data/templates";
import TemplateCard from "../components/TemplateCard";

export default function TemplateMateri() {
  const [search, setSearch] = useState("");

  const filtered = templates.filter((item) =>
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
            />
          ))
        )}

      </div>

    </div>
  );
}
