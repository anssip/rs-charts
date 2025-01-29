export interface CacheKey {
  toString(): string;
}

export interface TimeRange {
  start: number;
  end: number;
}

export class ApiCache<K, V> {
  private cache: Map<string, Map<K, V>> = new Map();
  private bufferedRanges: Map<string, TimeRange> = new Map();
  private pendingFetches: Map<
    string,
    { promise: Promise<void>; resolve: (value: void) => void }
  > = new Map();

  constructor() {}

  private getRangeKey(
    key: CacheKey,
    timeRange: TimeRange,
    indicators: string[] = []
  ): string {
    const sortedIndicators = [...indicators].sort().join(",");
    return `${key}:${Math.floor(Number(timeRange.start))}:${Math.ceil(
      Number(timeRange.end)
    )}:${sortedIndicators}`;
  }

  public getBaseKey(key: CacheKey, indicators: string[] = []): string {
    const sortedIndicators = [...indicators].sort().join(",");
    return `${key}:${sortedIndicators}`;
  }

  isWithinBufferedRange(
    key: CacheKey,
    timeRange: TimeRange,
    indicators: string[] = []
  ): boolean {
    const bufferedRange = this.bufferedRanges.get(
      this.getBaseKey(key, indicators)
    );
    if (!bufferedRange) return false;

    const requestStart = Math.floor(Number(timeRange.start));
    const requestEnd = Math.ceil(Number(timeRange.end));
    const bufferedStart = Math.floor(Number(bufferedRange.start));
    const bufferedEnd = Math.ceil(Number(bufferedRange.end));

    return requestStart >= bufferedStart && requestEnd <= bufferedEnd;
  }

  isPendingFetch(
    key: CacheKey,
    timeRange: TimeRange,
    indicators: string[] = []
  ): Promise<void> | null {
    const rangeKey = this.getRangeKey(key, timeRange, indicators);
    return this.pendingFetches.get(rangeKey)?.promise || null;
  }

  markFetchPending(
    key: CacheKey,
    timeRange: TimeRange,
    indicators: string[] = []
  ): Promise<void> {
    const rangeKey = this.getRangeKey(key, timeRange, indicators);
    let resolvePromise: (value: void) => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    this.pendingFetches.set(rangeKey, { promise, resolve: resolvePromise! });
    return promise;
  }

  markFetchComplete(
    key: CacheKey,
    timeRange: TimeRange,
    indicators: string[] = []
  ): void {
    const rangeKey = this.getRangeKey(key, timeRange, indicators);
    const pending = this.pendingFetches.get(rangeKey);
    if (pending?.resolve) {
      pending.resolve();
    }
    this.pendingFetches.delete(rangeKey);
  }

  updateBufferedRange(
    key: CacheKey,
    timeRange: TimeRange,
    minStart: number,
    maxEnd: number,
    indicators: string[] = []
  ): void {
    const baseKey = this.getBaseKey(key, indicators);
    const existingRange = this.bufferedRanges.get(baseKey);
    const updatedRange = {
      start: existingRange
        ? Math.min(minStart, Number(existingRange.start))
        : minStart,
      end: existingRange ? Math.max(maxEnd, Number(existingRange.end)) : maxEnd,
    };

    this.bufferedRanges.set(baseKey, updatedRange);
  }

  updateCache(
    key: CacheKey,
    timeRange: TimeRange,
    newData: Map<K, V>,
    getBufferedRangeMinMax: (data: Map<K, V>) => { min: number; max: number },
    indicators: string[] = []
  ): Map<K, V> {
    const { min: minStartInResult, max: maxEndInResult } =
      getBufferedRangeMinMax(newData);

    const effectiveStart = Math.min(timeRange.start, minStartInResult);
    const effectiveEnd = Math.max(timeRange.end, maxEndInResult);

    this.updateBufferedRange(
      key,
      timeRange,
      effectiveStart,
      effectiveEnd,
      indicators
    );

    const baseKey = this.getBaseKey(key, indicators);
    const existingData = this.get(baseKey) || new Map<K, V>();
    const mergedData = new Map([...existingData, ...newData]);
    this.set(baseKey, mergedData);

    return this.get(baseKey) || new Map<K, V>();
  }

  get(key: string): Map<K, V> | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: Map<K, V>): void {
    this.cache.set(key, value);
  }
}
