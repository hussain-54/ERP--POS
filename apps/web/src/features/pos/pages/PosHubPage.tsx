import { Link } from "react-router-dom";
import type { PosSection } from "../ownership";

export function PosHubPage({ section }: { section: PosSection }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--pos-workspace)] p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{section.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{section.description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.links.map((link) => (
            <Link
              key={link.path + link.title}
              to={link.path}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold text-gray-800">{link.title}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    link.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {link.status === "live" ? "Live" : "Soon"}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
