/**
 * Orchestrates fixtures → configuration → cache → provider into a ReviewsResult.
 * Pure: every dependency is injected (see index.ts for the runtime wiring).
 *
 * Failure isolation:
 *   - fixture and missing configuration return before any factory is called
 *   - store construction, cache read and expired-entry deletion failures make
 *     the cache "unavailable"; the provider is still attempted
 *   - a provider failure is the only thing that yields `state: "error"`, and
 *     only when no stale snapshot may be served
 *   - a cache write failure after a successful fetch is logged and the fresh
 *     live result is returned anyway
 * Cache failure logs carry the operation and the error's name only.
 */
import {
  readSnapshot,
  writeSnapshot,
  type CacheRead,
  type CacheRules,
  type CacheStore,
  DEFAULT_RULES,
} from "./cache.ts";
import { ProviderError, type ReviewsProvider } from "./provider.ts";
import type { ErrorReason, ReviewsConfig, ReviewsResult } from "./types.ts";

export interface LoaderDeps {
  /** `null` when any required secret is missing → "not-connected". */
  config: ReviewsConfig | null;
  /** Lazily constructs the cache store; never called for fixture / not-connected results. */
  createStore: () => CacheStore | Promise<CacheStore>;
  /** Lazily constructs the provider; `null` when there is no configuration. */
  createProvider: (() => ReviewsProvider) | null;
  now: () => Date;
  rules?: CacheRules;
  /** A pre-resolved fixture result (local development only). Wins over everything else. */
  fixture?: ReviewsResult | null;
  /** Sanitized log sink; receives one line per failure, never secrets or bodies. */
  log?: (line: string) => void;
}

/** Error *name* only: never the message, which could echo platform or response details. */
function nameOf(err: unknown): string {
  return err instanceof Error && err.name ? err.name : "UnknownError";
}

function providerFailure(err: unknown): {
  reason: ErrorReason;
  detail: string;
} {
  if (err instanceof ProviderError)
    return { reason: err.reason, detail: err.message };
  return { reason: "network", detail: nameOf(err) };
}

export async function loadReviews(deps: LoaderDeps): Promise<ReviewsResult> {
  const {
    config,
    createStore,
    createProvider,
    now,
    fixture,
    log = () => {},
  } = deps;
  const rules = deps.rules ?? DEFAULT_RULES;

  if (fixture) return fixture;
  if (!config || !createProvider) return { state: "not-connected" };

  // 1. Cache: any failure here means "unavailable", not "empty".
  let store: CacheStore | null = null;
  let cached: CacheRead = { kind: "miss" };
  try {
    store = await createStore();
  } catch (err) {
    log(`reviews: cache unavailable (store init failed: ${nameOf(err)})`);
  }
  if (store) {
    try {
      cached = await readSnapshot(store, now(), rules);
      if (cached.kind === "expired" && !cached.deleted) {
        log(
          "reviews: cache delete failed (expired entry kept, not served; cleanup job will retry)",
        );
      }
    } catch (err) {
      log(
        `reviews: cache read failed (${nameOf(err)}); treating cache as unavailable`,
      );
      cached = { kind: "miss" };
    }
  }

  if (cached.kind === "fresh") {
    return {
      state: "ok",
      reviews: cached.snapshot.reviews,
      fetchedAt: cached.snapshot.fetchedAt,
      source: "cache",
    };
  }

  // 2. Provider: the only source of `state: "error"`.
  let reviews;
  try {
    reviews = await createProvider().fetchReviews();
  } catch (err) {
    const { reason, detail } = providerFailure(err);
    if (cached.kind === "stale") {
      log(
        `reviews: live fetch failed (${reason}: ${detail}); serving stale snapshot from ${cached.snapshot.fetchedAt}`,
      );
      return {
        state: "ok",
        reviews: cached.snapshot.reviews,
        fetchedAt: cached.snapshot.fetchedAt,
        source: "stale",
      };
    }
    log(`reviews: live fetch failed (${reason}: ${detail}); nothing to serve`);
    return { state: "error", reason, detail };
  }

  // 3. Persistence: best effort; never changes the outcome of a successful fetch.
  const fetchedAt = now().toISOString();
  if (store) {
    try {
      await writeSnapshot(store, { fetchedAt, reviews });
    } catch (err) {
      log(
        `reviews: cache write failed (${nameOf(err)}); serving live result without persistence`,
      );
    }
  }
  return { state: "ok", reviews, fetchedAt, source: "live" };
}
