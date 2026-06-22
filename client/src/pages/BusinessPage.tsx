import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { fetchBusiness } from "../lib/api";
import type { Business } from "../types";
import { styleForBusiness } from "../lib/categories";
import { absoluteDate, relativeTime } from "../lib/format";
import { CategoryTag, Spinner, StatusBadge, UpdatedBadge } from "../components/ui";

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

function mapsQuery(b: Business): string {
  return encodeURIComponent([b.name, b.location?.address, b.location?.moshav].filter(Boolean).join(", "));
}

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchBusiness(id, controller.signal)
      .then(setBusiness)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-9 w-9 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="חזרה"
          >
            <span className="text-xl">→</span>
          </button>
          <span className="truncate font-bold text-gray-800">{business?.name ?? "פרטי עסק"}</span>
        </div>
      </header>

      {loading ? (
        <Spinner label="טוען..." />
      ) : error || !business ? (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <div className="text-4xl">😕</div>
          <p className="font-semibold text-gray-700">העסק לא נמצא</p>
          {error && <p className="max-w-sm text-sm text-gray-500">{error}</p>}
        </div>
      ) : (
        <BusinessDetail business={business} />
      )}
    </div>
  );
}

function BusinessDetail({ business }: { business: Business }) {
  const { emoji, color } = styleForBusiness(business.categories ?? []);
  const images = business.imageUrls ?? [];
  const hasCoords =
    typeof business.location?.lat === "number" && typeof business.location?.lng === "number";

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {images.length > 0 ? (
        <div className="overflow-hidden rounded-2xl">
          <img src={images[0]} alt={business.name} className="max-h-80 w-full object-cover" />
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.slice(1).map((url) => (
                <img key={url} src={url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="grid h-44 place-items-center rounded-2xl text-6xl"
          style={{ backgroundColor: `${color}1a` }}
        >
          {emoji}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold text-gray-900">{business.name}</h1>
        <StatusBadge status={business.status} />
        <span className="ms-auto">
          <UpdatedBadge value={business.lastPostedAt ?? business.lastUpdatedAt} />
        </span>
      </div>

      {business.categories?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {business.categories.map((c) => (
            <CategoryTag key={c} category={c} />
          ))}
        </div>
      )}

      {business.description && <p className="mt-4 leading-relaxed text-gray-700">{business.description}</p>}

      <div className="mt-4 space-y-3">
        {business.openingHours && (
          <InfoRow icon="🕒" title="שעות פתיחה">
            <p className="whitespace-pre-line text-gray-700">{business.openingHours}</p>
          </InfoRow>
        )}

        {(business.location?.moshav || business.location?.address || business.location?.raw) && (
          <InfoRow icon="📍" title="מיקום">
            <p className="text-gray-700">
              {business.location.address && <span>{business.location.address}, </span>}
              {business.location.moshav ?? business.location.raw}
            </p>
          </InfoRow>
        )}

        {business.phone && (
          <InfoRow icon="📞" title="טלפון">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`tel:${business.phone}`} className="font-medium text-brand-700" dir="ltr">
                {business.phone}
              </a>
              <a
                href={waLink(business.phone)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
              >
                וואטסאפ
              </a>
            </div>
          </InfoRow>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery(business)}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-brand-700"
        >
          ניווט ב‑Google Maps
        </a>
        {hasCoords && (
          <a
            href={`https://waze.com/ul?ll=${business.location.lat},${business.location.lng}&navigate=yes`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-xl bg-white px-4 py-2.5 text-center text-sm font-bold text-brand-700 ring-1 ring-brand-300 hover:bg-brand-50"
          >
            ניווט ב‑Waze
          </a>
        )}
      </div>

      {hasCoords && (
        <div className="mt-4 h-56 overflow-hidden rounded-2xl ring-1 ring-gray-200">
          <MapContainer
            center={[business.location.lat!, business.location.lng!]}
            zoom={14}
            className="h-full w-full"
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              position={[business.location.lat!, business.location.lng!]}
              icon={L.divIcon({
                html: `<div class="cat-marker" style="background:${color}"><span>${emoji}</span></div>`,
                className: "",
                iconSize: [36, 36],
                iconAnchor: [18, 36],
              })}
            />
          </MapContainer>
          <p className="bg-gray-50 px-3 py-1.5 text-center text-[0.7rem] text-gray-400">
            המיקום מבוסס על היישוב ואינו בהכרח כתובת מדויקת
          </p>
        </div>
      )}

      {business.lastRawText && (
        <details className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-gray-100">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600">הפוסט המקורי</summary>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
            {business.lastRawText}
          </p>
        </details>
      )}

      {absoluteDate(business.lastPostedAt ?? business.lastUpdatedAt) && (
        <p className="mt-4 text-center text-xs text-gray-400">
          המידע עודכן {relativeTime(business.lastPostedAt ?? business.lastUpdatedAt)} (
          {absoluteDate(business.lastPostedAt ?? business.lastUpdatedAt)})
        </p>
      )}
    </div>
  );
}

function InfoRow({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-500">
        <span aria-hidden>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
