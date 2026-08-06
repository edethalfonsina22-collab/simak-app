export default function TemplateCard({
  template,
  onPreview,
  onUse,
}) {
  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition duration-300">

      <img
        src={template.thumbnail}
        alt={template.judul}
        className="w-full h-48 object-cover"
      />

      <div className="p-4">

        <h2 className="text-lg font-bold text-gray-800">
          {template.judul}
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          {template.mapel}
        </p>

        <div className="flex gap-2 mt-3">

          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
            Kelas {template.kelas}
          </span>

          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
            Fase {template.fase}
          </span>

          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
            {template.jenis}
          </span>

        </div>

        <p className="text-sm text-gray-600 mt-4 line-clamp-3">
          {template.deskripsi}
        </p>

        <div className="flex gap-3 mt-5">

          <button
            onClick={onPreview}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition"
          >
            👁 Preview
          </button>

          <button
            onClick={() => onUse && onUse(template)}
            className="flex-1 border hover:bg-gray-100 py-2 rounded-lg transition"
          >
            📄 Gunakan
          </button>

        </div>

      </div>

    </div>
  )
}
