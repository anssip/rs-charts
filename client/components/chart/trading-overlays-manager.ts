/**
 * Trading Overlays Manager
 *
 * Manages CRUD operations for trading-related overlays on the chart:
 * - Trade markers (buy/sell execution flags)
 * - Price lines (stop loss, take profit, limit orders)
 * - Trade zones (visual representation of trade duration)
 *
 * This manager handles state updates and layer refreshes,
 * keeping the chart-container focused on coordination.
 */

import { touch } from "xinjs";
import type { ChartState, Layer } from "../..";
import type {
  TradeMarker,
  PriceLine,
  TradeZone,
} from "../../types/trading-overlays";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("TradingOverlaysManager");
logger.setLoggerLevel("TradingOverlaysManager", LogLevel.INFO);

export interface TradingOverlaysManagerContext {
  state: ChartState;
  tradingMarkersLayer?: Layer;
  priceLinesLayer?: Layer;
  tradeZonesLayer?: Layer;
  requestUpdate: () => void;
}

/**
 * Manager for trading overlay operations
 * Provides a clean API for adding, removing, and updating trading overlays
 */
export class TradingOverlaysManager {
  private context: TradingOverlaysManagerContext;

  constructor(context: TradingOverlaysManagerContext) {
    this.context = context;
  }

  // ============================================================================
  // Trade Markers
  // ============================================================================

  /**
   * Add a trade marker to the chart
   */
  addTradeMarker(marker: TradeMarker): void {
    if (!this.context.state.tradeMarkers) {
      this.context.state.tradeMarkers = [];
    }
    this.context.state.tradeMarkers.push(marker);
    touch("state.tradeMarkers");
    this.context.requestUpdate();
    this.updateLayer(this.context.tradingMarkersLayer);
    logger.debug(`Added trade marker ${marker.id}`);
  }

  /**
   * Remove a trade marker from the chart
   */
  removeTradeMarker(markerId: string): void {
    if (!this.context.state.tradeMarkers) return;

    const index = this.context.state.tradeMarkers.findIndex(
      (m) => m.id === markerId,
    );
    if (index !== -1) {
      this.context.state.tradeMarkers.splice(index, 1);
      touch("state.tradeMarkers");
      this.context.requestUpdate();
      this.updateLayer(this.context.tradingMarkersLayer);
      logger.debug(`Removed trade marker ${markerId}`);
    }
  }

  /**
   * Update an existing trade marker
   */
  updateTradeMarker(markerId: string, marker: TradeMarker): void {
    if (!this.context.state.tradeMarkers) return;

    const index = this.context.state.tradeMarkers.findIndex(
      (m) => m.id === markerId,
    );
    if (index !== -1) {
      this.context.state.tradeMarkers[index] = marker;
      touch("state.tradeMarkers");
      this.context.requestUpdate();
      this.updateLayer(this.context.tradingMarkersLayer);
      logger.debug(`Updated trade marker ${markerId}`);
    }
  }

  /**
   * Clear all trade markers
   */
  clearTradeMarkers(): void {
    this.context.state.tradeMarkers = [];
    touch("state.tradeMarkers");
    this.context.requestUpdate();
    this.updateLayer(this.context.tradingMarkersLayer);
    logger.debug("Cleared all trade markers");
  }

  // ============================================================================
  // Price Lines
  // ============================================================================

  /**
   * Add a price line to the chart
   */
  addPriceLine(line: PriceLine): void {
    if (!this.context.state.priceLines) {
      this.context.state.priceLines = [];
    }
    this.context.state.priceLines.push(line);
    touch("state.priceLines");
    this.context.requestUpdate();
    this.updateLayer(this.context.priceLinesLayer);
    logger.debug(`Added price line ${line.id}`);
  }

  /**
   * Remove a price line from the chart
   */
  removePriceLine(lineId: string): void {
    if (!this.context.state.priceLines) return;

    const index = this.context.state.priceLines.findIndex(
      (l) => l.id === lineId,
    );
    if (index !== -1) {
      this.context.state.priceLines.splice(index, 1);
      touch("state.priceLines");
      this.context.requestUpdate();
      this.updateLayer(this.context.priceLinesLayer);
      logger.debug(`Removed price line ${lineId}`);
    }
  }

  /**
   * Update an existing price line
   */
  updatePriceLine(lineId: string, line: PriceLine): void {
    if (!this.context.state.priceLines) return;

    const index = this.context.state.priceLines.findIndex(
      (l) => l.id === lineId,
    );
    if (index !== -1) {
      this.context.state.priceLines[index] = line;
      touch("state.priceLines");
      this.context.requestUpdate();
      this.updateLayer(this.context.priceLinesLayer);
      logger.debug(`Updated price line ${lineId}`);
    }
  }

  /**
   * Clear all price lines
   */
  clearPriceLines(): void {
    this.context.state.priceLines = [];
    touch("state.priceLines");
    this.context.requestUpdate();
    this.updateLayer(this.context.priceLinesLayer);
    logger.debug("Cleared all price lines");
  }

  // ============================================================================
  // Trade Zones
  // ============================================================================

  /**
   * Add a trade zone to the chart
   */
  addTradeZone(zone: TradeZone): void {
    if (!this.context.state.tradeZones) {
      this.context.state.tradeZones = [];
    }
    this.context.state.tradeZones.push(zone);
    touch("state.tradeZones");
    this.context.requestUpdate();
    this.updateLayer(this.context.tradeZonesLayer);
    logger.debug(`Added trade zone ${zone.id}`);
  }

  /**
   * Remove a trade zone from the chart
   */
  removeTradeZone(zoneId: string): void {
    if (!this.context.state.tradeZones) return;

    const index = this.context.state.tradeZones.findIndex(
      (z) => z.id === zoneId,
    );
    if (index !== -1) {
      this.context.state.tradeZones.splice(index, 1);
      touch("state.tradeZones");
      this.context.requestUpdate();
      this.updateLayer(this.context.tradeZonesLayer);
      logger.debug(`Removed trade zone ${zoneId}`);
    }
  }

  /**
   * Update an existing trade zone
   */
  updateTradeZone(zoneId: string, zone: TradeZone): void {
    if (!this.context.state.tradeZones) return;

    const index = this.context.state.tradeZones.findIndex(
      (z) => z.id === zoneId,
    );
    if (index !== -1) {
      this.context.state.tradeZones[index] = zone;
      touch("state.tradeZones");
      this.context.requestUpdate();
      this.updateLayer(this.context.tradeZonesLayer);
      logger.debug(`Updated trade zone ${zoneId}`);
    }
  }

  /**
   * Clear all trade zones
   */
  clearTradeZones(): void {
    this.context.state.tradeZones = [];
    touch("state.tradeZones");
    this.context.requestUpdate();
    this.updateLayer(this.context.tradeZonesLayer);
    logger.debug("Cleared all trade zones");
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Update a layer if it exists
   */
  private updateLayer(layer: Layer | undefined): void {
    if (!layer) return;

    // Type guard to check if layer has the required properties
    if (
      "state" in layer &&
      "timeRange" in layer &&
      "priceRange" in layer &&
      "requestUpdate" in layer &&
      typeof layer.requestUpdate === "function"
    ) {
      layer.state = this.context.state;
      layer.timeRange = this.context.state.timeRange;
      layer.priceRange = this.context.state.priceRange;
      layer.requestUpdate();
    }
  }
}
