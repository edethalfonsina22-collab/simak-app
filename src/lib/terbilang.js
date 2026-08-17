const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']

function terbilangAngka(n) {
  n = Math.floor(n)
  if (n < 10) return SATUAN[n]
  if (n < 20) return n === 10 ? 'sepuluh' : n === 11 ? 'sebelas' : SATUAN[n - 10] + ' belas'
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh${n % 10 ? ' ' + SATUAN[n % 10] : ''}`
  if (n < 200) return `seratus${n % 100 ? ' ' + terbilangAngka(n % 100) : ''}`
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} ratus${n % 100 ? ' ' + terbilangAngka(n % 100) : ''}`
  if (n < 2000) return `seribu${n % 1000 ? ' ' + terbilangAngka(n % 1000) : ''}`
  if (n < 1000000) return `${terbilangAngka(Math.floor(n / 1000))} ribu${n % 1000 ? ' ' + terbilangAngka(n % 1000) : ''}`
  if (n < 1000000000) return `${terbilangAngka(Math.floor(n / 1000000))} juta${n % 1000000 ? ' ' + terbilangAngka(n % 1000000) : ''}`
  return `${terbilangAngka(Math.floor(n / 1000000000))} miliar${n % 1000000000 ? ' ' + terbilangAngka(n % 1000000000) : ''}`
}

/**
 * Mengubah angka rupiah menjadi terbilang, contoh:
 * terbilangRupiah(150000) -> "seratus lima puluh ribu rupiah"
 */
export function terbilangRupiah(angka) {
  const n = Math.round(Number(angka) || 0)
  if (n === 0) return 'nol rupiah'
  const hasil = terbilangAngka(n).trim().replace(/\s+/g, ' ')
  return `${hasil} rupiah`
}
