import { useCallback, useEffect, useState } from "react";

export interface GeoState {
  position: [number, number] | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  /** Bumps each time a successful fix arrives, so the map can recenter on demand. */
  fixCount: number;
  locate: () => void;
  supported: boolean;
}

const isSecure = typeof window !== "undefined" && window.isSecureContext;
const hasGeo = typeof navigator !== "undefined" && "geolocation" in navigator;

export function useGeolocation(auto = true): GeoState {
  const supported = hasGeo && isSecure;
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixCount, setFixCount] = useState(0);

  const locate = useCallback(() => {
    if (!hasGeo) {
      setError("שירות המיקום אינו נתמך בדפדפן זה");
      return;
    }
    if (!isSecure) {
      setError("איתור מיקום דורש חיבור מאובטח (https) או localhost");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
        setFixCount((n) => n + 1);
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "הגישה למיקום נדחתה"
            : err.code === err.TIMEOUT
              ? "פג הזמן לאיתור המיקום"
              : "לא ניתן לאתר את המיקום",
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (auto && supported) locate();
  }, [auto, supported, locate]);

  return { position, accuracy, error, loading, fixCount, locate, supported };
}
