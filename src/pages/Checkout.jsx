import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../lib/CartContext";

// URL yang disarankan: /toko/:id/checkout
//
// Alur (SETELAH integrasi Midtrans):
// 1. Ambil isi keranjang untuk toko ini dari CartContext
// 2. Panggil fungsi database "buat_pesanan" -> membuat baris di
//    pesanan + pesanan_item dan mengurangi stok (seperti sebelumnya).
// 3. BARU: panggil Edge Function "create-transaction" dengan
//    pesanan_id yang baru dibuat -> dapat snap_token dari Midtrans.
// 4. BARU: buka popup pembayaran Snap pakai snap_token itu.
// 5. Keranjang baru dikosongkan & diarahkan ke halaman sukses SETELAH
//    pembeli benar-benar menyelesaikan pembayaran (onSuccess/onPending),
//    bukan langsung setelah pesanan dibuat seperti sebelumnya — karena
//    sekarang pesanan bisa dibuat tapi belum tentu dibayar.

// Ganti ke Client Key PRODUCTION dan URL produksi Snap.js saat go-live:
// https://app.midtrans.com/snap/snap.js
const SNAP_JS_URL = "https://app.sandbox.midtrans.com/snap/snap.js";
const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

// Muat script Snap.js sekali saja (kalau sudah ada di halaman, tidak diulang)
function loadSnapScript() {
  return new Promise((resolve, reject) => {
    if (window.snap) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${SNAP_JS_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = SNAP_JS_URL;
    script.setAttribute("data-client-key", MIDTRANS_CLIENT_KEY);
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const { id: tokoId } = useParams();
  const navigate = useNavigate();
  const { getCartItems, clearCart } = useCart();

  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [snapReady, setSnapReady] = useState(false);

  const items = getCartItems(tokoId);

  // Muat Snap.js begitu halaman Checkout dibuka, supaya saat tombol
  // "Buat Pesanan" diklik popup sudah siap tampil tanpa jeda.
  useEffect(() => {
    loadSnapScript()
      .then(() => setSnapReady(true))
      .catch(() => setErrorMsg("Gagal memuat layanan pembayaran. Coba muat ulang halaman."));
  }, []);

  const formatRupiah = (angka) => {
    const n = Number(angka) || 0;
    return n.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    });
  };

  const total = items.reduce((sum, item) => sum + item.harga * item.qty, 0);

  const handleCheckout = async () => {
    setErrorMsg("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMsg("Anda harus login untuk melanjutkan checkout.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Keranjang masih kosong.");
      return;
    }
    if (!snapReady) {
      setErrorMsg("Layanan pembayaran belum siap, tunggu sebentar lalu coba lagi.");
      return;
    }

    setLoading(true);

    // 1) Buat pesanan seperti sebelumnya (stok berkurang di sini)
    const { data: pesananId, error } = await supabase.rpc("buat_pesanan", {
      p_toko_id: tokoId,
      p_items: items.map((item) => ({ barang_id: item.id, qty: item.qty })),
      p_catatan: catatan || null,
    });

    if (error) {
      setLoading(false);
      setErrorMsg("Checkout gagal: " + error.message);
      return;
    }

    // 2) Minta snap_token dari Edge Function create-transaction.
    // supabase.functions.invoke otomatis menyertakan token login user yang
    // sedang aktif, jadi create-transaction bisa memverifikasi pemiliknya.
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "create-transaction",
      { body: { pesanan_id: pesananId } },
    );

    setLoading(false);

    if (fnError || !fnData?.snap_token) {
      setErrorMsg(
        "Pesanan sudah dibuat, tapi gagal memulai pembayaran: " +
          (fnError?.message || "Terjadi kesalahan. Cek menu Pesanan Anda dan coba bayar lagi nanti."),
      );
      return;
    }

    // 3) Buka popup pembayaran Snap
    window.snap.pay(fnData.snap_token, {
      onSuccess: () => {
        clearCart(tokoId);
        navigate(`/toko/${tokoId}/pesanan-sukses`, { state: { pesananId } });
      },
      onPending: () => {
        // Pembeli memilih metode yang butuh tindakan lanjutan (mis. transfer
        // VA) — pesanan tetap dianggap "menunggu" sampai webhook Midtrans
        // mengonfirmasi. Tetap arahkan ke halaman sukses supaya pembeli
        // lihat instruksi & status pesanannya, keranjang tetap dikosongkan
        // karena pesanan sudah tercatat di database.
        clearCart(tokoId);
        navigate(`/toko/${tokoId}/pesanan-sukses`, { state: { pesananId } });
      },
      onError: () => {
        setErrorMsg(
          "Pembayaran gagal. Pesanan Anda tetap tercatat sebagai 'menunggu' — coba bayar lagi dari menu Pesanan.",
        );
      },
      onClose: () => {
        // Popup ditutup tanpa menyelesaikan pembayaran — jangan kosongkan
        // keranjang, biarkan pembeli tahu pesanan sudah dibuat tapi belum
        // dibayar.
        setErrorMsg(
          "Pembayaran dibatalkan. Pesanan Anda tetap tersimpan dengan status menunggu bayar.",
        );
      },
    });
  };

  if (items.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">
          Keranjang masih kosong.{" "}
          <button
            onClick={() => navigate(`/toko/${tokoId}/barang`)}
            className="text-blue-600 hover:underline"
          >
            Kembali belanja
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl p-4">
      <button
        onClick={() => navigate(`/toko/${tokoId}/keranjang`)}
        className="mb-3 text-sm text-blue-600 hover:underline"
      >
        &larr; Kembali ke Keranjang
      </button>

      <h1 className="mb-4 text-xl font-semibold">Checkout</h1>

      <div className="mb-4 border rounded">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-3 py-2 border-b last:border-b-0"
          >
            <div>
              <div className="font-medium">{item.nama_barang}</div>
              <div className="text-xs text-gray-500">
                {item.qty} {item.satuan} x {formatRupiah(item.harga)}
              </div>
            </div>
            <div className="font-medium">
              {formatRupiah(item.harga * item.qty)}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 font-semibold bg-gray-50">
          <span>Total</span>
          <span>{formatRupiah(total)}</span>
        </div>
      </div>

      <label className="block mb-1 text-xs text-gray-500">
        Catatan untuk penjual (opsional)
      </label>
      <textarea
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Contoh: tolong dibungkus rapi"
        className="w-full px-3 py-2 mb-4 border rounded"
      />

      {errorMsg && (
        <div className="mb-4 text-sm text-red-600">{errorMsg}</div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Memproses pesanan..." : "Bayar Sekarang"}
      </button>
    </div>
  );
}
