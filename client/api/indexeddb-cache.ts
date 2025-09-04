import {
  Candle,
  CandleDataByTimestamp,
  Granularity,
} from "../../server/services/price-data/price-history-model";
import { getLogger } from "../util/logger";

const logger = getLogger("indexeddb-cache");

const DB_NAME = "RSChartsCache";
const DB_VERSION = 2; // Incremented to trigger schema upgrade
const CANDLE_STORE = "candles";
const META_STORE = "metadata";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

export interface CandleRecord {
  id: string; // composite key: symbol:granularity:timestamp:indicators
  symbol: string;
  granularity: Granularity;
  timestamp: number;
  indicators: string;
  candle: Candle;
  lastAccessed: number;
  size: number;
}

export interface MetadataRecord {
  key: string; // symbol:granularity:indicators
  minTimestamp: number;
  maxTimestamp: number;
  lastUpdated: number;
  totalSize: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private pendingFetches: Map<string, Promise<void>> = new Map();

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info("IndexedDB initialized successfully");
        this.startBackgroundCleanup();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create candles store
        if (!db.objectStoreNames.contains(CANDLE_STORE)) {
          const candleStore = db.createObjectStore(CANDLE_STORE, {
            keyPath: "id",
          });
          candleStore.createIndex("by_key", ["symbol", "granularity", "indicators"], {
            unique: false,
          });
          candleStore.createIndex("by_timestamp", ["symbol", "granularity", "timestamp", "indicators"], {
            unique: false,
          });
          candleStore.createIndex("by_last_accessed", "lastAccessed", {
            unique: false,
          });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private getCacheKey(
    symbol: string,
    granularity: Granularity,
    indicators: string[] = []
  ): string {
    const sortedIndicators = [...indicators].sort().join(",");
    return `${symbol}:${granularity}:${sortedIndicators}`;
  }

  private getCandleId(
    symbol: string,
    granularity: Granularity,
    timestamp: number,
    indicators: string[] = []
  ): string {
    const sortedIndicators = [...indicators].sort().join(",");
    return `${symbol}:${granularity}:${timestamp}:${sortedIndicators}`;
  }

  async isWithinCachedRange(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[] = []
  ): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.db) return false;

    const key = this.getCacheKey(symbol, granularity, indicators);
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([META_STORE], "readonly");
      const store = transaction.objectStore(META_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const metadata = request.result as MetadataRecord;
        if (!metadata) {
          resolve(false);
          return;
        }

        const isExpired = Date.now() - metadata.lastUpdated > CACHE_EXPIRY_MS;
        if (isExpired) {
          resolve(false);
          return;
        }

        const isWithinRange =
          timeRange.start >= metadata.minTimestamp &&
          timeRange.end <= metadata.maxTimestamp;
        
        resolve(isWithinRange);
      };

      request.onerror = () => {
        logger.error("Failed to check cached range:", request.error);
        resolve(false);
      };
    });
  }

  async getCachedCandles(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[] = []
  ): Promise<CandleDataByTimestamp> {
    await this.ensureInitialized();
    if (!this.db) return new Map();

    const sortedIndicators = [...indicators].sort().join(",");
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CANDLE_STORE], "readwrite");
      const store = transaction.objectStore(CANDLE_STORE);
      const index = store.index("by_timestamp");
      
      const lowerBound = [symbol, granularity, timeRange.start, sortedIndicators];
      const upperBound = [symbol, granularity, timeRange.end, sortedIndicators];
      const range = IDBKeyRange.bound(lowerBound, upperBound);
      
      const request = index.openCursor(range);
      const candles = new Map<number, Candle>();
      const now = Date.now();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const record = cursor.value as CandleRecord;
          
          // IMPORTANT: Verify exact match for symbol, granularity, and indicators
          // The compound index might return partial matches, so we need to filter
          if (record.symbol === symbol && 
              record.granularity === granularity && 
              record.indicators === sortedIndicators &&
              record.timestamp >= timeRange.start &&
              record.timestamp <= timeRange.end) {
            
            candles.set(record.timestamp, record.candle);
            
            // Update last accessed time
            record.lastAccessed = now;
            cursor.update(record);
          }
          
          cursor.continue();
        } else {
          resolve(candles);
        }
      };

      request.onerror = () => {
        logger.error("Failed to get cached candles:", request.error);
        resolve(new Map());
      };
    });
  }

  async updateCache(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    candles: CandleDataByTimestamp,
    indicators: string[] = []
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.db || candles.size === 0) return;

    const key = this.getCacheKey(symbol, granularity, indicators);
    const sortedIndicators = [...indicators].sort().join(",");
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CANDLE_STORE, META_STORE],
        "readwrite"
      );
      const candleStore = transaction.objectStore(CANDLE_STORE);
      const metaStore = transaction.objectStore(META_STORE);
      
      let totalSize = 0;
      let minTimestamp = Infinity;
      let maxTimestamp = -Infinity;
      const now = Date.now();

      // Store each candle
      candles.forEach((candle, timestamp) => {
        const id = this.getCandleId(symbol, granularity, timestamp, indicators);
        const size = JSON.stringify(candle).length;
        totalSize += size;
        
        minTimestamp = Math.min(minTimestamp, timestamp);
        maxTimestamp = Math.max(maxTimestamp, timestamp);

        const record: CandleRecord = {
          id,
          symbol,
          granularity,
          timestamp,
          indicators: sortedIndicators,
          candle,
          lastAccessed: now,
          size,
        };

        candleStore.put(record);
      });

      // Update or create metadata
      const metaRequest = metaStore.get(key);
      
      metaRequest.onsuccess = () => {
        const existingMeta = metaRequest.result as MetadataRecord;
        
        const metadata: MetadataRecord = {
          key,
          minTimestamp: existingMeta
            ? Math.min(existingMeta.minTimestamp, minTimestamp)
            : minTimestamp,
          maxTimestamp: existingMeta
            ? Math.max(existingMeta.maxTimestamp, maxTimestamp)
            : maxTimestamp,
          lastUpdated: now,
          totalSize: existingMeta
            ? existingMeta.totalSize + totalSize
            : totalSize,
        };

        metaStore.put(metadata);
      };

      transaction.oncomplete = () => {
        logger.debug(`Cached ${candles.size} candles for ${key}`);
        resolve();
      };

      transaction.onerror = () => {
        logger.error("Failed to update cache:", transaction.error);
        reject(transaction.error);
      };
    });
  }

  isPendingFetch(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[] = []
  ): Promise<void> | null {
    const key = `${this.getCacheKey(symbol, granularity, indicators)}:${timeRange.start}:${timeRange.end}`;
    return this.pendingFetches.get(key) || null;
  }

  markFetchPending(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[] = []
  ): Promise<void> {
    const key = `${this.getCacheKey(symbol, granularity, indicators)}:${timeRange.start}:${timeRange.end}`;
    const promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        this.pendingFetches.delete(key);
        resolve();
      }, 0);
    });
    this.pendingFetches.set(key, promise);
    return promise;
  }

  markFetchComplete(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[] = []
  ): void {
    const key = `${this.getCacheKey(symbol, granularity, indicators)}:${timeRange.start}:${timeRange.end}`;
    this.pendingFetches.delete(key);
  }

  private async startBackgroundCleanup(): Promise<void> {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  private async cleanupOldData(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    const transaction = this.db.transaction([CANDLE_STORE, META_STORE], "readwrite");
    const candleStore = transaction.objectStore(CANDLE_STORE);
    const metaStore = transaction.objectStore(META_STORE);
    
    // Remove expired metadata
    const metaRequest = metaStore.openCursor();
    const now = Date.now();
    
    metaRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const metadata = cursor.value as MetadataRecord;
        if (now - metadata.lastUpdated > CACHE_EXPIRY_MS) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    // Calculate total cache size and remove least recently used if needed
    const sizeRequest = candleStore.index("by_last_accessed").openCursor();
    let totalSize = 0;
    const recordsToDelete: string[] = [];
    
    sizeRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const record = cursor.value as CandleRecord;
        totalSize += record.size;
        
        // If cache is too large or record is too old, mark for deletion
        if (totalSize > MAX_CACHE_SIZE || now - record.lastAccessed > CACHE_EXPIRY_MS) {
          recordsToDelete.push(record.id);
        }
        cursor.continue();
      } else {
        // Delete marked records
        recordsToDelete.forEach((id) => {
          candleStore.delete(id);
        });
      }
    };
  }

  async clearCache(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CANDLE_STORE, META_STORE],
        "readwrite"
      );
      const candleStore = transaction.objectStore(CANDLE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      candleStore.clear();
      metaStore.clear();

      transaction.oncomplete = () => {
        logger.info("Cache cleared");
        resolve();
      };

      transaction.onerror = () => {
        logger.error("Failed to clear cache:", transaction.error);
        reject(transaction.error);
      };
    });
  }

  async clearCacheForSymbol(symbol: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CANDLE_STORE, META_STORE],
        "readwrite"
      );
      const candleStore = transaction.objectStore(CANDLE_STORE);
      const metaStore = transaction.objectStore(META_STORE);
      
      // Clear candles for this symbol
      const candleIndex = candleStore.index("by_key");
      const candleRequest = candleIndex.openCursor();
      
      candleRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const record = cursor.value as CandleRecord;
          if (record.symbol === symbol) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      // Clear metadata for this symbol
      const metaRequest = metaStore.openCursor();
      
      metaRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const key = cursor.key as string;
          if (key.startsWith(`${symbol}:`)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        logger.info(`Cache cleared for symbol: ${symbol}`);
        resolve();
      };

      transaction.onerror = () => {
        logger.error(`Failed to clear cache for symbol ${symbol}:`, transaction.error);
        reject(transaction.error);
      };
    });
  }

  async getCacheStats(): Promise<{
    totalRecords: number;
    totalSize: number;
    oldestRecord: number;
    newestRecord: number;
  }> {
    await this.ensureInitialized();
    if (!this.db) {
      return {
        totalRecords: 0,
        totalSize: 0,
        oldestRecord: 0,
        newestRecord: 0,
      };
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([CANDLE_STORE], "readonly");
      const store = transaction.objectStore(CANDLE_STORE);
      
      let totalRecords = 0;
      let totalSize = 0;
      let oldestRecord = Infinity;
      let newestRecord = -Infinity;
      
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const record = cursor.value as CandleRecord;
          totalRecords++;
          totalSize += record.size;
          oldestRecord = Math.min(oldestRecord, record.lastAccessed);
          newestRecord = Math.max(newestRecord, record.lastAccessed);
          cursor.continue();
        } else {
          resolve({
            totalRecords,
            totalSize,
            oldestRecord: oldestRecord === Infinity ? 0 : oldestRecord,
            newestRecord: newestRecord === -Infinity ? 0 : newestRecord,
          });
        }
      };

      request.onerror = () => {
        logger.error("Failed to get cache stats:", request.error);
        resolve({
          totalRecords: 0,
          totalSize: 0,
          oldestRecord: 0,
          newestRecord: 0,
        });
      };
    });
  }
}