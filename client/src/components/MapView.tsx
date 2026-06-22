import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";
import type { Business } from "../types";
import { styleForBusiness } from "../lib/categories";
import { relativeTime } from "../lib/format";
import { useGeolocation } from "../hooks/useGeolocation";
import { EmptyState } from "./ui";
import { VectorBasemap } from "./VectorBasemap";
import { NavButtons } from "./NavButtons";

const USER_ICON = L.divIcon({
  html: `<div class="user-loc"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const REGION_CENTER: [number, number] = [31.56, 34.78];

interface Placed {
  business: Business;
  position: [number, number];
}

/** Spreads businesses that share identical (moshav-level) coordinates around a small ring. */
function placeBusinesses(businesses: Business[]): Placed[] {
  const withCoords = businesses.filter(
    (b) => typeof b.location?.lat === "number" && typeof b.location?.lng === "number",
  );
  const groups = new Map<string, Business[]>();
  for (const b of withCoords) {
    const key = `${b.location.lat!.toFixed(5)},${b.location.lng!.toFixed(5)}`;
    const arr = groups.get(key) ?? [];
    arr.push(b);
    groups.set(key, arr);
  }

  const placed: Placed[] = [];
  for (const group of groups.values()) {
    const [lat, lng] = [group[0].location.lat!, group[0].location.lng!];
    if (group.length === 1) {
      placed.push({ business: group[0], position: [lat, lng] });
      continue;
    }
    const radius = 0.0016 * (1 + group.length / 12);
    const latRad = (lat * Math.PI) / 180;
    group.forEach((business, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      placed.push({
        business,
        position: [lat + radius * Math.cos(angle), lng + (radius * Math.sin(angle)) / Math.cos(latRad)],
      });
    });
  }
  return placed;
}

function markerIcon(business: Business): L.DivIcon {
  const { emoji, color } = styleForBusiness(business.categories ?? []);
  return L.divIcon({
    html: `<div class="cat-marker" style="background:${color}"><span>${emoji}</span></div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
  });
}

function FitToMarkers({ placed }: { placed: Placed[] }) {
  const map = useMap();
  useEffect(() => {
    if (placed.length === 0) return;
    if (placed.length === 1) {
      map.setView(placed[0].position, 14);
      return;
    }
    const bounds = L.latLngBounds(placed.map((p) => p.position));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, placed]);
  return null;
}

/** Flies the map to the user each time a new geolocation fix arrives. */
function RecenterOnUser({ position, fixCount }: { position: [number, number] | null; fixCount: number }) {
  const map = useMap();
  useEffect(() => {
    if (fixCount > 0 && position) {
      map.flyTo(position, Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }, [map, position, fixCount]);
  return null;
}

export default function MapView({ businesses }: { businesses: Business[] }) {
  const navigate = useNavigate();
  const placed = useMemo(() => placeBusinesses(businesses), [businesses]);
  const geo = useGeolocation(true);

  if (businesses.length === 0) {
    return <EmptyState title="לא נמצאו עסקים" hint="נסו לשנות את הסינון או החיפוש" />;
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={REGION_CENTER}
        zoom={11}
        className="h-full w-full"
        scrollWheelZoom
        attributionControl={false}
      >
        <VectorBasemap />
        <FitToMarkers placed={placed} />
        <RecenterOnUser position={geo.position} fixCount={geo.fixCount} />
        {geo.position && <Marker position={geo.position} icon={USER_ICON} zIndexOffset={1000} />}
        {placed.map(({ business, position }) => (
          <Marker key={business.id} position={position} icon={markerIcon(business)}>
            <Popup>
              <div className="w-56 text-right">
                <button
                  type="button"
                  onClick={() => navigate(`/business/${business.id}`)}
                  className="block w-full text-right"
                >
                  {business.imageUrls?.[0] && (
                    <img
                      src={business.imageUrls[0]}
                      alt={business.name}
                      className="h-24 w-full object-cover"
                    />
                  )}
                  <span className="block px-3 pt-2">
                    <span className="block text-sm font-bold text-gray-900">{business.name}</span>
                    {business.location?.moshav && (
                      <span className="mt-0.5 block text-xs text-gray-500">📍 {business.location.moshav}</span>
                    )}
                    {relativeTime(business.lastPostedAt ?? business.lastUpdatedAt) && (
                      <span className="mt-0.5 block text-xs text-gray-400">
                        עודכן {relativeTime(business.lastPostedAt ?? business.lastUpdatedAt)}
                      </span>
                    )}
                    <span className="mt-1.5 block text-xs font-semibold text-brand-700">
                      לצפייה בפרטים ←
                    </span>
                  </span>
                </button>
                <NavButtons business={business} className="px-3 pb-1 pt-2" />
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        title="© OpenFreeMap © OpenStreetMap contributors"
        aria-label="קרדיט מפה"
        className="absolute bottom-2 right-2 z-[1000] grid h-5 w-5 place-items-center rounded-full bg-white/85 text-[11px] font-bold text-gray-500 ring-1 ring-gray-200"
      >
        i
      </a>

      <button
        type="button"
        onClick={geo.locate}
        aria-label="המיקום שלי"
        title="המיקום שלי"
        className="absolute bottom-5 left-4 z-[1000] grid h-11 w-11 place-items-center rounded-full bg-white text-brand-700 shadow-lg ring-1 ring-gray-200 transition hover:bg-gray-50"
      >
        {geo.loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        )}
      </button>

      {geo.error && (
        <div className="absolute top-3 left-1/2 z-[1000] max-w-[85%] -translate-x-1/2 rounded-lg bg-black/80 px-3 py-2 text-center text-xs text-white">
          {geo.error}
        </div>
      )}

      {placed.length < businesses.length && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
          {businesses.length - placed.length} עסקים ללא מיקום אינם מוצגים במפה
        </div>
      )}
    </div>
  );
}
