/**
 * Scheduled cleanup for the Google Reviews cache (Netlify Blobs store
 * "google-reviews"). Runs daily on published production deploys only.
 *
 * Deletes every entry whose fetchedAt is 14+ days old, independent of site
 * traffic, so stored content never approaches Google's 30-day ceiling.
 *
 * SAFETY: this function does nothing unless REVIEWS_CLEANUP_ENABLED is exactly
 * "true" in the Netlify environment. Phase A leaves it unset, so even if this
 * branch were deployed the job would log and exit. Phase B enables it together
 * with the credentials. Scheduled functions cannot be invoked by URL.
 */
import type { Config } from "@netlify/functions";
import { DEFAULT_RULES, purgeExpired } from "../../src/server/reviews/cache.ts";
import { createBlobCacheStore } from "../../src/server/reviews/blob-store.ts";

export default async function handler(): Promise<void> {
  if (process.env.REVIEWS_CLEANUP_ENABLED !== "true") {
    console.log(
      "reviews-cache-cleanup: disabled (REVIEWS_CLEANUP_ENABLED is not 'true'); nothing done",
    );
    return;
  }
  const result = await purgeExpired(
    createBlobCacheStore(),
    new Date(),
    DEFAULT_RULES,
  );
  console.log(
    `reviews-cache-cleanup: deleted ${result.deleted.length} (${result.deleted.join(", ") || "none"}), kept ${result.kept.length}`,
  );
}

export const config: Config = {
  schedule: "@daily",
};
