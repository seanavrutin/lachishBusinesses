import type { MouseEvent } from "react";
import type { Business } from "../types";
import { googleMapsUrl, wazeUrl } from "../lib/links";
import googleMapsIcon from "../assets/google-maps.svg";
import wazeIcon from "../assets/waze.svg";

const stop = (e: MouseEvent) => e.stopPropagation();

const BTN =
  "grid h-9 w-9 place-items-center rounded-full bg-white shadow ring-1 ring-gray-200 backdrop-blur hover:bg-gray-50";

/** Google Maps + Waze navigation icon links for a business (Waze hidden when no coordinates). */
export function NavButtons({ business, className = "" }: { business: Business; className?: string }) {
  const waze = wazeUrl(business);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <a
        href={googleMapsUrl(business)}
        target="_blank"
        rel="noreferrer"
        onClick={stop}
        title="פתח ב-Google Maps"
        aria-label="פתח ב-Google Maps"
        className={BTN}
      >
        <img src={googleMapsIcon} alt="" className="h-5 w-auto" />
      </a>
      {waze && (
        <a
          href={waze}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          title="נווט עם Waze"
          aria-label="נווט עם Waze"
          className={BTN}
        >
          <img src={wazeIcon} alt="" className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}
