import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

const [loading, setLoading] = useState(true);
const [template, setTemplate] = useState(null);

const [judul, setJudul] = useState("");
const [mapel, setMapel] = useState("");
const [kelas, setKelas] = useState("");
const [fase, setFase] = useState("");

const [tujuan, setTujuan] = useState("");
const [materi, setMateri] = useState("");
const [kegiatan, setKegiatan] = useState("");
const [asesmen, setAsesmen] = useState("");
const [deskripsi, setDeskripsi] = useState("");

const [activeTab, setActiveTab] = useState("materi");
  useEffect(() => {
    loadTemplate();
  }, []);

  async function loadTemplate() {
    setLoading(true);

    const { data, error } = await supabase
      .from("materi_pembelajaran")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      alert(error.message);
      navigate("/template-materi");
      return;
    }

    setTemplate(data);

    setJudul(data.judul || "");
    setMapel(data.mapel || "");
    setKelas(data.kelas || "");
    setFase(data.fase || "");
    setTujuan(data.tujuan || "");
    setMateri(data.materi || "");
    setKegiatan(data.kegiatan || "");
    setAsesmen(data.asesmen || "");
    setDeskripsi(data.deskripsi || "");

    setLoading(false);
  }

  async function simpanMateri() {
    const { error } = await supabase
      .from("materi_saya")
      .insert([
        {
          user_id: session.user.id,
          template_id: template.id,
          judul,
          mapel,
          kelas,
          fase,
          tujuan,
          materi,
          kegiatan,
          asesmen,
          deskripsi,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("✅ Materi berhasil disimpan");

    navigate("/materi-saya");
  }

  if (loading) {
    return (
      <div className="p-10 text-center">
        Memuat template...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">

      <button
        onClick={() => navigate(-1)}
        className="mb-6 border px-4 py-2 rounded-lg hover:bg-gray-100"
      >
        ← Kembali
      </button>

      <div className="bg-white rounded-xl shadow-lg p-8">

<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">

  <div>
    <h1 className="text-3xl font-bold">
      📚 Editor Materi Pembelajaran
    </h1>

    <p className="text-gray-500 mt-1">
      Buat, edit, dan simpan materi pembelajaran.
    </p>
  </div>

  <div className="flex flex-wrap gap-3 mt-5 lg:mt-0">

    <button
      onClick={simpanMateri}
      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
    >
      💾 Simpan
    </button>

    <button
      className="border px-5 py-2 rounded-lg hover:bg-gray-100"
    >
      📄 PDF
    </button>

    <button
      className="border px-5 py-2 rounded-lg hover:bg-gray-100"
    >
      📘 Word
    </button>

    <button
      className="border px-5 py-2 rounded-lg hover:bg-gray-100"
    >
      🎞 PPT
    </button>

    <button
      className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg"
    >
      🤖 AI
    </button>

  </div>

</div>

        <img
          src={template.thumbnail}
          alt={judul}
          className="w-full h-72 object-cover rounded-lg mb-8"
        />
        <div className="border-b mb-6">
  <div className="flex flex-wrap gap-2">

    <button
      onClick={() => setActiveTab("materi")}
      className={`px-4 py-2 rounded-t-lg ${
        activeTab === "materi"
          ? "bg-blue-600 text-white"
          : "bg-gray-100"
      }`}
    >
      📖 Materi
    </button>

    <button
      onClick={() => setActiveTab("tujuan")}
      className={`px-4 py-2 rounded-t-lg ${
        activeTab === "tujuan"
          ? "bg-blue-600 text-white"
          : "bg-gray-100"
      }`}
    >
      🎯 Tujuan
    </button>

    <button
      onClick={() => setActiveTab("kegiatan")}
      className={`px-4 py-2 rounded-t-lg ${
        activeTab === "kegiatan"
          ? "bg-blue-600 text-white"
          : "bg-gray-100"
      }`}
    >
      📝 Kegiatan
    </button>

    <button
      onClick={() => setActiveTab("asesmen")}
      className={`px-4 py-2 rounded-t-lg ${
        activeTab === "asesmen"
          ? "bg-blue-600 text-white"
          : "bg-gray-100"
      }`}
    >
      ✅ Asesmen
    </button>

    <button
      onClick={() => setActiveTab("lampiran")}
      className={`px-4 py-2 rounded-t-lg ${
        activeTab === "lampiran"
          ? "bg-blue-600 text-white"
          : "bg-gray-100"
      }`}
    >
      📎 Lampiran
    </button>

  </div>
</div>

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

          {activeTab === "tujuan" && (
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
          )}

          {activeTab === "materi" && (
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
          )}

          {activeTab === "kegiatan" && (
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
          )}

          {activeTab === "asesmen" && (
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
          )}

          {activeTab === "lampiran" && (
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
          )}

            <button
              onClick={simpanMateri}
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
