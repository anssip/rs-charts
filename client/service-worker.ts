/// <reference lib="webworker" />

import { Granularity, granularityToMs } from "../server/services/price-data/price-history-model";

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "rs-charts-v1";
const API_BASE_URL = import.meta.env?.API_BASE_URL || "https://market.spotcanvas.com";
const PREFETCH_MULTIPLIER = 2; // Prefetch 2x viewport width on each side
const PREFETCH_INTERVAL = 30000; // Check for prefetch opportunities every 30 seconds
const MAX_CONCURRENT_FETCHES = 3;

interface PrefetchRequest {
  symbol: string;
  granularity: Granularity;
  timeRange: { start: number; end: number };
  indicators: string[];
  viewportWidth: number;
}

interface PrefetchTask {
  id: string;
  request: PrefetchRequest;
  priority: number;
  timestamp: number;
}

class PrefetchQueue {
  private queue: PrefetchTask[] = [];
  private processing = false;
  private activeFetches = 0;

  add(task: PrefetchTask): void {
    // Remove any existing task with the same ID
    this.queue = this.queue.filter((t) => t.id !== task.id);
    
    // Add the new task
    this.queue.push(task);
    
    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Process queue if not already processing
    if (!this.processing) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeFetches < MAX_CONCURRENT_FETCHES) {
      const task = this.queue.shift();
      if (!task) break;
      
      this.activeFetches++;
      this.fetchData(task).finally(() => {
        this.activeFetches--;
      });
    }
    
    this.processing = false;
    
    // Continue processing if there are more tasks
    if (this.queue.length > 0) {
      setTimeout(() => this.process(), 100);
    }
  }

  private async fetchData(task: PrefetchTask): Promise<void> {
    const { symbol, granularity, timeRange, indicators } = task.request;
    
    try {
      const params = new URLSearchParams({
        symbol,
        granularity: granularity ?? "ONE_HOUR",
        start_time: timeRange.start.toString(),
        end_time: timeRange.end.toString(),
        exchange: "coinbase",
      });

      if (indicators?.length) {
        indicators.forEach((indicator) => {
          params.append("evaluators", indicator);
        });
      }

      const response = await fetch(`${API_BASE_URL}/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Send the prefetched data back to the client
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: "PREFETCH_COMPLETE",
          taskId: task.id,
          data,
          symbol,
          granularity,
          timeRange,
          indicators,
        });
      });
    } catch (error) {
      console.error("Prefetch failed:", error);
      
      // Notify clients of the failure
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: "PREFETCH_FAILED",
          taskId: task.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }
  }
}

const prefetchQueue = new PrefetchQueue();
const viewportTracking = new Map<string, PrefetchRequest>();

// Install event
self.addEventListener("install", (event) => {
  console.log("Service Worker installing");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(self.clients.claim());
});

// Fetch event - intercept network requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Only intercept API calls to /history
  if (url.pathname.includes("/history")) {
    event.respondWith(handleHistoryRequest(event.request));
  } else {
    event.respondWith(fetch(event.request));
  }
});

async function handleHistoryRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = url.searchParams;
  
  // Extract request parameters
  const symbol = params.get("symbol");
  const granularity = params.get("granularity") as Granularity;
  const startTime = parseInt(params.get("start_time") || "0");
  const endTime = parseInt(params.get("end_time") || "0");
  
  // Try cache first
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Return cached response but trigger background update
    triggerBackgroundUpdate(request.clone());
    return cachedResponse;
  }
  
  // Fetch from network
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache the response
      const responseClone = response.clone();
      cache.put(request, responseClone);
      
      // Schedule prefetch for adjacent data
      if (symbol && granularity) {
        schedulePrefetch({
          symbol,
          granularity,
          timeRange: { start: startTime, end: endTime },
          indicators: params.getAll("evaluators"),
          viewportWidth: endTime - startTime,
        });
      }
    }
    
    return response;
  } catch (error) {
    // If network fails, try to return cached response even if stale
    const cachedResponse = await cache.match(request, { ignoreSearch: false });
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function triggerBackgroundUpdate(request: Request): Promise<void> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response);
    }
  } catch (error) {
    // Silent fail for background updates
    console.error("Background update failed:", error);
  }
}

function schedulePrefetch(request: PrefetchRequest): void {
  const { symbol, granularity, timeRange, indicators, viewportWidth } = request;
  const intervalMs = granularityToMs(granularity);
  const candlesInViewport = Math.floor(viewportWidth / intervalMs);
  
  // Calculate prefetch ranges
  const prefetchWidth = candlesInViewport * PREFETCH_MULTIPLIER * intervalMs;
  
  // Prefetch before current range
  const beforeTask: PrefetchTask = {
    id: `${symbol}:${granularity}:before:${timeRange.start}`,
    request: {
      ...request,
      timeRange: {
        start: timeRange.start - prefetchWidth,
        end: timeRange.start,
      },
    },
    priority: 5,
    timestamp: Date.now(),
  };
  
  // Prefetch after current range
  const afterTask: PrefetchTask = {
    id: `${symbol}:${granularity}:after:${timeRange.end}`,
    request: {
      ...request,
      timeRange: {
        start: timeRange.end,
        end: timeRange.end + prefetchWidth,
      },
    },
    priority: 5,
    timestamp: Date.now(),
  };
  
  prefetchQueue.add(beforeTask);
  prefetchQueue.add(afterTask);
  
  // Track viewport for intelligent prefetching
  const key = `${symbol}:${granularity}:${indicators.sort().join(",")}`;
  viewportTracking.set(key, request);
}

// Message event - handle communication with clients
self.addEventListener("message", (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case "VIEWPORT_UPDATE":
      handleViewportUpdate(data);
      break;
      
    case "PREFETCH_REQUEST":
      handlePrefetchRequest(data);
      break;
      
    case "CLEAR_CACHE":
      handleClearCache();
      break;
      
    case "CACHE_STATS":
      handleCacheStats(event);
      break;
  }
});

function handleViewportUpdate(data: {
  symbol: string;
  granularity: Granularity;
  timeRange: { start: number; end: number };
  indicators: string[];
}): void {
  const { symbol, granularity, timeRange, indicators } = data;
  const viewportWidth = timeRange.end - timeRange.start;
  
  schedulePrefetch({
    symbol,
    granularity,
    timeRange,
    indicators,
    viewportWidth,
  });
}

function handlePrefetchRequest(data: {
  symbol: string;
  granularity: Granularity;
  timeRange: { start: number; end: number };
  indicators: string[];
  priority?: number;
}): void {
  const { symbol, granularity, timeRange, indicators, priority = 10 } = data;
  
  const task: PrefetchTask = {
    id: `${symbol}:${granularity}:${timeRange.start}:${timeRange.end}`,
    request: {
      symbol,
      granularity,
      timeRange,
      indicators,
      viewportWidth: timeRange.end - timeRange.start,
    },
    priority,
    timestamp: Date.now(),
  };
  
  prefetchQueue.add(task);
}

async function handleClearCache(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  await Promise.all(keys.map((key) => cache.delete(key)));
  
  // Notify clients
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: "CACHE_CLEARED",
    });
  });
}

async function handleCacheStats(event: ExtendableMessageEvent): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  let totalSize = 0;
  let oldestEntry = Infinity;
  let newestEntry = -Infinity;
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
      
      const dateHeader = response.headers.get("date");
      if (dateHeader) {
        const timestamp = new Date(dateHeader).getTime();
        oldestEntry = Math.min(oldestEntry, timestamp);
        newestEntry = Math.max(newestEntry, timestamp);
      }
    }
  }
  
  event.ports[0].postMessage({
    type: "CACHE_STATS_RESPONSE",
    stats: {
      totalEntries: keys.length,
      totalSize,
      oldestEntry: oldestEntry === Infinity ? null : oldestEntry,
      newestEntry: newestEntry === -Infinity ? null : newestEntry,
    },
  });
}

// Periodic cleanup of old cache entries
setInterval(async () => {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const dateHeader = response.headers.get("date");
      if (dateHeader) {
        const timestamp = new Date(dateHeader).getTime();
        if (now - timestamp > maxAge) {
          await cache.delete(request);
        }
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Intelligent prefetching based on user patterns
setInterval(() => {
  viewportTracking.forEach((request, key) => {
    // Re-prefetch data that might be needed soon
    const age = Date.now() - request.viewportWidth;
    if (age < 5 * 60 * 1000) {
      // If viewed in last 5 minutes
      schedulePrefetch(request);
    }
  });
}, PREFETCH_INTERVAL);