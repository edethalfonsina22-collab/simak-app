import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../lib/CartContext";

// URL yang disarankan: /toko/:id/checkout
//
// Alur:
// 1. Ambil isi keranjang untuk toko ini dari CartContext
// 2. Panggil fungsi database "buat_pesanan" (lihat checkout_schema.sql)
//    -> fungsi ini yang membuat baris di tabel pesanan + pesanan_item
//      dan mengurangi stok secara aman (anti bentrok kalau ada 2 pembeli
//      checkout barang yang sama di saat bersamaan).
// 3. Kalau sukses, keranjang dikosongkan dan pembeli diarahkan ke
//    halaman sukses.

export default function Checkout() {
  const { id: tokoId } = useParams();
  const navigate = useNavigate();
  const { getCartItems, clearCart } = useCart();

  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const items = getCartItems(tokoId);

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

    setLoading(true);

    const { data: pesananId, error } = await supabase.rpc("buat_pesanan", {
      p_toko_id: tokoId,
      p_items: items.map((item) => ({ barang_id: item.id, qty: item.qty })),
      p_catatan: catatan || null,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("Checkout gagal: " + error.message);
      return;
    }

    clearCart(tokoId);
    navigate(`/toko/${tokoId}/pesanan-sukses`, { state: { pesananId } });
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
        {loading ? "Memproses pesanan..." : "Buat Pesanan"}
      </button>
    </div>
  );
}
