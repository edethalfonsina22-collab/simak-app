// KalenderPendidikan.jsx
// Komponen kalender pendidikan (SD/MI) — Vite + React + Supabase
//
// CARA PAKAI:
// 1. Taruh file ini + kalenderPendidikan.js di folder src/ (mis. src/components/).
// 2. Sesuaikan import { supabase } di bawah ini dengan lokasi client Supabase
//    kamu (mis. src/lib/supabaseClient.js atau src/supabaseClient.js).
// 3. (Opsional, untuk fitur edit tersimpan permanen) Buat tabel di Supabase:
//
//    create table kalender_overrides (
//      tanggal date primary key,
//      kode text not null,
//      keterangan text not null,
//      updated_at timestamptz default now()
//    );
//
//    Jika tabel ini belum ada, komponen tetap jalan (mode edit lokal saja,
//    perubahan tidak tersimpan setelah refresh) — akan muncul peringatan kecil.
//
// 4. Pakai di halaman/App kamu:
//      import KalenderPendidikan from './components/KalenderPendidikan';
//      <KalenderPendidikan editable={true} />

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // sesuaikan path ini dengan project kamu
import {
  TAHUN_AJARAN,
  BULAN,
  SEMESTER,
  JML_HBE,
  KETERANGAN,
  toISODate,
  jumlahHariDalamBulan,
  getStatusTanggal,
} from './kalenderPendidikan'; // sesuaikan path ini jika file datanya di folder lain

const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function KalenderPendidikan({ editable = true }) {
  const [bulanIndex, setBulanIndex] = useState(0); // index ke array BULAN
  const [overrides, setOverrides] = useState({}); // { 'YYYY-MM-DD': {kode, keterangan} }
  const [loading, setLoading] = useState(true);
  const [supabaseReady, setSupabaseReady] = useState(true);
  const [editingDate, setEditingDate] = useState(null); // isoDate sedang diedit
  const [saving, setSaving] = useState(false);

  const bulanAktif = BULAN[bulanIndex];

  // ---- Ambil override dari Supabase saat komponen dimuat ----
  useEffect(() => {
    let mounted = true;

    async function loadOverrides() {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('kalender_overrides').select('*');
        if (error) throw error;
        if (!mounted) return;
        const map = {};
        (data || []).forEach((row) => {
          map[row.tanggal] = { kode: row.kode, keterangan: row.keterangan };
        });
        setOverrides(map);
        setSupabaseReady(true);
      } catch (err) {
        console.warn('Tidak bisa memuat kalender_overrides dari Supabase:', err.message);
        if (mounted) setSupabaseReady(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOverrides();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- Bangun grid hari untuk bulan aktif ----
  const grid = useMemo(() => {
    const { tahun, bulan } = bulanAktif;
    const totalHari = jumlahHariDalamBulan(tahun, bulan);
    const hariPertama = new Date(tahun, bulan - 1, 1).getDay(); // 0 = Minggu

    const sel = [];
    for (let i = 0; i < hariPertama; i++) sel.push(null); // padding kosong di awal
    for (let tgl = 1; tgl <= totalHari; tgl++) {
      const iso = toISODate(tahun, bulan, tgl);
      sel.push({ tanggal: tgl, iso, status: getStatusTanggal(iso, overrides) });
    }
    return sel;
  }, [bulanAktif, overrides]);

  const semesterAktif = SEMESTER.GANJIL.bulan.includes(bulanAktif.key) ? SEMESTER.GANJIL : SEMESTER.GENAP;

  // ---- Simpan / hapus override satu tanggal ----
  async function simpanStatus(iso, kode, keteranganText) {
    setSaving(true);
    const kodeTrim = kode?.trim();

    // Hapus override -> kembali ke default otomatis (Minggu/Libur Umum/Kegiatan/hari biasa)
    if (!kodeTrim) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[iso];
        return next;
      });
      if (supabaseReady) {
        await supabase.from('kalender_overrides').delete().eq('tanggal', iso);
      }
      setSaving(false);
      setEditingDate(null);
      return;
    }

    const value = { kode: kodeTrim, keterangan: keteranganText || KETERANGAN[kodeTrim]?.label || kodeTrim };
    setOverrides((prev) => ({ ...prev, [iso]: value }));

    if (supabaseReady) {
      const { error } = await supabase
        .from('kalender_overrides')
        .upsert({ tanggal: iso, kode: value.kode, keterangan: value.keterangan });
      if (error) console.warn('Gagal menyimpan ke Supabase:', error.message);
    }

    setSaving(false);
    setEditingDate(null);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h2 style={styles.title}>Kalender Pendidikan SD/MI — Tahun Pelajaran {TAHUN_AJARAN}</h2>
        {!supabaseReady && (
          <p style={styles.warning}>
            ⚠️ Tabel <code>kalender_overrides</code> belum tersedia di Supabase, perubahan hanya tersimpan sementara di
            browser ini (hilang saat refresh).
          </p>
        )}
      </div>

      {/* Navigasi bulan */}
      <div style={styles.monthNav}>
        <button style={styles.navBtn} onClick={() => setBulanIndex((i) => Math.max(0, i - 1))} disabled={bulanIndex === 0}>
          ‹ Sebelumnya
        </button>
        <select
          style={styles.monthSelect}
          value={bulanIndex}
          onChange={(e) => setBulanIndex(Number(e.target.value))}
        >
          {BULAN.map((b, i) => (
            <option key={b.key} value={i}>
              {b.nama} {b.tahun}
            </option>
          ))}
        </select>
        <button
          style={styles.navBtn}
          onClick={() => setBulanIndex((i) => Math.min(BULAN.length - 1, i + 1))}
          disabled={bulanIndex === BULAN.length - 1}
        >
          Berikutnya ›
        </button>
      </div>

      <p style={styles.subInfo}>
        {semesterAktif.label} &middot; Hari Belajar Efektif bulan ini:{' '}
        <strong>{JML_HBE[bulanAktif.key]}</strong> hari &middot; Total HBE semester: <strong>{semesterAktif.totalHbe}</strong>
      </p>

      {loading ? (
        <p>Memuat kalender…</p>
      ) : (
        <>
          {/* Grid kalender */}
          <div style={styles.grid}>
            {NAMA_HARI.map((h) => (
              <div key={h} style={styles.dayHeader}>
                {h}
              </div>
            ))}
            {grid.map((cell, idx) =>
              cell === null ? (
                <div key={`empty-${idx}`} style={styles.emptyCell} />
              ) : (
                <button
                  key={cell.iso}
                  onClick={() => editable && setEditingDate(cell.iso)}
                  style={{
                    ...styles.dayCell,
                    background: cell.status ? KETERANGAN[cell.status.kode]?.color || '#ccc' : '#ffffff',
                    color: cell.status ? KETERANGAN[cell.status.kode]?.textColor || '#000' : '#222',
                    cursor: editable ? 'pointer' : 'default',
                  }}
                  title={cell.status ? cell.status.keterangan : 'Hari sekolah'}
                >
                  <span style={styles.dayNumber}>{cell.tanggal}</span>
                  {cell.status && <span style={styles.dayCode}>{cell.status.kode}</span>}
                </button>
              )
            )}
          </div>

          {/* Legenda */}
          <div style={styles.legend}>
            <h4 style={{ margin: '16px 0 8px' }}>Keterangan</h4>
            <div style={styles.legendGrid}>
              {Object.entries(KETERANGAN).map(([kode, v]) => (
                <div key={kode} style={styles.legendItem}>
                  <span style={{ ...styles.legendSwatch, background: v.color }} />
                  <span>
                    <strong>{kode}</strong> — {v.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal edit sederhana */}
      {editingDate && (
        <EditModal
          iso={editingDate}
          current={overrides[editingDate]}
          saving={saving}
          onClose={() => setEditingDate(null)}
          onSave={simpanStatus}
        />
      )}
    </div>
  );
}

function EditModal({ iso, current, saving, onClose, onSave }) {
  const [kode, setKode] = useState(current?.kode || '');
  const [keterangan, setKeterangan] = useState(current?.keterangan || '');

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit tanggal {iso}</h3>

        <label style={styles.label}>Kode keterangan</label>
        <select style={styles.input} value={kode} onChange={(e) => setKode(e.target.value)}>
          <option value="">— Hari sekolah biasa (hapus status) —</option>
          {Object.entries(KETERANGAN).map(([k, v]) => (
            <option key={k} value={k}>
              {k} — {v.label}
            </option>
          ))}
        </select>

        <label style={styles.label}>Keterangan (opsional, override teks)</label>
        <input
          style={styles.input}
          type="text"
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Kosongkan untuk pakai label default"
        />

        <div style={styles.modalActions}>
          <button style={styles.btnSecondary} onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button style={styles.btnPrimary} onClick={() => onSave(iso, kode, keterangan)} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { maxWidth: 900, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: 8 },
  title: { fontSize: 20, marginBottom: 4 },
  warning: { fontSize: 13, color: '#8a6d00', background: '#fff8e1', padding: 8, borderRadius: 6 },
  monthNav: { display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' },
  navBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' },
  monthSelect: { padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', flex: 1 },
  subInfo: { fontSize: 14, color: '#444', marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  dayHeader: { textAlign: 'center', fontWeight: 600, fontSize: 13, padding: '4px 0', color: '#555' },
  emptyCell: { minHeight: 56 },
  dayCell: {
    minHeight: 56,
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    fontSize: 13,
  },
  dayNumber: { fontWeight: 600 },
  dayCode: { fontSize: 10, marginTop: 2 },
  legend: { marginTop: 16, borderTop: '1px solid #eee', paddingTop: 8 },
  legendGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, fontSize: 13 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 3, display: 'inline-block', flexShrink: 0 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalBox: { background: '#fff', borderRadius: 8, padding: 20, width: 320, maxWidth: '90vw' },
  label: { display: 'block', fontSize: 13, marginTop: 10, marginBottom: 4, color: '#555' },
  input: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btnPrimary: { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#1e88e5', color: '#fff', cursor: 'pointer' },
  btnSecondary: { padding: '8px 14px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' },
};
