/**
 * The ONLY module that touches the secret environment. Server-only by
 * construction: `astro:env/server` cannot be imported into client code.
 * Values are read, bundled into a config object, and never logged.
 */
import {
  GOOGLE_BP_ACCOUNT_ID,
  GOOGLE_BP_CLIENT_ID,
  GOOGLE_BP_CLIENT_SECRET,
  GOOGLE_BP_LOCATION_ID,
  GOOGLE_BP_REFRESH_TOKEN,
  REVIEWS_CACHE_TTL_SECONDS,
  REVIEWS_FIXTURE,
} from "astro:env/server";
import type { ReviewsConfig } from "./types.ts";

/** All five secrets present → config; otherwise null ("not connected"). */
export function readReviewsConfig(): ReviewsConfig | null {
  const values = {
    clientId: GOOGLE_BP_CLIENT_ID,
    clientSecret: GOOGLE_BP_CLIENT_SECRET,
    refreshToken: GOOGLE_BP_REFRESH_TOKEN,
    accountId: GOOGLE_BP_ACCOUNT_ID,
    locationId: GOOGLE_BP_LOCATION_ID,
  };
  for (const v of Object.values(values)) {
    if (typeof v !== "string" || v.trim() === "") return null;
  }
  return values as ReviewsConfig;
}

export const cacheTtlMs = (REVIEWS_CACHE_TTL_SECONDS ?? 43200) * 1000;

/** Local fixture toggle; only honoured by the gate in index.ts. */
export const fixtureToggle: string | undefined = REVIEWS_FIXTURE ?? undefined;
