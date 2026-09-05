import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../lib/CartContext";

// URL yang disarankan: /toko/:id/keranjang
// Sengaja TIDAK memerlukan login (lihat App.jsx) — tamu boleh melihat &
// mengubah isi keranjangnya sendiri sebelum diwajibkan login saat checkout.

export default function Keranjang() {
  const { id: tokoId } = useParams();
  const navigate = useNavigate();
  const { getCartItems, updateQty, removeItem } = useCart();

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

  return (
    <div className="p-4">
      <button
        onClick={() => navigate("/toko")}
        className="mb-3 text-sm text-blue-600 hover:underline"
      >
        &larr; Lanjut Belanja
      </button>

      <h1 className="mb-4 text-xl font-semibold">Keranjang Belanja</h1>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Keranjang Anda masih kosong.</p>
      ) : (
        <>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2">Barang</th>
                  <th className="px-3 py-2">Harga</th>
                  <th className="px-3 py-2">Jumlah</th>
                  <th className="px-3 py-2">Subtotal</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.nama_barang}</td>
                    <td className="px-3 py-2">{formatRupiah(item.harga)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQty(tokoId, item.id, item.qty - 1)
                          }
                          className="w-7 h-7 border rounded hover:bg-gray-100"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stok}
                          value={item.qty}
                          onChange={(e) =>
                            updateQty(
                              tokoId,
                              item.id,
                              Number(e.target.value) || 1
                            )
                          }
                          className="w-14 px-2 py-1 text-center border rounded"
                        />
                        <button
                          onClick={() =>
                            updateQty(tokoId, item.id, item.qty + 1)
                          }
                          disabled={item.qty >= item.stok}
                          className="w-7 h-7 border rounded hover:bg-gray-100 disabled:opacity-40"
                        >
                          +
                        </button>
                        <span className="text-xs text-gray-400">
                          {item.satuan}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatRupiah(item.harga * item.qty)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeItem(tokoId, item.id)}
                        className="text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-lg font-semibold">
              Total: {formatRupiah(total)}
            </div>
            <button
              onClick={() => navigate(`/toko/${tokoId}/checkout`)}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Lanjut ke Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
