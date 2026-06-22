import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";

// Vector basemap styles (MapLibre GL / OpenFreeMap). Free, no API key.
// "Liberty" = rich, Google-like (main map). "Positron" = light & minimal (small previews).
export const LIBERTY_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";

const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// MapLibre needs the RTL text plugin to shape & order Hebrew/Arabic labels; without
// it they render reversed (left-to-right). Loaded once, lazily.
const RTL_TEXT_PLUGIN_URL =
  "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js";

let rtlPluginRequested = false;
function ensureRtlTextPlugin(): void {
  if (rtlPluginRequested) return;
  rtlPluginRequested = true;
  try {
    void maplibregl.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, true).catch(() => {});
  } catch {
    // already set in this session; ignore
  }
}

interface VectorBasemapProps {
  /** OpenFreeMap style URL. Defaults to the rich "Liberty" style. */
  style?: string;
  /** Hide point-of-interest icons/labels (keeps place + street names). */
  hidePois?: boolean;
}

/**
 * Renders the MapLibre GL vector basemap inside a Leaflet map (markers stay on top).
 * Shared by the main map and the business-page mini-map.
 *
 * NOTE: the "original" basemap was CARTO Voyager raster. To restore it, replace this
 * component with react-leaflet's <TileLayer> using:
 *   url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" subdomains="abcd"
 */
export function VectorBasemap({ style = LIBERTY_STYLE, hidePois = false }: VectorBasemapProps) {
  const map = useMap();
  useEffect(() => {
    ensureRtlTextPlugin();
    const layer = L.maplibreGL({ style });
    layer.addTo(map);
    const attribution = map.attributionControl;
    attribution?.addAttribution(BASEMAP_ATTRIBUTION);

    // Hide POI layers (OpenMapTiles schema marks them with source-layer "poi").
    const glMap = hidePois ? layer.getMaplibreMap() : null;
    const hide = () => {
      const layers = glMap?.getStyle()?.layers;
      if (!layers) return;
      for (const lyr of layers) {
        if ((lyr as { "source-layer"?: string })["source-layer"] === "poi") {
          try {
            glMap?.setLayoutProperty(lyr.id, "visibility", "none");
          } catch {
            // layer can't toggle visibility; ignore
          }
        }
      }
    };
    if (glMap) {
      glMap.on("styledata", hide);
      if (glMap.isStyleLoaded()) hide();
    }

    return () => {
      if (glMap) glMap.off("styledata", hide);
      attribution?.removeAttribution(BASEMAP_ATTRIBUTION);
      map.removeLayer(layer);
    };
  }, [map, style, hidePois]);
  return null;
}
