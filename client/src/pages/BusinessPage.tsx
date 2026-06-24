import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchBusiness, getCachedBusiness } from "../lib/api";
import type { Business, RecentPost } from "../types";
import { styleForBusiness } from "../lib/categories";
import { absoluteDate, relativeTime, shortDate } from "../lib/format";
import { displayUrl, externalUrl, waLink } from "../lib/links";
import { CategoryTag, Spinner, StatusBadge, UpdatedBadge } from "../components/ui";
import { NavButtons } from "../components/NavButtons";

interface LightboxState {
  images: string[];
  index: number;
}

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(() => (id ? getCachedBusiness(id) : null));
  const [loading, setLoading] = useState(() => (id ? getCachedBusiness(id) == null : true));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // Served instantly from the session cache (usually populated by the list view).
    const cached = getCachedBusiness(id);
    if (cached) {
      setBusiness(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setBusiness(null);
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
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const hasCoords =
    typeof business.location?.lat === "number" && typeof business.location?.lng === "number";
  const locationText = [business.location?.address, business.location?.moshav ?? business.location?.raw]
    .filter(Boolean)
    .join(", ");
  const hasLocation = Boolean(locationText) || hasCoords;
  const posts = getRecentPosts(business);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {images.length > 0 ? (
        <div className="overflow-hidden rounded-2xl">
          <img
            src={images[0]}
            alt={business.name}
            className="max-h-80 w-full cursor-zoom-in object-cover"
            onClick={() => setLightbox({ images, index: 0 })}
          />
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.slice(1).map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-20 w-20 shrink-0 cursor-zoom-in rounded-lg object-cover"
                  onClick={() => setLightbox({ images, index: i + 1 })}
                />
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

        {business.website && (
          <InfoRow icon="🌐" title="אתר / הזמנות">
            <a
              href={externalUrl(business.website)}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium text-brand-700 hover:underline"
              dir="ltr"
            >
              {displayUrl(business.website)}
            </a>
          </InfoRow>
        )}

        {hasLocation && (
          <InfoRow icon="📍" title="מיקום">
            <div className="flex items-center gap-3">
              {locationText && <p className="text-gray-700">{locationText}</p>}
              <NavButtons business={business} className="ms-auto shrink-0" />
            </div>
          </InfoRow>
        )}
      </div>

      {posts.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-600">פרסומים אחרונים</h2>
          <div className="space-y-2">
            {posts.map((post, i) => (
              <PostRow
                key={post.sourceMessageId ?? i}
                post={post}
                defaultOpen={false}
                onOpenImage={(set, index) => setLightbox({ images: set, index })}
              />
            ))}
          </div>
        </section>
      )}

      {absoluteDate(business.lastPostedAt ?? business.lastUpdatedAt) && (
        <p className="mt-4 text-center text-xs text-gray-400">
          המידע עודכן {relativeTime(business.lastPostedAt ?? business.lastUpdatedAt)} (
          {absoluteDate(business.lastPostedAt ?? business.lastUpdatedAt)})
        </p>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox((s) => (s ? { ...s, index: i } : s))}
        />
      )}
    </div>
  );
}

/** The stored recent posts, falling back to a single entry for legacy records. */
function getRecentPosts(business: Business): RecentPost[] {
  if (business.recentPosts && business.recentPosts.length > 0) return business.recentPosts;
  if (business.lastRawText || (business.imageUrls?.length ?? 0) > 0) {
    return [
      {
        text: business.lastRawText,
        imageUrls: business.imageUrls,
        postedAt: business.lastPostedAt ?? business.lastUpdatedAt,
      },
    ];
  }
  return [];
}

function PostRow({
  post,
  defaultOpen,
  onOpenImage,
}: {
  post: RecentPost;
  defaultOpen: boolean;
  onOpenImage: (images: string[], index: number) => void;
}) {
  const imageUrls = post.imageUrls ?? [];
  const date = shortDate(post.postedAt);
  const rel = relativeTime(post.postedAt);
  return (
    <details className="rounded-2xl bg-white p-4 ring-1 ring-gray-100" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-gray-700">
        {date ?? "פרסום"}
        {rel && <span className="ms-2 text-xs font-normal text-gray-400">{rel}</span>}
      </summary>
      {post.text && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{post.text}</p>
      )}
      {imageUrls.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {imageUrls.map((url, k) => (
            <img
              key={url}
              src={url}
              alt=""
              className="h-20 w-20 shrink-0 cursor-zoom-in rounded-lg object-cover"
              onClick={() => onOpenImage(imageUrls, k)}
            />
          ))}
        </div>
      )}
    </details>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const multiple = images.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, images.length, onClose, onIndex]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-white/40 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="סגור"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-2xl leading-none text-white hover:bg-black/70"
      >
        ×
      </button>

      <img
        src={images[index]}
        alt=""
        className="max-h-[90dvh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {multiple && (
        <>
          <button
            type="button"
            aria-label="הקודם"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + images.length) % images.length);
            }}
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-3xl leading-none text-white hover:bg-black/70"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="הבא"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % images.length);
            }}
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-3xl leading-none text-white hover:bg-black/70"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
            {index + 1} / {images.length}
          </div>
        </>
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
