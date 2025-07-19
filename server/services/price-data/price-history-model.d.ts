export interface TimeRange {
    start: number;
    end: number;
}
export type Granularity = "ONE_MINUTE" | "FIVE_MINUTE" | "FIFTEEN_MINUTE" | "THIRTY_MINUTE" | "ONE_HOUR" | "TWO_HOUR" | "SIX_HOUR" | "ONE_DAY";
export declare function getAllGranularities(): Granularity[];
export declare function granularityLabel(granularity: Granularity): string;
export interface PlotStyle {
    type: "line" | "bar" | "scatter" | "area" | "band" | "histogram";
    style: {
        color?: string;
        lineWidth?: number;
        opacity?: number;
        dashArray?: number[];
        fillColor?: string;
        fillOpacity?: number;
        symbol?: string;
        symbolSize?: number;
    };
}
export interface PlotValue {
    name: string;
    timestamp: number;
    value: number;
    plot_ref: string;
}
export interface Evaluation {
    id: string;
    name: string;
    values: PlotValue[];
    plot_styles: {
        [key: string]: PlotStyle;
    };
    skipFetch?: boolean;
}
export interface Candle {
    granularity: Granularity;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    live: boolean;
    evaluations: Evaluation[];
}
export type CandleDataByTimestamp = Map<number, Candle>;
export interface PriceDataOptions {
    symbol: string;
    granularity: Granularity;
    start: Date;
    end: Date;
}
export interface PriceRange {
    min: number;
    max: number;
    range: number;
    shift(amount: number): void;
    setMin(min: number): void;
    setMax(max: number): void;
}
export interface PriceHistory {
    getGranularity(): Granularity;
    get granularityMs(): number;
    getCandle(timestamp: number): Candle | undefined;
    isCandleAvailable(timestamp: number): boolean;
    getCandlesSorted(): [number, Candle][];
    getCandles(): CandleDataByTimestamp;
    getTimestampsSorted(): number[];
    numCandles: number;
    startTimestamp: number;
    endTimestamp: number;
    length: number;
    getCandlesInRange(startTimestamp: number, endTimestamp: number): [number, Candle][];
    findNearestCandleIndex(timestamp: number): number;
    getPriceRange(startTimestamp: number, endTimestamp: number): PriceRange;
    setLiveCandle(candle: Candle): boolean;
    getGaps(startTimestamp: number, endTimestamp: number): TimeRange[];
}
export declare function asGranularity(granularity: Granularity | string): Granularity;
export declare function granularityToMs(granularity: Granularity): number;
export declare function numCandlesInRange(granularity: Granularity, startTimestamp: number, endTimestamp: number): number;
export declare class SimplePriceHistory implements PriceHistory {
    private granularity;
    private candles;
    private candlesSortedByTimestamp;
    constructor(granularity: Granularity, candles: CandleDataByTimestamp);
    /**
     * Get the closest candle to the given timestamp.
     * @param timestamp - The timestamp to search for.
     * @returns The closest candle or undefined if no candle is found within the interval.
     */
    getCandle(timestamp: number): Candle | undefined;
    /**
     * Get the granularity of the price history.
     * @returns The granularity.
     */
    getGranularity(): Granularity;
    /**
     * Check if a candle is available for the given timestamp.
     * @param timestamp - The timestamp to check.
     * @returns True if a candle is available, false otherwise.
     */
    isCandleAvailable(timestamp: number): boolean;
    /**
     * Get the candles sorted by timestamp.
     * @returns The candles sorted by timestamp.
     */
    getCandlesSorted(): [number, Candle][];
    /**
     * Get the timestamps sorted.
     * @returns The timestamps sorted.
     */
    getTimestampsSorted(): number[];
    /**
     * Get the number of candles.
     * @returns The number of candles.
     */
    get numCandles(): number;
    /**
     * Get the start timestamp.
     * @returns The start timestamp.
     */
    get startTimestamp(): number;
    /**
     * Get the end timestamp.
     * @returns The end timestamp.
     */
    get endTimestamp(): number;
    /**
     * Get the length of the price history.
     * @returns The length of the price history.
     */
    get length(): number;
    /**
     * Get the candles.
     * @returns The candles.
     */
    getCandles(): CandleDataByTimestamp;
    /**
     * Get all candles within a specified time range, inclusive
     * @param startTimestamp - Start of the range
     * @param endTimestamp - End of the range
     * @returns Array of timestamp-candle pairs within the range
     */
    getCandlesInRange(startTimestamp: number, endTimestamp: number): [number, Candle][];
    /**
     * Find the index of the nearest candle to the given timestamp using binary search
     * @param timestamp - The target timestamp
     * @returns The index of the nearest candle
     */
    findNearestCandleIndex(timestamp: number): number;
    getPriceRange(startTimestamp: number, endTimestamp: number): PriceRange;
    get granularityMs(): number;
    /**
     * Set a live candle to the price history.
     * @param candle - The live candle to set.
     * @returns True if the candle was set, false otherwise.
     */
    setLiveCandle(candle: Candle): boolean;
    getGaps(startTimestamp: number, endTimestamp: number): TimeRange[];
}
//# sourceMappingURL=price-history-model.d.ts.map