/**
 * Verifies the gazetteer coordinates against OpenStreetMap/Nominatim.
 * Prints, per moshav, the current vs. suggested coordinates and the distance
 * between them so obviously-wrong entries stand out. Read-only (no writes).
 *
 * Run on a network that can reach nominatim.openstreetmap.org:
 *   npm run verify:moshavim
 * On a TLS-intercepting network, set WA_ALLOW_INSECURE_TLS=true.
 */
import { MOSHAVIM } from "../geocode/moshavim.js";
import { insecureDispatcher } from "../whatsapp/tls.js";

const UA = "lachishBusinesses/0.1 (community business directory)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function nominatim(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");

  const init: Record<string, unknown> = { headers: { "User-Agent": UA } };
  const dispatcher = insecureDispatcher();
  if (dispatcher) init.dispatcher = dispatcher;

  const res = await fetch(url, init as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  return first ? { lat: Number(first.lat), lng: Number(first.lon), name: first.display_name } : null;
}

async function main(): Promise<void> {
  console.log("name\tcurrent\tsuggested\tΔ(km)\tmatch");
  for (const m of MOSHAVIM) {
    try {
      const hit = await nominatim(`${m.name}, ישראל`);
      if (!hit) {
        console.log(`${m.name}\t${m.lat},${m.lng}\t(no result)`);
      } else {
        const dist = haversineKm(m.lat, m.lng, hit.lat, hit.lng);
        const flag = dist > 1.5 ? "  <-- CHECK" : "";
        console.log(
          `${m.name}\t${m.lat},${m.lng}\t${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}\t${dist.toFixed(1)}${flag}\t${hit.name}`,
        );
      }
    } catch (err) {
      console.log(`${m.name}\tERROR ${String(err)}`);
    }
    await sleep(1200); // respect Nominatim's 1 req/sec policy
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
