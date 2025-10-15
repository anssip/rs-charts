import { xin, xinValue } from "xinjs";
import { ChartState } from "..";
import {
  Granularity,
  TimeRange,
} from "../../server/services/price-data/price-history-model";
import { LiveCandle } from "../api/live-candle-subscription";
import { PriceRange } from "../../server/services/price-data/price-history-model";
import { SimplePriceHistory } from "../../server/services/price-data/price-history-model";
import { IndicatorConfig } from "../components/chart/indicators/indicator-types";
import { ClickToTradeConfig } from "../types/trading-overlays";

export class ChartStateManager {
  constructor() {
    // Initialize if needed
  }

  get timeRange(): TimeRange {
    return {
      start: Number(xin["state.timeRange.start"]),
      end: Number(xin["state.timeRange.end"]),
    };
  }

  set timeRange(range: TimeRange) {
    xin["state.timeRange.start"] = range.start;
    xin["state.timeRange.end"] = range.end;
  }

  get symbol(): string {
    return String(xin["state.symbol"]);
  }

  set symbol(value: string) {
    xin["state.symbol"] = value;
  }

  get granularity(): Granularity {
    return String(xin["state.granularity"]) as Granularity;
  }

  set granularity(value: Granularity) {
    xin["state.granularity"] = value;
  }

  get priceRange(): PriceRange {
    return xinValue(xin["state.priceRange"]) as PriceRange;
  }

  set priceRange(value: PriceRange) {
    xin["state.priceRange"] = value;
  }

  get priceHistory(): SimplePriceHistory {
    return xinValue(xin["state.priceHistory"]) as SimplePriceHistory;
  }

  set priceHistory(value: SimplePriceHistory) {
    xin["state.priceHistory"] = value;
  }

  get liveCandle(): LiveCandle | null {
    return xinValue(xin["state.liveCandle"]) as LiveCandle | null;
  }

  set liveCandle(value: LiveCandle) {
    xin["state.liveCandle"] = value;
  }

  get loading(): boolean {
    return Boolean(xin["state.loading"]);
  }

  set loading(value: boolean) {
    xin["state.loading"] = value;
  }

  get clickToTrade(): ClickToTradeConfig | null {
    return xinValue(xin["state.clickToTrade"]) as ClickToTradeConfig | null;
  }

  set clickToTrade(value: ClickToTradeConfig | null) {
    // xinjs doesn't accept null or undefined - only set when value is present
    if (value !== null && value !== undefined) {
      xin["state.clickToTrade"] = value;
    } else {
      // Clear the property when null
      delete (xin as any)["state.clickToTrade"];
    }
  }

  // Helper methods for common operations
  updateTimeRange(start: number, end: number) {
    this.timeRange = { start, end };
  }

  isWithinTimeRange(timestamp: number): boolean {
    const range = this.timeRange;
    return timestamp >= Number(range.start) && timestamp <= Number(range.end);
  }

  // Method to get the entire state as a plain object
  getState(): ChartState {
    return {
      timeRange: this.timeRange,
      symbol: this.symbol,
      granularity: this.granularity,
      priceRange: this.priceRange,
      priceHistory: this.priceHistory,
      liveCandle: this.liveCandle,
      loading: this.loading,
      canvasWidth: Number(xinValue(xin["state.canvasWidth"])) || 0,
      canvasHeight: Number(xinValue(xin["state.canvasHeight"])) || 0,
      indicators: (xinValue(xin["state.indicators"]) as IndicatorConfig[]) || [],
      clickToTrade: this.clickToTrade,
    };
  }
}
