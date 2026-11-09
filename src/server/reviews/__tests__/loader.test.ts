import { test } from "node:test";
import assert from "node:assert/strict";
import { CACHE_KEY, writeSnapshot, type CacheStore } from "../cache.ts";
import { fixtureResult } from "../fixtures.ts";
import { resolveFixtureScenario } from "../gate.ts";
import { loadReviews, type LoaderDeps } from "../loader.ts";
import { MemoryStore } from "../memory-store.ts";
import { ProviderError, type ReviewsProvider } from "../provider.ts";
import type { GoogleReview, ReviewsConfig } from "../types.ts";

const NOW = new Date("2026-11-09T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Distinctive values so the log assertions can prove nothing sensitive leaks.
const config: ReviewsConfig = {
  clientId: "SECRET-CLIENT-ID",
  clientSecret: "SECRET-CLIENT-SECRET",
  refreshToken: "SECRET-REFRESH-TOKEN",
  accountId: "SECRET-ACCOUNT",
  locationId: "SECRET-LOCATION",
};
const review: GoogleReview = {
  name: "accounts/a/locations/l/reviews/r1",
  reviewId: "r1",
  reviewer: { displayName: "Test", isAnonymous: false },
  starRating: "FIVE",
  comment: "hello",
  createTime: NOW.toISOString(),
  updateTime: NOW.toISOString(),
};
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

/** Provider double that counts calls. */
function fakeProvider(impl: () => Promise<GoogleReview[]>) {
  const p = {
    calls: 0,
    provider: {
      fetchReviews: async () => {
        p.calls++;
        return impl();
      },
    } as ReviewsProvider,
  };
  return p;
}
const okProvider = (reviews: GoogleReview[]) =>
  fakeProvider(async () => reviews);
const failingProvider = (err: unknown) =>
  fakeProvider(async () => {
    throw err;
  });

/** Store double: a MemoryStore whose chosen operations reject. */
function faultyStore(
  faults: Partial<Record<keyof CacheStore, Error>>,
  seed?: MemoryStore,
): CacheStore {
  const inner = seed ?? new MemoryStore();
  const wrap = <K extends keyof CacheStore>(op: K) =>
    ((...args: unknown[]) => {
      if (faults[op]) return Promise.reject(faults[op]);
      return (inner[op] as (...a: unknown[]) => unknown)(...args);
    }) as CacheStore[K];
  return {
    get: wrap("get"),
    set: wrap("set"),
    delete: wrap("delete"),
    list: wrap("list"),
  };
}

function harness(over: Partial<LoaderDeps> & { store?: CacheStore }) {
  const logs: string[] = [];
  const counters = { store: 0, provider: 0 };
  const { store: overStore, createProvider: overProvider, ...rest } = over;
  const store = overStore ?? new MemoryStore();
  const providerFactory =
    overProvider === undefined ? () => okProvider([]).provider : overProvider;
  const deps: LoaderDeps = {
    config,
    createStore: () => {
      counters.store++;
      return store;
    },
    createProvider:
      providerFactory === null
        ? null
        : () => {
            counters.provider++;
            return providerFactory();
          },
    now: () => NOW,
    log: (l) => logs.push(l),
    ...rest,
  };
  return { deps, logs, counters, store };
}

const PLATFORM_ERROR = Object.assign(
  new Error("secret platform detail: SECRET-REFRESH-TOKEN"),
  { name: "MissingBlobsEnvironmentError" },
);

test("not-connected when config is missing: store and provider factories never called", async () => {
  const h = harness({ config: null });
  const r = await loadReviews(h.deps);
  assert.deepEqual(r, { state: "not-connected" });
  assert.deepEqual(h.counters, { store: 0, provider: 0 });
  assert.equal(h.logs.length, 0);
});

test("not-connected when provider factory is null even with config", async () => {
  const h = harness({ createProvider: null });
  assert.deepEqual(await loadReviews(h.deps), { state: "not-connected" });
  assert.equal(h.counters.store, 0);
});

test("valid local fixture wins and calls no factory", async () => {
  const h = harness({ fixture: fixtureResult("populated", NOW) });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") assert.equal(r.source, "fixture");
  assert.deepEqual(h.counters, { store: 0, provider: 0 });
});

test("successful empty result is ok with zero reviews, distinct from not-connected and error", async () => {
  const h = harness({});
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") {
    assert.equal(r.reviews.length, 0);
    assert.equal(r.source, "live");
  }
  assert.equal(h.counters.provider, 1);
});

test("populated live result writes the raw snapshot to the store", async () => {
  const store = new MemoryStore();
  const h = harness({
    store,
    createProvider: () => okProvider([review]).provider,
  });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  const stored = await store.get(CACHE_KEY);
  assert.deepEqual((stored!.value as { reviews: GoogleReview[] }).reviews, [
    review,
  ]);
  assert.equal(stored!.metadata.fetchedAt, NOW.toISOString());
});

test("fresh cache is served without constructing or calling the provider", async () => {
  const store = new MemoryStore();
  await writeSnapshot(store, { fetchedAt: ago(HOUR), reviews: [review] });
  const h = harness({ store });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") assert.equal(r.source, "cache");
  assert.equal(h.counters.provider, 0);
});

test("stale cache: provider retried; on failure the stale snapshot is served and the provider failure is logged", async () => {
  const store = new MemoryStore();
  await writeSnapshot(store, { fetchedAt: ago(2 * DAY), reviews: [review] });
  const h = harness({
    store,
    createProvider: () =>
      failingProvider(new ProviderError("auth", "invalid_grant")).provider,
  });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") assert.equal(r.source, "stale");
  assert.equal(h.logs.length, 1);
  assert.match(
    h.logs[0],
    /^reviews: live fetch failed \(auth: invalid_grant\)/,
  );
});

test("beyond the stale limit nothing is served: structured error with the provider's reason", async () => {
  const store = new MemoryStore();
  await writeSnapshot(store, { fetchedAt: ago(8 * DAY), reviews: [review] });
  const h = harness({
    store,
    createProvider: () =>
      failingProvider(new ProviderError("quota", "429")).provider,
  });
  assert.deepEqual(await loadReviews(h.deps), {
    state: "error",
    reason: "quota",
    detail: "429",
  });
});

test("unknown provider errors are classified as network with the error name only", async () => {
  const h = harness({
    createProvider: () =>
      failingProvider(new TypeError("fetch failed: SECRET-CLIENT-SECRET"))
        .provider,
  });
  const r = await loadReviews(h.deps);
  assert.deepEqual(r, {
    state: "error",
    reason: "network",
    detail: "TypeError",
  });
  assert.ok(h.logs.every((l) => !l.includes("SECRET")));
});

// ── cache failure isolation ────────────────────────────────────────────────

test("cache read rejection: treated as unavailable, provider attempted, live result returned, cache failure logged", async () => {
  const h = harness({
    store: faultyStore({ get: PLATFORM_ERROR }),
    createProvider: () => okProvider([review]).provider,
  });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") {
    assert.equal(r.source, "live");
    assert.equal(r.reviews.length, 1);
  }
  assert.equal(h.counters.provider, 1);
  assert.equal(h.logs.length, 1);
  assert.match(
    h.logs[0],
    /^reviews: cache read failed \(MissingBlobsEnvironmentError\)/,
  );
});

test("expired-entry deletion rejection: entry is not served, provider attempted, delete failure logged", async () => {
  const seed = new MemoryStore();
  await writeSnapshot(seed, { fetchedAt: ago(20 * DAY), reviews: [review] });
  const store = faultyStore({ delete: new Error("delete denied") }, seed);
  const h = harness({ store, createProvider: () => okProvider([]).provider });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") {
    assert.equal(r.source, "live");
    assert.equal(r.reviews.length, 0, "the 20-day-old content was not served");
  }
  assert.equal(h.counters.provider, 1);
  assert.ok(h.logs.some((l) => l.startsWith("reviews: cache delete failed")));
  assert.equal(seed.size(), 1, "entry remains for the cleanup job");
});

test("storage factory rejection: cache unavailable, provider attempted, live result returned without persistence", async () => {
  const h = harness({
    createStore: () => {
      throw PLATFORM_ERROR;
    },
    createProvider: () => okProvider([review]).provider,
  });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") assert.equal(r.source, "live");
  assert.equal(h.logs.length, 1);
  assert.match(
    h.logs[0],
    /^reviews: cache unavailable \(store init failed: MissingBlobsEnvironmentError\)/,
  );
});

test("storage factory async rejection is handled the same way", async () => {
  const h = harness({
    createStore: async () => {
      throw PLATFORM_ERROR;
    },
    createProvider: () => okProvider([]).provider,
  });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  assert.equal(h.counters.provider, 1);
});

test("provider success then cache write rejection: fresh live result still returned, write failure logged", async () => {
  const seed = new MemoryStore();
  await writeSnapshot(seed, { fetchedAt: ago(2 * DAY), reviews: [] }); // stale snapshot must NOT be preferred
  const store = faultyStore({ set: PLATFORM_ERROR }, seed);
  const h = harness({
    store,
    createProvider: () => okProvider([review]).provider,
  });
  const r = await loadReviews(h.deps);
  assert.equal(r.state, "ok");
  if (r.state === "ok") {
    assert.equal(r.source, "live");
    assert.deepEqual(r.reviews, [review]);
    assert.equal(r.fetchedAt, NOW.toISOString());
  }
  assert.equal(h.logs.length, 1);
  assert.match(
    h.logs[0],
    /^reviews: cache write failed \(MissingBlobsEnvironmentError\)/,
  );
  assert.ok(!h.logs[0].includes("live fetch failed"));
});

test("cache unavailable plus provider failure: structured error, no uncaught rejection, both failures logged distinctly", async () => {
  const h = harness({
    store: faultyStore({ get: PLATFORM_ERROR }),
    createProvider: () =>
      failingProvider(new ProviderError("permission", "403")).provider,
  });
  const r = await loadReviews(h.deps);
  assert.deepEqual(r, { state: "error", reason: "permission", detail: "403" });
  assert.equal(h.logs.length, 2);
  assert.match(h.logs[0], /^reviews: cache read failed/);
  assert.match(h.logs[1], /^reviews: live fetch failed \(permission: 403\)/);
});

test("logs never contain configuration values or raw exception messages", async () => {
  const scenarios: Array<Partial<LoaderDeps> & { store?: CacheStore }> = [
    {
      store: faultyStore({ get: PLATFORM_ERROR }),
      createProvider: () => failingProvider(PLATFORM_ERROR).provider,
    },
    {
      createStore: () => {
        throw PLATFORM_ERROR;
      },
      createProvider: () => okProvider([review]).provider,
    },
    {
      store: faultyStore({ set: PLATFORM_ERROR }),
      createProvider: () => okProvider([review]).provider,
    },
  ];
  for (const s of scenarios) {
    const h = harness(s);
    await loadReviews(h.deps);
    for (const line of h.logs) {
      assert.ok(!line.includes("SECRET"), `leaked config value: ${line}`);
      assert.ok(
        !line.includes("secret platform detail"),
        `leaked exception message: ${line}`,
      );
      assert.ok(line.startsWith("reviews: "), `unprefixed log: ${line}`);
    }
  }
});

test("fixture gate: dev + no Netlify + known toggle only", () => {
  const base = {
    dev: true,
    netlifyFlag: undefined,
    deployContext: undefined,
    toggle: "populated",
  } as const;
  assert.equal(resolveFixtureScenario(base), "populated");
  assert.equal(resolveFixtureScenario({ ...base, toggle: "empty" }), "empty");
  assert.equal(resolveFixtureScenario({ ...base, toggle: "error" }), "error");
  assert.equal(
    resolveFixtureScenario({ ...base, toggle: "anything-else" }),
    null,
  );
  assert.equal(resolveFixtureScenario({ ...base, toggle: undefined }), null);
  assert.equal(
    resolveFixtureScenario({ ...base, dev: false }),
    null,
    "production build",
  );
  assert.equal(
    resolveFixtureScenario({ ...base, netlifyFlag: "true" }),
    null,
    "any Netlify runtime",
  );
  assert.equal(
    resolveFixtureScenario({ ...base, deployContext: "deploy-preview" }),
    null,
  );
  assert.equal(
    resolveFixtureScenario({ ...base, deployContext: "production" }),
    null,
  );
  assert.equal(
    resolveFixtureScenario({ ...base, deployContext: "dev" }),
    null,
    "netlify dev context",
  );
});
