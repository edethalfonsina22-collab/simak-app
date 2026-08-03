import { Phone } from 'lucide-react'

// Bersihkan nomor: hilangkan spasi, tanda hubung, kurung, dsb — sisakan angka dan tanda + saja.
function bersihkanNomor(nomor) {
  if (!nomor) return ''
  return String(nomor).trim().replace(/[^\d+]/g, '')
}

/**
 * Ikon telepon kecil yang bisa diklik untuk langsung memanggil nomor tsb (tel:...).
 * Kalau nomor kosong/tidak valid, komponen ini tidak menampilkan apa-apa.
 *
 * Cara pakai:
 *   <TeleponLink nomor={siswa.no_hp_orang_tua} />
 *   <TeleponLink nomor={guru.no_hp} className="ml-1" />
 */
export default function TeleponLink({ nomor, className = '' }) {
  const bersih = bersihkanNomor(nomor)
  if (!bersih) return null

  return (
    <a
      href={`tel:${bersih}`}
      onClick={(e) => e.stopPropagation()} // supaya tidak ikut trigger klik baris tabel, dll
      title={`Telepon ${nomor}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage-500/10 text-sage-600 hover:bg-sage-500/20 transition-colors shrink-0 ${className}`}
    >
      <Phone size={13} />
    </a>
  )
}
