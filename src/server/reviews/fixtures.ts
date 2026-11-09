/**
 * LOCAL DEVELOPMENT FIXTURES. Clearly synthetic. Never shipped: index.ts only
 * imports this module inside an `import.meta.env.DEV` branch, which Vite
 * removes from production builds, and additionally refuses when the process
 * runs on Netlify (any deploy context). These are not reviews of THF; names
 * and text are placeholders for layout and state testing.
 */
import type { GoogleReview, ReviewsResult } from "./types.ts";

export type FixtureScenario = "populated" | "empty" | "error";

export function parseFixtureScenario(
  value: string | undefined | null,
): FixtureScenario | null {
  if (value === "populated" || value === "empty" || value === "error")
    return value;
  return null;
}

const LONG_TEXT =
  "FIXTURE LONG TEXT. " +
  "This placeholder paragraph exists only to exercise wrapping and card growth with a long written review. " +
  "It repeats a neutral sentence several times so the layout can be checked at phone, tablet and desktop widths. " +
  "Neutral sentence one. Neutral sentence two. Neutral sentence three. Neutral sentence four. " +
  "Neutral sentence five. Neutral sentence six. Neutral sentence seven. Neutral sentence eight. " +
  "End of fixture long text.";

/** Eight entries so the six-card limit is observable; updateTimes deliberately out of order. */
export const POPULATED_FIXTURE: GoogleReview[] = [
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-01",
    reviewId: "fixture-01",
    reviewer: {
      displayName: "Fixture Reviewer One",
      profilePhotoUrl: undefined,
      isAnonymous: false,
    },
    starRating: "FIVE",
    comment:
      "FIXTURE: short written review with a missing avatar (initials fallback).",
    createTime: "2026-10-01T10:00:00Z",
    updateTime: "2026-10-01T10:00:00Z",
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-02",
    reviewId: "fixture-02",
    reviewer: { isAnonymous: true },
    starRating: "FOUR",
    comment:
      'FIXTURE: anonymous reviewer. The card must read "Google user" with no photo.',
    createTime: "2026-10-20T09:00:00Z",
    updateTime: "2026-11-02T09:00:00Z",
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-03",
    reviewId: "fixture-03",
    reviewer: {
      displayName: "Fixture Reviewer Three",
      profilePhotoUrl: "https://placehold.co/96x96/png?text=F3",
      isAnonymous: false,
    },
    starRating: "THREE",
    // Rating-only: no comment field at all.
    createTime: "2026-11-05T15:30:00Z",
    updateTime: "2026-11-05T15:30:00Z",
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-04",
    reviewId: "fixture-04",
    reviewer: {
      displayName: "Fixture Reviewer Four",
      profilePhotoUrl: "https://placehold.co/96x96/png?text=F4",
      isAnonymous: false,
    },
    starRating: "FIVE",
    comment: LONG_TEXT,
    createTime: "2026-09-12T12:00:00Z",
    updateTime: "2026-11-07T12:00:00Z", // edited later: must sort by this, and the card says "Updated"
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-05",
    reviewId: "fixture-05",
    reviewer: { displayName: "Fixture Reviewer Five", isAnonymous: false },
    starRating: "FIVE",
    comment:
      "(Translated by Google) FIXTURE: translated text must be shown exactly as received, including this disclosure.\n\n(Original) FIXTURE: texto original de prueba que no debe modificarse.",
    createTime: "2026-10-28T08:00:00Z",
    updateTime: "2026-10-28T08:00:00Z",
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-06",
    reviewId: "fixture-06",
    reviewer: {
      displayName: "Fixture Reviewer Six",
      profilePhotoUrl: "https://placehold.co/96x96/png?text=F6",
      isAnonymous: false,
    },
    starRating: "TWO",
    comment:
      "FIXTURE: a two-star review. No rating filter is applied, so this must appear.",
    createTime: "2026-11-01T18:45:00Z",
    updateTime: "2026-11-01T18:45:00Z",
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-07",
    reviewId: "fixture-07",
    reviewer: { displayName: "Fixture Reviewer Seven", isAnonymous: false },
    starRating: "FOUR",
    comment:
      "FIXTURE: the oldest entry; with eight fixtures and a six-card limit this one must NOT render.",
    createTime: "2026-06-15T10:00:00Z",
    updateTime: "2026-06-15T10:00:00Z",
  },
  {
    name: "accounts/fixture/locations/fixture/reviews/fixture-08",
    reviewId: "fixture-08",
    reviewer: { displayName: "Fixture Reviewer Eight", isAnonymous: false },
    starRating: "STAR_RATING_UNSPECIFIED",
    comment: "FIXTURE: unspecified rating; must be skipped entirely.",
    createTime: "2026-11-08T10:00:00Z",
    updateTime: "2026-11-08T10:00:00Z",
  },
];

export function fixtureResult(
  scenario: FixtureScenario,
  now: Date,
): ReviewsResult {
  switch (scenario) {
    case "populated":
      return {
        state: "ok",
        reviews: POPULATED_FIXTURE,
        fetchedAt: now.toISOString(),
        source: "fixture",
      };
    case "empty":
      return {
        state: "ok",
        reviews: [],
        fetchedAt: now.toISOString(),
        source: "fixture",
      };
    case "error":
      return {
        state: "error",
        reason: "provider",
        detail: "fixture error scenario",
      };
  }
}
