// src/components/DetailNilaiSiswaModal.jsx
//
// Modal "Detail & Cetak" per siswa untuk halaman Nilai Asesmen / Ijazah.
// Menampilkan & mengedit nilai rapor 6 semester (IV-I s/d VI-II) + nilai
// asesmen untuk 9 mapel (tabel `nilai_rapor_semester`), menghitung
// otomatis Jumlah/Rata-rata/Nilai per mapel, lalu:
// - "Simpan" -> upsert ke `nilai_rapor_semester` DAN ke `nilai_ijazah`
//   (kolom nilai akhir per mapel) supaya halaman Ijazah tetap konsisten.
// - "Cetak" -> window.print() memakai DaftarNilaiKolektifPrintTemplate,
//   1 halaman persis format "DAFTAR NILAI KOLEKTIF".
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MAPEL_IJAZAH } from "./IjazahPrintTemplate";
import DaftarNilaiKolektifPrintTemplate from "./DaftarNilaiKolektifPrintTemplate";
import { jumlahSemester, rataRataSemester, hitungNilaiAkhir, MAPEL_ALIASES } from "../utils/parseNilaiAsesmen";
import { X, Loader2, Save, Printer } from "lucide-react";

const SEMESTER_KEYS = ["iv_1", "iv_2", "v_1", "v_2", "vi_1", "vi_2"];
const SEMESTER_LABELS = ["IV-I", "IV-II", "V-I", "V-II", "VI-I", "VI-II"];

function kosong() {
  const o = {};
  SEMESTER_KEYS.forEach((k) => (o[k] = ""));
  o.nilai_asesmen = "";
  return o;
}

export default function DetailNilaiSiswaModal({ siswa, sekolah, tahunPelajaran, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState({}); // mapel_key -> {iv_1..vi_2, nilai_asesmen}

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("nilai_rapor_semester")
      .select("*")
      .eq("siswa_id", siswa.id)
      .eq("tahun_pelajaran", tahunPelajaran);
    const map = {};
    MAPEL_IJAZAH.forEach((m) => {
      const existing = (data || []).find((d) => d.mapel_key === m.key);
      map[m.key] = existing
        ? {
            iv_1: existing.iv_1 ?? "",
            iv_2: existing.iv_2 ?? "",
            v_1: existing.v_1 ?? "",
            v_2: existing.v_2 ?? "",
            vi_1: existing.vi_1 ?? "",
            vi_2: existing.vi_2 ?? "",
            nilai_asesmen: existing.nilai_asesmen ?? "",
          }
        : kosong();
    });
    setRows(map);
    setLoading(false);
  }

  function ubah(mapelKey, field, value) {
    setSaved(false);
    setRows((prev) => ({
      ...prev,
      [mapelKey]: { ...prev[mapelKey], [field]: value },
    }));
  }

  // detailMap bentuk siap-pakai untuk template cetak & untuk hitung
  // Jumlah/Rata-rata/Nilai di tabel edit.
  const detailMap = useMemo(() => {
    const m = {};
    MAPEL_IJAZAH.forEach((mp) => {
      const r = rows[mp.key] || kosong();
      m[mp.key] = {
        semester: SEMESTER_KEYS.map((k) => (r[k] === "" ? null : Number(r[k]))),
        nilaiAsesmen: r.nilai_asesmen === "" ? null : Number(r.nilai_asesmen),
      };
    });
    return m;
  }, [rows]);

  async function simpan() {
    setSaving(true);
    setError("");
    try {
      const rowsDetail = MAPEL_IJAZAH.map((m) => {
        const r = rows[m.key] || kosong();
        return {
          siswa_id: siswa.id,
          tahun_pelajaran: tahunPelajaran,
          mapel_key: m.key,
          iv_1: r.iv_1 === "" ? null : Number(r.iv_1),
          iv_2: r.iv_2 === "" ? null : Number(r.iv_2),
          v_1: r.v_1 === "" ? null : Number(r.v_1),
          v_2: r.v_2 === "" ? null : Number(r.v_2),
          vi_1: r.vi_1 === "" ? null : Number(r.vi_1),
          vi_2: r.vi_2 === "" ? null : Number(r.vi_2),
          nilai_asesmen: r.nilai_asesmen === "" ? null : Number(r.nilai_asesmen),
        };
      });
      const { error: detailError } = await supabase
        .from("nilai_rapor_semester")
        .upsert(rowsDetail, { onConflict: "siswa_id,tahun_pelajaran,mapel_key" });
      if (detailError) throw detailError;

      // Sinkronkan nilai akhir hasil hitungan ke nilai_ijazah supaya
      // halaman Ijazah (rekap kolektif) otomatis ikut ter-update.
      const rowIjazah = {
        siswa_id: siswa.id,
        tahun_pelajaran: tahunPelajaran,
        ...MAPEL_ALIASES.reduce((acc, m) => {
          const d = detailMap[m.key];
          const nilaiAkhir = hitungNilaiAkhir(d.semester, d.nilaiAsesmen);
          acc[m.key] = nilaiAkhir !== null ? Math.round(nilaiAkhir * 100) / 100 : null;
          return acc;
        }, {}),
      };
      const { error: ijazahError } = await supabase
        .from("nilai_ijazah")
        .upsert([rowIjazah], { onConflict: "siswa_id,tahun_pelajaran" });
      if (ijazahError) throw ijazahError;

      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // TIDAK diberi class "no-print" di wrapper ini — .no-print pakai
  // display:none!important, yang kalau dipasang di sini akan ikut
  // menyembunyikan DaftarNilaiKolektifPrintTemplate (.print-only) yang ada
  // di dalamnya saat window.print() dipanggil. Aturan
  // `body * { visibility:hidden }` bawaan @media print (index.css) sudah
  // cukup untuk menyembunyikan modal ini saat mencetak, karena .print-only
  // di dalamnya me-reset visibility ke visible + position:fixed supaya
  // tetap tampil lepas dari sisa halaman.
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Detail Nilai — {siswa.nama_lengkap}</h2>
            <p className="text-sm text-ink-700/60">
              NIS {siswa.nis || "-"} · NISN {siswa.nisn || "-"} · Tahun Pelajaran {tahunPelajaran}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p>Memuat...</p>
        ) : (
          <>
            <div className="card overflow-x-auto mb-4">
              <table className="table-shell text-xs">
                <thead>
                  <tr>
                    <th>Mata Pelajaran</th>
                    {SEMESTER_LABELS.map((l) => (
                      <th key={l} className="text-right">{l}</th>
                    ))}
                    <th className="text-right">Jumlah</th>
                    <th className="text-right">Rata²</th>
                    <th className="text-right">Nilai Asesmen</th>
                    <th className="text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {MAPEL_IJAZAH.map((m) => {
                    const r = rows[m.key] || kosong();
                    const d = detailMap[m.key];
                    const rata = rataRataSemester(d.semester);
                    const nilaiAkhir = hitungNilaiAkhir(d.semester, d.nilaiAsesmen);
                    return (
                      <tr key={m.key}>
                        <td className="whitespace-nowrap">{m.label}</td>
                        {SEMESTER_KEYS.map((k) => (
                          <td key={k} className="text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-14 text-right rounded border border-ink-900/15 px-1 py-1 text-xs"
                              value={r[k]}
                              onChange={(e) => ubah(m.key, k, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="text-right font-semibold">{jumlahSemester(d.semester).toFixed(2)}</td>
                        <td className="text-right font-semibold">{rata.toFixed(2)}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            className="w-14 text-right rounded border border-ink-900/15 px-1 py-1 text-xs"
                            value={r.nilai_asesmen}
                            onChange={(e) => ubah(m.key, "nilai_asesmen", e.target.value)}
                          />
                        </td>
                        <td className="text-right font-semibold">
                          {nilaiAkhir === null ? "-" : nilaiAkhir.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex items-center gap-3 mb-6">
              <button className="btn-primary" onClick={simpan} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Nilai
              </button>
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Cetak Daftar Nilai Kolektif
              </button>
              {saved && <span className="text-sm text-sage-600">Tersimpan.</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700/60 mb-2">Pratinjau Cetak</label>
              <div className="border border-ink-900/10 rounded-lg overflow-auto" style={{ maxHeight: "70vh" }}>
                <DaftarNilaiKolektifPrintTemplate
                  siswa={siswa}
                  sekolah={sekolah}
                  tahunPelajaran={tahunPelajaran}
                  detailMap={detailMap}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
