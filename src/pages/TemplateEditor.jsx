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
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Kembali
        </button>
      </div>
    );
  }

  const [judul, setJudul] = useState(template.title);
  const [mapel, setMapel] = useState(template.subject);
  const [kelas, setKelas] = useState(template.grade);
  const [fase, setFase] = useState(template.phase);

  const [tujuan, setTujuan] = useState("");
  const [materi, setMateri] = useState("");
  const [kegiatan, setKegiatan] = useState("");
  const [asesmen, setAsesmen] = useState("");
  const [deskripsi, setDeskripsi] = useState(template.description);

  return (
    <div className="max-w-6xl mx-auto p-6">

      <button
        onClick={() => navigate(-1)}
        className="mb-6 border px-4 py-2 rounded-lg hover:bg-gray-100"
      >
        ← Kembali
      </button>

      <div className="bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-3xl font-bold mb-6">
          📚 Editor Template Materi
        </h1>

        <img
          src={template.thumbnail}
          alt={template.title}
          className="w-full h-72 object-cover rounded-lg mb-8"
        />

        <div className="space-y-6">

          <div>
            <label className="block font-semibold mb-2">
              Judul Materi
            </label>

            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-5">

            <div>
              <label className="block font-semibold mb-2">
                Mata Pelajaran
              </label>

              <input
                value={mapel}
                onChange={(e) => setMapel(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">
                Kelas
              </label>

              <input
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">
                Fase
              </label>

              <input
                value={fase}
                onChange={(e) => setFase(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
              />
            </div>

          </div>

          <div>
            <label className="block font-semibold mb-2">
              Tujuan Pembelajaran
            </label>

            <textarea
              rows="4"
              value={tujuan}
              onChange={(e) => setTujuan(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Materi Pembelajaran
            </label>

            <textarea
              rows="8"
              value={materi}
              onChange={(e) => setMateri(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Kegiatan Pembelajaran
            </label>

            <textarea
              rows="6"
              value={kegiatan}
              onChange={(e) => setKegiatan(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Asesmen / Penilaian
            </label>

            <textarea
              rows="5"
              value={asesmen}
              onChange={(e) => setAsesmen(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Deskripsi Singkat
            </label>

            <textarea
              rows="3"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-4">

            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
            >
              💾 Simpan
            </button>

            <button
              className="border px-6 py-3 rounded-lg hover:bg-gray-100"
            >
              📄 Cetak PDF
            </button>

            <button
              onClick={() => navigate("/template-materi")}
              className="border px-6 py-3 rounded-lg hover:bg-gray-100"
            >
              ↩ Kembali ke Template
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
