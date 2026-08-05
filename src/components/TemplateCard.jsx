export default function TemplateCard({ template }) {
  return (
    <div className="border rounded-xl shadow-sm p-4 hover:shadow-lg transition">
      <img
        src={template.thumbnail}
        alt={template.title}
        className="w-full h-44 object-cover rounded-lg"
      />

      <h2 className="text-lg font-semibold mt-3">
        {template.title}
      </h2>

      <p className="text-sm text-gray-500">
        {template.subject}
      </p>

      <div className="flex gap-2 mt-2">
        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
          Kelas {template.grade}
        </span>

        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
          Fase {template.phase}
        </span>
      </div>

      <p className="text-sm mt-3">
        {template.description}
      </p>

      <div className="flex gap-2 mt-4">
        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Preview
        </button>

        <button className="border px-4 py-2 rounded">
          Gunakan
        </button>
      </div>
    </div>
  );
}
