/**
 * Runtime wiring for the GoogleReviews island. This is the only module the
 * island imports.
 *
 * Order matters: local fixtures (dev only) and missing configuration are
 * resolved first, so neither path constructs storage (on Netlify that would
 * mean the Blobs adapter) or a provider. Only a configured runtime reaches
 * the loader with real factories, and the loader calls them lazily.
 *
 *   fixtures  → local dev only (see gate.ts); the import sits inside an
 *               `import.meta.env.DEV` branch so production builds drop it
 *   store     → Netlify Blobs on Netlify, in-memory everywhere else
 *   provider  → Business Profile placeholder (Phase A never fetches)
 */
import { DEFAULT_RULES, type CacheRules, type CacheStore } from "./cache.ts";
import { cacheTtlMs, fixtureToggle, readReviewsConfig } from "./env.ts";
import { resolveFixtureScenario } from "./gate.ts";
import { loadReviews } from "./loader.ts";
import { MemoryStore } from "./memory-store.ts";
import { createBusinessProfileProvider } from "./provider.ts";
import type { ReviewsResult } from "./types.ts";

const onNetlify = process.env.NETLIFY === "true";

let store: CacheStore | null = null;
/** Lazy; a failed construction is not memoised so the next request retries. */
async function createStore(): Promise<CacheStore> {
  if (store) return store;
  if (onNetlify) {
    const { createBlobCacheStore } = await import("./blob-store.ts");
    store = createBlobCacheStore();
  } else {
    store = new MemoryStore();
  }
  return store;
}

const rules: CacheRules = { ...DEFAULT_RULES, freshMs: cacheTtlMs };

export async function getReviews(): Promise<ReviewsResult> {
  const now = () => new Date();

  if (import.meta.env.DEV) {
    const scenario = resolveFixtureScenario({
      dev: true,
      netlifyFlag: process.env.NETLIFY,
      deployContext: process.env.CONTEXT,
      toggle: fixtureToggle,
    });
    if (scenario) {
      const { fixtureResult } = await import("./fixtures.ts");
      return fixtureResult(scenario, now());
    }
  }

  const config = readReviewsConfig();
  if (!config) return { state: "not-connected" };

  return loadReviews({
    config,
    createStore,
    createProvider: () => createBusinessProfileProvider(config),
    now,
    rules,
    log: (line) => console.error(line),
  });
}
