import templates from "../data/templates";
import TemplateCard from "../components/TemplateCard";

export default function TemplateMateri() {
  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Template Materi Pembelajaran
      </h1>

      <div className="grid md:grid-cols-3 gap-6">

        {templates.map((item) => (
          <TemplateCard
            key={item.id}
            template={item}
          />
        ))}

      </div>

    </div>
  );
}
