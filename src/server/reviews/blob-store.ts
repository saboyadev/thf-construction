/**
 * Netlify Blobs implementation of CacheStore. Only constructed when running on
 * Netlify (see index.ts); local development and tests use MemoryStore.
 *
 * Phase A: this module is wired but is never reached without credentials, and
 * no live store is accessed from a local machine.
 */
import { getStore } from "@netlify/blobs";
import type { CacheStore, StoredEntry } from "./cache.ts";

export const STORE_NAME = "google-reviews";

export function createBlobCacheStore(name: string = STORE_NAME): CacheStore {
  const store = getStore({ name, consistency: "strong" });
  return {
    async get(key): Promise<StoredEntry | null> {
      const result = await store.getWithMetadata(key, { type: "json" });
      if (!result) return null;
      return { value: result.data, metadata: result.metadata ?? {} };
    },
    async set(key, value, metadata) {
      await store.setJSON(key, value, { metadata });
    },
    async delete(key) {
      await store.delete(key);
    },
    async list() {
      const { blobs } = await store.list();
      const out: Array<{ key: string; metadata: Record<string, unknown> }> = [];
      for (const { key } of blobs) {
        const meta = await store.getMetadata(key);
        out.push({ key, metadata: meta?.metadata ?? {} });
      }
      return out;
    },
  };
}
