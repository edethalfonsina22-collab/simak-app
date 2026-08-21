#!/usr/bin/env python3
"""
pdf_ke_csv_bku.py
Konversi PDF "Buku Kas Umum (Pembantu Bank / Pembantu Kas / Pembantu Pajak)"
format ARKAS ke CSV siap-impor untuk komponen BkuImportModal.jsx.

Cara pakai (lokal):
    python3 pdf_ke_csv_bku.py input.pdf output.csv

Cara pakai (Google Colab):
    1. Upload file ini dan PDF sumbernya ke Colab
    2. Jalankan:
         !pip install pdfplumber -q
         !python3 pdf_ke_csv_bku.py "bku-bank-output.pdf" "bku.csv"
    3. Download bku.csv, lalu upload lewat tombol
       "Input Data Massal BKU" di halaman Keuangan.

Kolom CSV yang dihasilkan (kolom di luar ini dibaca sebagai info tambahan
dan diabaikan oleh BkuImportModal.jsx):
    tanggal, no_bukti, uraian, penerimaan, pengeluaran,
    kode_kegiatan, kode_rekening, saldo_dokumen

Cara kerja / asumsi format sumber (hasil ekstraksi teks per baris dari
pdfplumber, BUKAN tampilan visual PDF):
  - Baris data utama selalu diawali tanggal format DD-MM-YYYY.
  - Setelah tanggal, urutan token opsional adalah:
      [kode_kegiatan]  contoh "05.02.03." (pola: dd.dd.dd.)
      [no_bukti]       contoh "BNU01" / "BBU02" (pola: 2-4 huruf + 1-4 angka)
      uraian           sisa teks sampai sebelum 3 angka terakhir
      penerimaan pengeluaran saldo   -> selalu 3 token angka terakhir
  - Untuk baris yang terkait rekening anggaran, kode_rekening PECAH jadi
    2 baris terpisah karena pembungkusan kolom di PDF:
      baris SEBELUM tanggal  -> prefix kode_rekening, contoh "5.1.02.03.05.00"
      baris SESUDAH baris utama -> suffix 1-4 digit, contoh "01"
    Skrip ini menggabungkan prefix+suffix jadi satu kode_rekening utuh.
  - Baris lain (judul, header kolom, "Halaman X dari Y", baris "Jumlah",
    blok tanda tangan, dst.) otomatis diabaikan karena tidak cocok pola
    tanggal / prefix / suffix di atas.

PENTING: skrip ini dibuat & diuji berdasarkan struktur dokumen BKU Pembantu
Bank ARKAS yang sudah dicontohkan. Kalau sekolah lain punya varian
tata letak PDF yang agak berbeda (mis. Pembantu Kas / Pembantu Pajak),
jalankan dulu fungsi `debug_dump_lines()` di bagian bawah untuk melihat
baris mentahnya sebelum melaporkan hasil salah.
"""

import sys
import re
import csv

try:
    import pdfplumber
except ImportError:
    print("Library 'pdfplumber' belum terpasang. Jalankan: pip install pdfplumber")
    sys.exit(1)

DATE_RE = re.compile(r'^\d{2}-\d{2}-\d{4}$')
KODE_KEGIATAN_RE = re.compile(r'^\d{2}\.\d{2}\.\d{2}\.$')
NO_BUKTI_RE = re.compile(r'^[A-Za-z]{2,4}\d{1,4}$')
KODE_REKENING_PREFIX_RE = re.compile(r'^\d+(\.\d+){2,}$')
SUFFIX_RE = re.compile(r'^\d{1,4}$')
AMOUNT_RE = re.compile(r'^[\d.]+$')

# Baris-baris yang jelas bukan data (header/footer berulang) — dipakai
# hanya untuk dokumentasi; secara teknis baris ini sudah otomatis
# terlewati karena tidak cocok pola apa pun di atas.
NOISE_PREFIXES = (
    'BKU Pembantu', 'Jumlah', 'Pada hari ini', 'Saldo Bank :',
    'Menyetujui', 'Kepala Sekolah', 'Bendahara', 'NIP.',
    'TANGGAL', 'KODE', 'KEGIATAN', 'B U K U', 'NPSN', 'Nama Sekolah',
    'Desa/Kecamatan', 'Kabupaten', 'Provinsi', 'Sumber Dana', 'BKU -',
    'TAHUN :',
)


def extract_lines(pdf_path):
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            for raw in text.split('\n'):
                line = raw.strip()
                if line:
                    lines.append(line)
    return lines


def to_number(token):
    return token.replace('.', '')


def normalize_tanggal(ddmmyyyy):
    d, m, y = ddmmyyyy.split('-')
    return f"{y}-{m}-{d}"


def parse_main_line(line):
    """Parse satu baris data utama (sudah dipastikan diawali tanggal).
    Return dict field-field, atau None kalau baris ternyata tidak valid
    (misal jumlah token kurang dari 4: tanggal + uraian + 3 angka)."""
    tokens = line.split()
    if len(tokens) < 4:
        return None

    tanggal_raw = tokens[0]
    idx = 1
    kode_kegiatan = None
    if idx < len(tokens) and KODE_KEGIATAN_RE.match(tokens[idx]):
        kode_kegiatan = tokens[idx]
        idx += 1

    no_bukti = None
    if idx < len(tokens) and NO_BUKTI_RE.match(tokens[idx]):
        no_bukti = tokens[idx]
        idx += 1

    if len(tokens) - idx < 4:  # butuh minimal uraian + 3 angka
        return None

    amount_tokens = tokens[-3:]
    if not all(AMOUNT_RE.match(t) for t in amount_tokens):
        return None

    uraian_tokens = tokens[idx:-3]
    uraian = ' '.join(uraian_tokens).strip()
    if not uraian:
        return None

    penerimaan_raw, pengeluaran_raw, saldo_raw = amount_tokens

    return {
        'tanggal': normalize_tanggal(tanggal_raw),
        'no_bukti': no_bukti or '',
        'uraian': uraian,
        'penerimaan': to_number(penerimaan_raw),
        'pengeluaran': to_number(pengeluaran_raw),
        'saldo_dokumen': to_number(saldo_raw),
        'kode_kegiatan': kode_kegiatan or '',
        'kode_rekening': '',  # diisi belakangan kalau ada prefix/suffix
    }


def parse_bku(pdf_path):
    lines = extract_lines(pdf_path)
    records = []
    pending_prefix = None
    awaiting_suffix_for = None  # index di `records` yang menunggu suffix

    for line in lines:
        first_token = line.split(' ', 1)[0]

        if DATE_RE.match(first_token):
            rec = parse_main_line(line)
            if rec is None:
                # baris diawali tanggal tapi tidak berhasil di-parse
                # (kemungkinan format tak terduga) -> lewati, jangan
                # sampai bikin baris CSV yang salah.
                pending_prefix = None
                awaiting_suffix_for = None
                continue
            if pending_prefix is not None:
                rec['kode_rekening'] = pending_prefix
                awaiting_suffix_for = len(records)
                pending_prefix = None
            else:
                awaiting_suffix_for = None
            records.append(rec)
            continue

        if KODE_REKENING_PREFIX_RE.match(line):
            pending_prefix = line
            continue

        if awaiting_suffix_for is not None and SUFFIX_RE.match(line):
            records[awaiting_suffix_for]['kode_rekening'] += line
            awaiting_suffix_for = None
            continue

        # baris lain (header/footer/noise) -> lewati, dan batalkan status
        # "menunggu suffix" supaya tidak salah menempel ke baris noise.
        awaiting_suffix_for = None

    return records


def write_csv(records, out_path):
    fieldnames = [
        'tanggal', 'no_bukti', 'uraian', 'penerimaan', 'pengeluaran',
        'kode_kegiatan', 'kode_rekening', 'saldo_dokumen',
    ]
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            writer.writerow(r)


def debug_dump_lines(pdf_path, limit=60):
    """Bantuan debugging: cetak baris mentah hasil ekstraksi supaya bisa
    dicocokkan manual kalau parser meleset di dokumen lain."""
    for i, line in enumerate(extract_lines(pdf_path)[:limit]):
        print(f"{i:03d}: {line}")


def main():
    if len(sys.argv) != 3:
        print("Pemakaian: python3 pdf_ke_csv_bku.py input.pdf output.csv")
        sys.exit(1)

    pdf_path, out_path = sys.argv[1], sys.argv[2]
    records = parse_bku(pdf_path)

    total_penerimaan = sum(int(r['penerimaan']) for r in records)
    total_pengeluaran = sum(int(r['pengeluaran']) for r in records)

    write_csv(records, out_path)

    print(f"Selesai. {len(records)} baris ditulis ke {out_path}")
    print(f"Total penerimaan (hasil parsing): {total_penerimaan:,}".replace(',', '.'))
    print(f"Total pengeluaran (hasil parsing): {total_pengeluaran:,}".replace(',', '.'))
    print("Bandingkan dua angka total di atas dengan baris 'Jumlah' di PDF asli")
    print("untuk memastikan tidak ada baris yang terlewat / salah parse.")


if __name__ == '__main__':
    main()
