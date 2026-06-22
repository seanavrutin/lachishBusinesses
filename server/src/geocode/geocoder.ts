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

// Generous bounding box around the Lachish / southern Shephelah region. Used to
// reject obviously-wrong external geocodes (e.g. a street name that also exists
// in Tel Aviv) and fall back to the moshav center instead.
const REGION = { minLat: 31.0, maxLat: 32.0, minLng: 34.3, maxLng: 35.2 };

function inRegion(r: { lat: number; lng: number }): boolean {
  return (
    r.lat >= REGION.minLat &&
    r.lat <= REGION.maxLat &&
    r.lng >= REGION.minLng &&
    r.lng <= REGION.maxLng
  );
}

// A "real" street address has a house number or comma-separated parts; a bare
// moshav/place name does not and is better served by the gazetteer center.
function hasStreetDetail(address: string): boolean {
  return /\d/.test(address) || address.includes(",");
}

/** Builds an address query with moshav + country context for the external geocoder. */
function buildAddressQuery(input: GeoInput, moshavName?: string): string | null {
  const address = input.address?.trim();
  if (!address || !hasStreetDetail(address)) return null;
  const parts = [address];
  if (moshavName && !address.includes(moshavName)) parts.push(moshavName);
  parts.push("ישראל");
  return parts.join(", ");
}

export async function geocode(input: GeoInput): Promise<GeoResult> {
  const moshavHit = lookupMoshav(input.moshav ?? input.raw ?? "");

  // 1. Prefer a precise street address via the external geocoder (Google has
  //    good Israeli house-number coverage). This also spreads businesses across
  //    their real spots instead of stacking them on the moshav center.
  const addressQuery = buildAddressQuery(input, moshavHit?.name ?? input.moshav);
  if (addressQuery && env.GEOCODER_PROVIDER !== "none") {
    try {
      const result =
        env.GEOCODER_PROVIDER === "google"
          ? await geocodeGoogle(addressQuery)
          : await geocodeNominatim(addressQuery);
      if (result && inRegion(result)) {
        logger.debug({ addressQuery, result }, "Geocoded precise address");
        return withGeohash(result.lat, result.lng);
      }
      if (result) {
        logger.warn(
          { addressQuery, result },
          "External geocode outside region; using moshav center",
        );
      }
    } catch (err) {
      logger.warn({ err: String(err), addressQuery }, "External geocoding failed");
    }
  }

  // 2. Fall back to the static moshav gazetteer center (free + reliable).
  if (moshavHit) return withGeohash(moshavHit.lat, moshavHit.lng);

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
