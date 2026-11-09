/**
 * Reviews provider interface. One implementation is planned (Google Business
 * Profile API). Phase A ships the interface and a placeholder that refuses to
 * fetch, so nothing here contacts Google, exchanges tokens or discovers
 * accounts/locations.
 */
import type { ErrorReason, GoogleReview, ReviewsConfig } from "./types.ts";

export interface ReviewsProvider {
  /** Returns the raw review list, or throws a ProviderError. */
  fetchReviews(): Promise<GoogleReview[]>;
}

export class ProviderError extends Error {
  readonly reason: ErrorReason;
  constructor(reason: ErrorReason, message: string) {
    super(message);
    this.name = "ProviderError";
    this.reason = reason;
  }
}

/**
 * Phase A placeholder. Phase B replaces the body with: refresh the access
 * token (oauth2.googleapis.com/token, grant_type=refresh_token), then GET
 * mybusiness.googleapis.com/v4/accounts/{account}/locations/{location}/reviews
 * ?pageSize=50&orderBy=updateTime%20desc. The config is accepted now so the
 * wiring is final; its values are never logged.
 */
export function createBusinessProfileProvider(
  _config: ReviewsConfig,
): ReviewsProvider {
  return {
    async fetchReviews() {
      throw new ProviderError(
        "provider",
        "Business Profile fetch is not implemented yet (Phase B).",
      );
    },
  };
}
