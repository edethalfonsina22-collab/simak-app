import { useLocation, useParams, useNavigate } from "react-router-dom";

// URL yang disarankan: /toko/:id/pesanan-sukses

export default function PesananSukses() {
  const { id: tokoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const pesananId = location.state?.pesananId;

  return (
    <div className="max-w-md p-6 mx-auto mt-10 text-center border rounded">
      <div className="mb-2 text-3xl">✅</div>
      <h1 className="mb-2 text-lg font-semibold">Pesanan Berhasil Dibuat</h1>
      {pesananId && (
        <p className="mb-4 text-sm text-gray-500">
          Nomor pesanan: <span className="font-mono">{pesananId}</span>
        </p>
      )}
      <button
        onClick={() => navigate(`/toko/${tokoId}/barang`)}
        className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
      >
        Kembali ke Toko
      </button>
    </div>
  );
}
