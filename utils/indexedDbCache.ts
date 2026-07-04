const DB_NAME = 'malawi-models-cache';
const DB_VERSION = 1;
const RECORD_STORE = 'records';
const IMAGE_STORE = 'images';

const DATA_PREFIX = 'data:';
const IMAGE_PREFIX = 'image:';
const DEFAULT_DATA_TTL_MS = 2 * 60 * 1000;
const DEFAULT_IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGE_CACHE_BYTES = 60 * 1024 * 1024;
const MAX_DATA_CACHE_BYTES = 8 * 1024 * 1024;

type CacheStoreName = typeof RECORD_STORE | typeof IMAGE_STORE;

type CacheRecord = {
  key: string;
  payload: Blob | string;
  compressed: boolean;
  size: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

type ImageRecord = {
  key: string;
  blob: Blob;
  size: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type CachedJsonEntry<T> = {
  value: T;
  ageMs: number;
  isFresh: boolean;
};

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;

const openCacheDb = (): Promise<IDBDatabase> => {
  if (!isBrowser) return Promise.reject(new Error('IndexedDB is not available.'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const store = db.createObjectStore(RECORD_STORE, { keyPath: 'key' });
        store.createIndex('expiresAt', 'expiresAt');
        store.createIndex('updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: 'key' });
        store.createIndex('expiresAt', 'expiresAt');
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const runStore = async <T>(
  storeName: CacheStoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> => {
  const db = await openCacheDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    let result: T | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

const blobToText = (blob: Blob): Promise<string> => blob.text();

const compressText = async (text: string): Promise<{ payload: Blob | string; compressed: boolean; size: number }> => {
  if (typeof CompressionStream === 'undefined') {
    return { payload: text, compressed: false, size: new Blob([text]).size };
  }

  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const payload = await new Response(stream).blob();
  return { payload, compressed: true, size: payload.size };
};

const decompressText = async (payload: Blob | string, compressed: boolean): Promise<string> => {
  if (!compressed) return typeof payload === 'string' ? payload : blobToText(payload);
  if (typeof DecompressionStream === 'undefined') return blobToText(payload as Blob);

  const stream = (payload as Blob).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
};

const pruneStore = async (storeName: CacheStoreName, maxBytes: number): Promise<void> => {
  if (!isBrowser) return;

  const db = await openCacheDb();
  const now = Date.now();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();
    let totalBytes = 0;
    const entries: Array<{ key: string; updatedAt: number; size: number }> = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const value = cursor.value as CacheRecord | ImageRecord;
      if (value.expiresAt <= now) {
        cursor.delete();
      } else {
        totalBytes += value.size || 0;
        entries.push({ key: value.key, updatedAt: value.updatedAt || 0, size: value.size || 0 });
      }
      cursor.continue();
    };

    request.onerror = () => reject(request.error);
    transaction.oncomplete = async () => {
      if (totalBytes <= maxBytes) {
        resolve();
        return;
      }

      entries.sort((a, b) => a.updatedAt - b.updatedAt);
      const keysToDelete: string[] = [];
      let remainingBytes = totalBytes;

      for (const entry of entries) {
        if (remainingBytes <= maxBytes) break;
        remainingBytes -= entry.size;
        keysToDelete.push(entry.key);
      }

      try {
        await Promise.all(keysToDelete.map((key) => runStore(storeName, 'readwrite', (store) => store.delete(key))));
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const stableCacheKey = (prefix: string, value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.keys(input as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          const next = (input as Record<string, unknown>)[key];
          if (next !== undefined) result[key] = normalize(next);
          return result;
        }, {});
    }
    return input;
  };

  return `${prefix}:${JSON.stringify(normalize(value))}`;
};

export const getCachedJson = async <T>(key: string, freshForMs = DEFAULT_DATA_TTL_MS): Promise<CachedJsonEntry<T> | null> => {
  if (!isBrowser) return null;

  try {
    const record = await runStore<CacheRecord>(RECORD_STORE, 'readonly', (store) => store.get(`${DATA_PREFIX}${key}`));
    if (!record) return null;

    const now = Date.now();
    if (record.expiresAt <= now) {
      runStore(RECORD_STORE, 'readwrite', (store) => store.delete(record.key)).catch(() => {});
      return null;
    }

    const text = await decompressText(record.payload, record.compressed);
    return {
      value: JSON.parse(text) as T,
      ageMs: now - record.updatedAt,
      isFresh: now - record.updatedAt <= freshForMs,
    };
  } catch (error) {
    console.warn('IndexedDB JSON cache read failed:', error);
    return null;
  }
};

export const setCachedJson = async (key: string, value: unknown, ttlMs = DEFAULT_DATA_TTL_MS): Promise<void> => {
  if (!isBrowser) return;

  try {
    const text = JSON.stringify(value);
    const { payload, compressed, size } = await compressText(text);
    const now = Date.now();
    const record: CacheRecord = {
      key: `${DATA_PREFIX}${key}`,
      payload,
      compressed,
      size,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttlMs,
    };

    await runStore(RECORD_STORE, 'readwrite', (store) => store.put(record));
    pruneStore(RECORD_STORE, MAX_DATA_CACHE_BYTES).catch(() => {});
  } catch (error) {
    console.warn('IndexedDB JSON cache write failed:', error);
  }
};

const imageKey = (url: string): string => `${IMAGE_PREFIX}${url}`;

export const getCachedImageObjectUrl = async (url: string): Promise<string | null> => {
  if (!isBrowser || !url || url.startsWith('blob:') || url.startsWith('data:')) return null;

  try {
    const record = await runStore<ImageRecord>(IMAGE_STORE, 'readonly', (store) => store.get(imageKey(url)));
    if (!record) return null;

    if (record.expiresAt <= Date.now()) {
      runStore(IMAGE_STORE, 'readwrite', (store) => store.delete(record.key)).catch(() => {});
      return null;
    }

    return URL.createObjectURL(record.blob);
  } catch (error) {
    console.warn('IndexedDB image cache read failed:', error);
    return null;
  }
};

export const cacheImageFromUrl = async (url: string, ttlMs = DEFAULT_IMAGE_TTL_MS): Promise<void> => {
  if (!isBrowser || !url || url.startsWith('blob:') || url.startsWith('data:')) return;

  try {
    const existing = await runStore<ImageRecord>(IMAGE_STORE, 'readonly', (store) => store.get(imageKey(url)));
    if (existing && existing.expiresAt > Date.now()) return;

    const response = await fetch(url, { cache: 'force-cache', mode: 'cors' });
    if (!response.ok) return;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return;

    const blob = await response.blob();
    const now = Date.now();
    const record: ImageRecord = {
      key: imageKey(url),
      blob,
      size: blob.size,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttlMs,
    };

    await runStore(IMAGE_STORE, 'readwrite', (store) => store.put(record));
    pruneStore(IMAGE_STORE, MAX_IMAGE_CACHE_BYTES).catch(() => {});
  } catch (error) {
    console.warn('IndexedDB image cache write failed:', error);
  }
};
