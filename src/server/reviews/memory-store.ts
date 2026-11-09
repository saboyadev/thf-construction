/**
 * In-memory CacheStore. Used by the tests and by local development, where live
 * Netlify Blobs storage must not be touched.
 */
import type { CacheStore, StoredEntry } from "./cache.ts";

export class MemoryStore implements CacheStore {
  private entries = new Map<string, StoredEntry>();

  async get(key: string): Promise<StoredEntry | null> {
    return this.entries.get(key) ?? null;
  }

  async set(
    key: string,
    value: unknown,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    this.entries.set(key, { value, metadata });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async list(): Promise<
    Array<{ key: string; metadata: Record<string, unknown> }>
  > {
    return [...this.entries].map(([key, e]) => ({ key, metadata: e.metadata }));
  }

  /** Test helper. */
  size(): number {
    return this.entries.size;
  }
}
