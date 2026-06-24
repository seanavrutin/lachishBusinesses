export interface BusinessLocation {
  raw?: string;
  moshav?: string;
  address?: string;
  lat?: number;
  lng?: number;
  geohash?: string;
}

export type BusinessStatus = "active" | "needs_review";

/** A single WhatsApp post about a business, kept for the "recent posts" history. */
export interface RecentPost {
  text?: string;
  /** Storage paths of this post's image(s). */
  images?: string[];
  /** WhatsApp timestamp of the post. */
  postedAt: FirebaseFirestore.Timestamp | Date;
  sourceMessageId?: string;
}

export interface Business {
  id?: string;
  name: string;
  categories: string[];
  description?: string;
  /** Opening hours exactly as written in the latest post (Hebrew kept). */
  openingHours?: string;
  phone?: string;
  /** A URL from the post: website, online-ordering/delivery link, menu, or social page. */
  website?: string;
  location: BusinessLocation;
  /** Storage paths of the latest post's image(s). */
  images: string[];
  /** Raw text of the latest post about this business. */
  lastRawText?: string;
  /** Up to the last 5 posts about this business, newest first. */
  recentPosts?: RecentPost[];
  sourceGroupId?: string;
  lastSourceMessageId?: string;
  firstSeenAt?: FirebaseFirestore.Timestamp | Date;
  /** When our server last wrote this record. */
  lastUpdatedAt?: FirebaseFirestore.Timestamp | Date;
  /** WhatsApp timestamp of the latest post - the meaningful "info last updated". */
  lastPostedAt?: FirebaseFirestore.Timestamp | Date;
  extractionConfidence?: number;
  status: BusinessStatus;
}

export type RawMessageStatus = "pending" | "processing" | "done" | "failed";

export interface RawMessage {
  id?: string;
  groupId: string;
  sender?: string;
  text?: string;
  /** Storage paths of attached images. */
  imagePaths: string[];
  /** Unix epoch milliseconds of the WhatsApp message. */
  waTimestamp: number;
  status: RawMessageStatus;
  attempts: number;
  /** Earliest epoch ms at which this message should be retried. */
  nextAttemptAt?: number;
  error?: string;
  /** Classified intent of the post (for auditing why it was kept/filtered). */
  postType?: string;
  businessId?: string;
  createdAt?: FirebaseFirestore.Timestamp | Date;
  updatedAt?: FirebaseFirestore.Timestamp | Date;
}
