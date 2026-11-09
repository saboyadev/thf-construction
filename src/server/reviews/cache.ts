/**
 * Cache rules for the reviews snapshot. Three separate rules, per the plan:
 *
 *   freshness   — how long a snapshot is served without asking Google again
 *   stale limit — how old a snapshot may be and still be served when a live
 *                 fetch fails
 *   deletion    — when stored content must be removed regardless of traffic
 *                 (enforced by the scheduled cleanup function and, as a second
 *                 line of defence, by any read that encounters it)
 *
 * Google's Business Profile policy allows a temporary performance cache of at
 * most 30 calendar days. Deletion is set well inside that ceiling.
 *
 * Pure module: the store and the clock are injected so this can be exercised
 * against an in-memory store in tests and in local development.
 */
import type { ReviewsSnapshot } from "./types.ts";

export interface StoredEntry {
  value: unknown;
  metadata: Record<string, unknown>;
}

/** Minimal key/value interface satisfied by Netlify Blobs and by MemoryStore. */
export interface CacheStore {
  get(key: string): Promise<StoredEntry | null>;
  set(
    key: string,
    value: unknown,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  /** Keys with their metadata (metadata may be empty if unavailable). */
  list(): Promise<Array<{ key: string; metadata: Record<string, unknown> }>>;
}

export interface CacheRules {
  freshMs: number;
  staleMaxMs: number;
  deleteAfterMs: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const POLICY_CEILING_MS = 30 * DAY;

export const DEFAULT_RULES: CacheRules = {
  freshMs: 12 * HOUR,
  staleMaxMs: 7 * DAY,
  deleteAfterMs: 14 * DAY,
};

export const CACHE_KEY = "v1";

export type AgeClass = "fresh" | "stale" | "unservable" | "expired";

/**
 * Classify a snapshot by age.
 *   age <  freshMs                 → fresh      (serve, no refresh)
 *   freshMs ≤ age < staleMaxMs     → stale      (refresh; may serve if refresh fails)
 *   staleMaxMs ≤ age < deleteAfter → unservable (never serve; still stored until cleanup)
 *   age ≥ deleteAfterMs            → expired    (must be deleted)
 * Unparseable or future timestamps are treated as expired.
 */
export function classifyAge(
  fetchedAt: string,
  now: Date,
  rules: CacheRules = DEFAULT_RULES,
): AgeClass {
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t) || t > now.getTime()) return "expired";
  const age = now.getTime() - t;
  if (age >= rules.deleteAfterMs) return "expired";
  if (age >= rules.staleMaxMs) return "unservable";
  if (age >= rules.freshMs) return "stale";
  return "fresh";
}

export type CacheRead =
  | { kind: "miss" }
  | { kind: "fresh" | "stale"; snapshot: ReviewsSnapshot }
  | { kind: "unservable" }
  /** Past the deletion rule (or malformed). Never served. `deleted` is false when the delete itself failed. */
  | { kind: "expired"; deleted: boolean };

function isSnapshot(v: unknown): v is ReviewsSnapshot {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as ReviewsSnapshot).fetchedAt === "string" &&
    Array.isArray((v as ReviewsSnapshot).reviews)
  );
}

/**
 * Read the snapshot, applying the age rules. Deletes an expired entry it finds.
 * A failing delete is reported (`deleted: false`) rather than thrown, so the
 * caller can still proceed; the scheduled cleanup will retry. A failing `get`
 * does throw: the caller treats that as "cache unavailable".
 */
export async function readSnapshot(
  store: CacheStore,
  now: Date,
  rules: CacheRules = DEFAULT_RULES,
): Promise<CacheRead> {
  const entry = await store.get(CACHE_KEY);
  if (!entry) return { kind: "miss" };
  const expired =
    !isSnapshot(entry.value) ||
    classifyAge(entry.value.fetchedAt, now, rules) === "expired";
  if (expired) {
    let deleted = true;
    try {
      await store.delete(CACHE_KEY);
    } catch {
      deleted = false;
    }
    return { kind: "expired", deleted };
  }
  const snapshot = entry.value as ReviewsSnapshot;
  const age = classifyAge(snapshot.fetchedAt, now, rules);
  if (age === "unservable") return { kind: "unservable" };
  return { kind: age === "fresh" ? "fresh" : "stale", snapshot };
}

/** Store a snapshot; `fetchedAt` is duplicated into metadata for the cleanup job. */
export async function writeSnapshot(
  store: CacheStore,
  snapshot: ReviewsSnapshot,
): Promise<void> {
  await store.set(CACHE_KEY, snapshot, { fetchedAt: snapshot.fetchedAt });
}

export interface PurgeResult {
  deleted: string[];
  kept: string[];
}

/**
 * Traffic-independent cleanup: delete every entry whose `fetchedAt` metadata is
 * past the deletion rule. Entries with missing or unreadable metadata are
 * deleted too, since their age cannot be proven to be within policy.
 */
export async function purgeExpired(
  store: CacheStore,
  now: Date,
  rules: CacheRules = DEFAULT_RULES,
): Promise<PurgeResult> {
  const result: PurgeResult = { deleted: [], kept: [] };
  for (const { key, metadata } of await store.list()) {
    const fetchedAt =
      typeof metadata.fetchedAt === "string" ? metadata.fetchedAt : "";
    if (classifyAge(fetchedAt, now, rules) === "expired") {
      await store.delete(key);
      result.deleted.push(key);
    } else {
      result.kept.push(key);
    }
  }
  return result;
}
