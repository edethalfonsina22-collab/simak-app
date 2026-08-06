// Utility untuk menyimpan presensi sementara di IndexedDB saat offline,
// lalu mengirimnya otomatis ke Supabase saat koneksi kembali.

const DB_NAME = 'simak-kepsek-offline'
const DB_VERSION = 1
const STORE_NAME = 'antrian_presensi'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Tambahkan satu batch presensi ke antrian lokal
export async function tambahAntrian(item) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add({ ...item, dibuat_pada: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Ambil semua item yang masih menunggu dikirim
export async function ambilAntrian() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Hapus satu item dari antrian setelah berhasil terkirim
async function hapusAntrian(localId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(localId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Kirim semua antrian ke Supabase satu per satu.
// Berhenti begitu ada yang gagal (misal koneksi putus lagi di tengah jalan),
// sisanya tetap tersimpan untuk dicoba lagi nanti.
export async function sinkronAntrian(supabase) {
  const items = await ambilAntrian()
  let berhasil = 0
  for (const item of items) {
    const { table, conflictCol, rows } = item
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictCol })
    if (!error) {
      await hapusAntrian(item.localId)
      berhasil++
    } else {
      break
    }
  }
  return berhasil
}
