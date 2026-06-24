export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

export type ApiTimestamp = FirestoreTimestamp | string | number | null;

export interface BusinessLocation {
  raw?: string;
  moshav?: string;
  address?: string;
  lat?: number;
  lng?: number;
  geohash?: string;
}

export type BusinessStatus = "active" | "needs_review";

export interface RecentPost {
  text?: string;
  /** Firebase Storage paths of this post's image(s). */
  images?: string[];
  /** Signed, ready-to-render URLs the API derives from `images`. */
  imageUrls?: string[];
  postedAt?: ApiTimestamp;
  sourceMessageId?: string;
}

export interface Business {
  id: string;
  name: string;
  categories: string[];
  description?: string;
  /** Opening hours exactly as written in the latest post (Hebrew kept). */
  openingHours?: string;
  phone?: string;
  /** A URL from the post: website, online-ordering/delivery link, menu, or social page. */
  website?: string;
  location: BusinessLocation;
  /** Firebase Storage paths of the latest post's image(s). */
  images?: string[];
  /** Signed, ready-to-render URLs the API derives from `images`. */
  imageUrls?: string[];
  lastRawText?: string;
  /** Up to the last 5 posts about this business, newest first. */
  recentPosts?: RecentPost[];
  firstSeenAt?: ApiTimestamp;
  lastUpdatedAt?: ApiTimestamp;
  /** WhatsApp timestamp of the latest post - the meaningful "info last updated". */
  lastPostedAt?: ApiTimestamp;
  extractionConfidence?: number;
  status: BusinessStatus;
}

export interface BusinessListResponse {
  count: number;
  businesses: Business[];
}
