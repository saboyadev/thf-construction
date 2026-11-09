/**
 * Shared types for the Google Reviews data layer.
 *
 * Server-only. Nothing in this folder may be imported from a client script.
 */

/** Star rating enum as returned by the Business Profile API (v4 Review). */
export type StarRating =
  "STAR_RATING_UNSPECIFIED" | "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

/**
 * Raw review as returned by `accounts.locations.reviews.list`, limited to the
 * fields we keep. Stored in the cache exactly as received (no mapping) so the
 * stored content is never "manipulated or aggregated".
 */
export interface GoogleReview {
  name: string;
  reviewId: string;
  reviewer: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating: StarRating;
  /** Plain text; may carry Google's "(Translated by Google)" / "(Original)" markers. Absent for rating-only reviews. */
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

/** What the cache stores: the raw list plus when it was fetched. */
export interface ReviewsSnapshot {
  fetchedAt: string;
  reviews: GoogleReview[];
}

export type ErrorReason =
  "auth" | "permission" | "quota" | "network" | "parse" | "provider";

/** Where an `ok` result came from. */
export type ResultSource = "live" | "cache" | "stale" | "fixture";

/**
 * The loader's result. The four states are kept distinct so the island (and
 * logs) never confuse "not connected" with "Google returned zero reviews".
 */
export type ReviewsResult =
  | { state: "not-connected" }
  | {
      state: "ok";
      reviews: GoogleReview[];
      fetchedAt: string;
      source: ResultSource;
    }
  | { state: "error"; reason: ErrorReason; detail?: string };

/** Server-side configuration read from secret environment variables. */
export interface ReviewsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
  locationId: string;
}

/** Presentation model consumed by TestimonialCard. Produced at render time only. */
export interface CardReview {
  id: string;
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  /** Verbatim review text, or `null` for a rating-only review. */
  text: string | null;
  /** ISO timestamp the card's date is based on (the review's `updateTime`). */
  updatedAt: string;
  /** Human label, e.g. "Updated 3 weeks ago". */
  updatedLabel: string;
  avatarUrl: string | null;
}
