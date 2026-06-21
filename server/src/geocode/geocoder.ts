import ngeohash from "ngeohash";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { lookupMoshav } from "./moshavim.js";

export interface GeoResult {
  lat?: number;
  lng?: number;
  geohash?: string;
}

export interface GeoInput {
  moshav?: string;
  address?: string;
  raw?: string;
}

function withGeohash(lat: number, lng: number): GeoResult {
  return { lat, lng, geohash: ngeohash.encode(lat, lng, 9) };
}

export async function geocode(input: GeoInput): Promise<GeoResult> {
  // 1. Try the static moshav gazetteer first (free + reliable for our region).
  const candidateName = input.moshav ?? input.raw;
  if (candidateName) {
    const hit = lookupMoshav(candidateName);
    if (hit) return withGeohash(hit.lat, hit.lng);
  }

  // 2. Fall back to an external geocoder for full addresses, if configured.
  const addressQuery = input.address ?? input.raw;
  if (addressQuery && env.GEOCODER_PROVIDER !== "none") {
    try {
      const result =
        env.GEOCODER_PROVIDER === "google"
          ? await geocodeGoogle(addressQuery)
          : await geocodeNominatim(addressQuery);
      if (result) return withGeohash(result.lat, result.lng);
    } catch (err) {
      logger.warn({ err: String(err), addressQuery }, "External geocoding failed");
    }
  }

  return {};
}

async function geocodeNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");

  const res = await fetch(url, {
    headers: { "User-Agent": "lachishBusinesses/0.1 (community business directory)" },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

async function geocodeGoogle(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!env.GEOCODING_API_KEY) throw new Error("GEOCODING_API_KEY required for google provider");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("region", "il");
  url.searchParams.set("key", env.GEOCODING_API_KEY);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google geocode HTTP ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };
  const loc = data.results?.[0]?.geometry.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}
