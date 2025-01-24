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
  private pendingFetches: Set<string> = new Set();

  constructor() {}

  private getRangeKey(key: CacheKey, timeRange: TimeRange): string {
    return `${key}:${Math.floor(Number(timeRange.start))}:${Math.ceil(
      Number(timeRange.end)
    )}`;
  }

  isWithinBufferedRange(key: CacheKey, timeRange: TimeRange): boolean {
    const bufferedRange = this.bufferedRanges.get(key.toString());
    if (!bufferedRange) return false;

    return (
      Math.floor(Number(timeRange.start)) >=
        Math.floor(Number(bufferedRange.start)) &&
      Math.ceil(Number(timeRange.end)) <= Math.ceil(Number(bufferedRange.end))
    );
  }

  isPendingFetch(key: CacheKey, timeRange: TimeRange): boolean {
    return this.pendingFetches.has(this.getRangeKey(key, timeRange));
  }

  markFetchPending(key: CacheKey, timeRange: TimeRange): void {
    this.pendingFetches.add(this.getRangeKey(key, timeRange));
  }

  markFetchComplete(key: CacheKey, timeRange: TimeRange): void {
    this.pendingFetches.delete(this.getRangeKey(key, timeRange));
  }

  updateBufferedRange(
    key: CacheKey,
    timeRange: TimeRange,
    minStart: number,
    maxEnd: number
  ): void {
    const existingRange = this.bufferedRanges.get(key.toString());
    const updatedRange = existingRange
      ? {
          start: Math.min(minStart, Number(existingRange.start)),
          end: Math.max(maxEnd, Number(existingRange.end)),
        }
      : timeRange;

    this.bufferedRanges.set(key.toString(), updatedRange);
  }

  updateCache(
    key: CacheKey,
    timeRange: TimeRange,
    newData: Map<K, V>,
    getBufferedRangeMinMax: (data: Map<K, V>) => { min: number; max: number }
  ): Map<K, V> {
    const { min: minStartInResult, max: maxEndInResult } =
      getBufferedRangeMinMax(newData);
    console.log("Updating buffered range:", {
      minStartInResult,
      maxEndInResult,
    });
    this.updateBufferedRange(key, timeRange, minStartInResult, maxEndInResult);

    const existingData = this.get(key.toString()) || new Map<K, V>();
    const mergedData = new Map([...existingData, ...newData]);
    this.set(key.toString(), mergedData);

    return this.get(key.toString()) || new Map<K, V>();
  }

  get(key: string): Map<K, V> | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: Map<K, V>): void {
    this.cache.set(key, value);
  }
}
