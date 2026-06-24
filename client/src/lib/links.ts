import type { Business } from "../types";

/**
 * Google Maps link. Uses a text search by name + address + moshav, so Google matches
 * the real business listing from its own Places index when one exists.
 */
export function googleMapsUrl(b: Business): string {
  const query = encodeURIComponent(
    [b.name, b.location?.address, b.location?.moshav].filter(Boolean).join(", "),
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Waze deep link to the business coordinates, or null when we have no coordinates. */
export function wazeUrl(b: Business): string | null {
  const lat = b.location?.lat;
  const lng = b.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/** WhatsApp click-to-chat link from an Israeli phone number. */
export function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

/** Ensures a URL has a scheme so it works as an href. */
export function externalUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Compact label for a URL: drops scheme, www, and any trailing slash. */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}
