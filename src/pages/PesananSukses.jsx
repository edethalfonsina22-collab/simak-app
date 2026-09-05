import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

// URL yang disarankan: /toko/:id/pesanan-sukses
// (tokoId dari :id tidak lagi dipakai di sini karena tombol "Kembali ke
// Toko" sekarang menuju /toko, bukan rute /toko/:id/barang yang tidak ada)
//
// PERBAIKAN (tampilan): halaman ini sebelumnya merender <div> polos tanpa
// <Layout>, sehingga Sidebar & header aplikasi hilang total saat dibuka.
// Sekarang dibungkus <Layout> seperti pola di halaman lain (mis. Toko.jsx,
// Keranjang.jsx, Checkout.jsx).

export default function PesananSukses() {
  const navigate = useNavigate();
  const location = useLocation();
  const pesananId = location.state?.pesananId;

  return (
    <Layout title="Pesanan Berhasil" subtitle="Terima kasih atas pesanan Anda">
      <div className="max-w-md p-6 mx-auto mt-10 text-center border rounded">
        <div className="mb-2 text-3xl">✅</div>
        <h1 className="mb-2 text-lg font-semibold">Pesanan Berhasil Dibuat</h1>
        {pesananId && (
          <p className="mb-4 text-sm text-gray-500">
            Nomor pesanan: <span className="font-mono">{pesananId}</span>
          </p>
        )}
        <button
          onClick={() => navigate("/toko")}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Kembali ke Toko
        </button>
      </div>
    </Layout>
  );
}
