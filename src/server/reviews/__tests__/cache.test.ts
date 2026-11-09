import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_KEY,
  DEFAULT_RULES,
  POLICY_CEILING_MS,
  classifyAge,
  purgeExpired,
  readSnapshot,
  writeSnapshot,
} from "../cache.ts";
import { MemoryStore } from "../memory-store.ts";
import type { ReviewsSnapshot } from "../types.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = new Date("2026-11-09T12:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const snap = (fetchedAt: Date): ReviewsSnapshot => ({
  fetchedAt: fetchedAt.toISOString(),
  reviews: [],
});

test("rules sit well inside Google's 30-day ceiling", () => {
  assert.ok(DEFAULT_RULES.freshMs < DEFAULT_RULES.staleMaxMs);
  assert.ok(DEFAULT_RULES.staleMaxMs < DEFAULT_RULES.deleteAfterMs);
  assert.ok(
    DEFAULT_RULES.deleteAfterMs <= POLICY_CEILING_MS / 2,
    "deletion at or before half the ceiling",
  );
});

test("classifyAge boundaries: fresh → stale → unservable → expired", () => {
  const f = T0.toISOString();
  assert.equal(classifyAge(f, at(0)), "fresh");
  assert.equal(classifyAge(f, at(12 * HOUR - 1)), "fresh");
  assert.equal(classifyAge(f, at(12 * HOUR)), "stale");
  assert.equal(classifyAge(f, at(7 * DAY - 1)), "stale");
  assert.equal(classifyAge(f, at(7 * DAY)), "unservable");
  assert.equal(classifyAge(f, at(14 * DAY - 1)), "unservable");
  assert.equal(classifyAge(f, at(14 * DAY)), "expired");
  assert.equal(classifyAge(f, at(30 * DAY)), "expired");
});

test("classifyAge treats garbage and future timestamps as expired", () => {
  assert.equal(classifyAge("not a date", T0), "expired");
  assert.equal(classifyAge("", T0), "expired");
  assert.equal(classifyAge(at(HOUR).toISOString(), T0), "expired");
});

test("readSnapshot: miss, fresh, stale, unservable, expired-deleted", async () => {
  const store = new MemoryStore();
  assert.deepEqual(await readSnapshot(store, T0), { kind: "miss" });

  await writeSnapshot(store, snap(T0));
  assert.equal((await readSnapshot(store, at(HOUR))).kind, "fresh");
  assert.equal((await readSnapshot(store, at(13 * HOUR))).kind, "stale");
  assert.equal((await readSnapshot(store, at(8 * DAY))).kind, "unservable");
  assert.equal(store.size(), 1, "unservable entries stay until cleanup");

  assert.deepEqual(await readSnapshot(store, at(14 * DAY)), {
    kind: "expired",
    deleted: true,
  });
  assert.equal(store.size(), 0, "expired entry deleted on read");
});

test("readSnapshot deletes malformed values", async () => {
  const store = new MemoryStore();
  await store.set(CACHE_KEY, { nope: true }, {});
  assert.deepEqual(await readSnapshot(store, T0), {
    kind: "expired",
    deleted: true,
  });
  assert.equal(store.size(), 0);
});

test("readSnapshot reports a failed expired-entry delete instead of throwing; entry is never served", async () => {
  const inner = new MemoryStore();
  await writeSnapshot(inner, snap(at(-20 * DAY)));
  const store = {
    get: (k: string) => inner.get(k),
    set: (k: string, v: unknown, m: Record<string, unknown>) =>
      inner.set(k, v, m),
    delete: async () => {
      throw new Error("delete denied");
    },
    list: () => inner.list(),
  };
  assert.deepEqual(await readSnapshot(store, T0), {
    kind: "expired",
    deleted: false,
  });
  assert.equal(inner.size(), 1, "left for the cleanup job");
});

test("readSnapshot propagates a failing get (caller treats the cache as unavailable)", async () => {
  const store = {
    get: async () => {
      throw new Error("read denied");
    },
    set: async () => {},
    delete: async () => {},
    list: async () => [],
  };
  await assert.rejects(readSnapshot(store, T0), /read denied/);
});

test("writeSnapshot duplicates fetchedAt into metadata for the cleanup job", async () => {
  const store = new MemoryStore();
  await writeSnapshot(store, snap(T0));
  const [entry] = await store.list();
  assert.equal(entry.key, CACHE_KEY);
  assert.equal(entry.metadata.fetchedAt, T0.toISOString());
});

test("purgeExpired removes entries at/after 14 days and entries without metadata, keeps the rest", async () => {
  const store = new MemoryStore();
  await store.set("fresh", {}, { fetchedAt: at(-HOUR).toISOString() });
  await store.set("stale", {}, { fetchedAt: at(-2 * DAY).toISOString() });
  await store.set("unservable", {}, { fetchedAt: at(-10 * DAY).toISOString() });
  await store.set("boundary", {}, { fetchedAt: at(-14 * DAY).toISOString() });
  await store.set("old", {}, { fetchedAt: at(-29 * DAY).toISOString() });
  await store.set("no-meta", {}, {});

  const result = await purgeExpired(store, T0);
  assert.deepEqual(result.deleted.sort(), ["boundary", "no-meta", "old"]);
  assert.deepEqual(result.kept.sort(), ["fresh", "stale", "unservable"]);
  assert.equal(store.size(), 3);
});
