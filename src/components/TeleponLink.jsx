import { useState, useRef, useEffect } from 'react'
import { Phone, MessageCircle } from 'lucide-react'

// Bersihkan nomor: hilangkan spasi, tanda hubung, kurung, dsb — sisakan angka dan tanda + saja.
function bersihkanNomor(nomor) {
  if (!nomor) return ''
  return String(nomor).trim().replace(/[^\d+]/g, '')
}

// Ubah ke format internasional tanpa tanda + untuk wa.me (0812... -> 62812..., +62812... -> 62812...)
function nomorWhatsApp(nomorBersih) {
  let n = nomorBersih.replace(/^\+/, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  return n
}

/**
 * Ikon telepon kecil — diklik akan membuka dropdown pilihan "Telepon" atau "WhatsApp".
 * Kalau nomor kosong/tidak valid, komponen ini tidak menampilkan apa-apa.
 *
 * Cara pakai (sama seperti sebelumnya, tidak ada perubahan props):
 *   <TeleponLink nomor={siswa.no_hp_orang_tua} />
 *   <TeleponLink nomor={guru.no_hp} className="ml-1" />
 */
export default function TeleponLink({ nomor, className = '' }) {
  const bersih = bersihkanNomor(nomor)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!bersih) return null

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation() // supaya tidak ikut trigger klik baris tabel, dll
          setOpen((o) => !o)
        }}
        title={`Hubungi ${nomor}`}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage-500/10 text-sage-600 hover:bg-sage-500/20 transition-colors shrink-0 ${className}`}
      >
        <Phone size={13} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1.5 bg-white rounded-lg shadow-lg border border-ink-900/[0.08] py-1 min-w-[9.5rem] overflow-hidden"
        >
          <a
            href={`tel:${bersih}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink-900 hover:bg-ink-900/[0.04] transition-colors"
          >
            <Phone size={14} className="text-sage-600 shrink-0" /> Telepon
          </a>
          <a
            href={`https://wa.me/${nomorWhatsApp(bersih)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink-900 hover:bg-ink-900/[0.04] transition-colors"
          >
            <MessageCircle size={14} className="text-emerald-600 shrink-0" /> WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
