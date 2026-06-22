import { useNavigate } from "react-router-dom";
import type { Business } from "../types";
import { styleForBusiness } from "../lib/categories";
import { UpdatedBadge, StatusBadge } from "./ui";

export default function BusinessCard({ business }: { business: Business }) {
  const navigate = useNavigate();
  const { emoji, color } = styleForBusiness(business.categories ?? []);
  const image = business.imageUrls?.[0];
  const hoursLine = business.openingHours?.replace(/\s*\n\s*/g, " · ").trim();

  return (
    <article
      onClick={() => navigate(`/business/${business.id}`)}
      className="group flex cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
    >
      <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        {image ? (
          <img src={image} alt={business.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl" style={{ backgroundColor: `${color}1a` }}>
            {emoji}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-bold text-gray-900">{business.name}</h3>
        </div>

        {business.location?.moshav && (
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <span aria-hidden>📍</span>
            <span className="truncate">{business.location.moshav}</span>
          </p>
        )}

        {hoursLine && (
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <span aria-hidden>🕒</span>
            <span className="line-clamp-1">{hoursLine}</span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {(business.categories ?? []).slice(0, 2).map((c) => (
            <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.7rem] font-medium text-gray-600">
              {c}
            </span>
          ))}
          <span className="ms-auto flex items-center gap-1.5">
            <StatusBadge status={business.status} />
            <UpdatedBadge value={business.lastPostedAt ?? business.lastUpdatedAt} />
          </span>
        </div>
      </div>
    </article>
  );
}
