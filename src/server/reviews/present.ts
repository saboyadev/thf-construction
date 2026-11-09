/**
 * Presentation mapping: raw Google review → card model. Runs at render time
 * only; the cache never holds mapped data.
 *
 * Rules (approved):
 *   - up to six reviews, most recently UPDATED first (the API's `updateTime desc`)
 *   - no rating filter
 *   - rating-only reviews are kept and marked (text === null)
 *   - review text is passed through verbatim, including Google's translation
 *     disclosures; nothing is trimmed, rewritten or summarized
 *   - the displayed date is the update time, matching the sort order
 *   - no town, no "Homeowner" label; anonymous reviewers read "Google user"
 */
import type { CardReview, GoogleReview } from "./types.ts";

export const DISPLAY_LIMIT = 6;

const STARS: Record<string, 1 | 2 | 3 | 4 | 5 | undefined> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function ratingOf(review: GoogleReview): 1 | 2 | 3 | 4 | 5 | null {
  return STARS[review.starRating] ?? null;
}

/** Sort by updateTime (newest first) and take the display limit. Reviews without a usable rating are dropped. */
export function selectForDisplay(
  reviews: GoogleReview[],
  limit: number = DISPLAY_LIMIT,
): GoogleReview[] {
  return reviews
    .filter((r) => ratingOf(r) !== null)
    .slice()
    .sort((a, b) => Date.parse(b.updateTime) - Date.parse(a.updateTime))
    .slice(0, limit);
}

const DAY = 24 * 60 * 60 * 1000;

/** Coarse relative time for the "Updated …" line. */
export function relativeTime(iso: string, now: Date): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.max(0, Math.floor((now.getTime() - t) / DAY));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

export function toCardReview(
  review: GoogleReview,
  now: Date,
): CardReview | null {
  const rating = ratingOf(review);
  if (rating === null) return null;
  const anonymous =
    review.reviewer.isAnonymous === true || !review.reviewer.displayName;
  const text =
    typeof review.comment === "string" && review.comment.length > 0
      ? review.comment
      : null;
  const rel = relativeTime(review.updateTime, now);
  return {
    id: review.reviewId,
    name: anonymous ? "Google user" : review.reviewer.displayName!,
    rating,
    text,
    updatedAt: review.updateTime,
    updatedLabel: rel ? `Updated ${rel}` : "",
    avatarUrl:
      !anonymous && review.reviewer.profilePhotoUrl
        ? review.reviewer.profilePhotoUrl
        : null,
  };
}
