import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TradeZone } from "../../types/trading-overlays";
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("trade-zones-layer");
logger.setLoggerLevel("trade-zones-layer", LogLevel.INFO);

/**
 * Event emitted when a trade zone is clicked
 */
export interface TradeZoneClickedEvent {
  zoneId: string;
  zone: TradeZone;
}

/**
 * Event emitted when mouse hovers over a trade zone
 */
export interface TradeZoneHoveredEvent {
  zoneId: string;
  zone: TradeZone;
}

/**
 * Layer component for rendering trade zones (completed trade duration visualization)
 * Handles rendering rectangles with P&L information
 */
@customElement("trade-zones-layer")
export class TradeZonesLayer extends LitElement {
  @property({ type: Array, attribute: false })
  zones: TradeZone[] = [];

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5; /* Lowest priority - behind everything */
      overflow: hidden;
    }

    .zones-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .trade-zone {
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
    }

    .trade-zone:hover {
      opacity: 0.9;
    }

    .zone-svg {
      position: absolute;
      overflow: visible;
    }

    .pnl-label {
      position: absolute;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
      text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
      transform: translate(-50%, -50%);
    }
  `;

  /**
   * Get visible zones that overlap with the current time and price range
   */
  private getVisibleZones(): TradeZone[] {
    if (!this.state?.timeRange || !this.state?.priceRange) return this.zones;

    const { start: timeStart, end: timeEnd } = this.state.timeRange;
    const { min: priceMin, max: priceMax } = this.state.priceRange;

    return this.zones
      .filter((zone) => {
        // Check if zone overlaps with visible time range
        const timeOverlap =
          zone.startTimestamp <= timeEnd && zone.endTimestamp >= timeStart;
        if (!timeOverlap) return false;

        // Check if zone overlaps with visible price range
        const zoneMinPrice = Math.min(zone.entryPrice, zone.exitPrice);
        const zoneMaxPrice = Math.max(zone.entryPrice, zone.exitPrice);
        const priceOverlap =
          zoneMinPrice <= priceMax && zoneMaxPrice >= priceMin;

        return priceOverlap;
      })
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); // Sort by z-index
  }

  /**
   * Convert timestamp to X pixel coordinate
   */
  private timestampToX(timestamp: number): number {
    if (!this.state?.timeRange || this.width === 0) return 0;

    const { start, end } = this.state.timeRange;
    const timeRange = end - start;
    const ratio = (timestamp - start) / timeRange;
    return ratio * this.width;
  }

  /**
   * Convert price to Y pixel coordinate
   */
  private priceToY(price: number): number {
    if (!this.state?.priceRange || this.height === 0) return 0;

    const { min, max } = this.state.priceRange;
    const priceRange = max - min;
    const ratio = (max - price) / priceRange;
    return ratio * this.height;
  }

  /**
   * Determine fill color based on P&L if not specified
   */
  private getZoneFillColor(zone: TradeZone): string {
    if (zone.fillColor) return zone.fillColor;

    // Auto-detect profit/loss based on entry/exit prices and side
    const isProfitable =
      zone.metadata?.side === "short"
        ? zone.entryPrice > zone.exitPrice
        : zone.exitPrice > zone.entryPrice;

    return isProfitable ? "#10b981" : "#ef4444"; // Green for profit, red for loss
  }

  /**
   * Handle zone click
   */
  private handleZoneClick(zone: TradeZone, event: MouseEvent): void {
    event.stopPropagation();

    const clickEvent: TradeZoneClickedEvent = {
      zoneId: zone.id,
      zone,
    };

    this.dispatchEvent(
      new CustomEvent("trade-zone-clicked", {
        detail: clickEvent,
        bubbles: true,
        composed: true,
      }),
    );

    logger.debug(`Trade zone clicked: ${zone.id}`);
  }

  /**
   * Handle zone hover
   */
  private handleZoneHover(zone: TradeZone): void {
    const hoverEvent: TradeZoneHoveredEvent = {
      zoneId: zone.id,
      zone,
    };

    this.dispatchEvent(
      new CustomEvent("trade-zone-hovered", {
        detail: hoverEvent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Format P&L text for display
   */
  private formatPnL(zone: TradeZone): string {
    if (!zone.metadata) return "";

    const parts: string[] = [];

    if (zone.metadata.pnl !== undefined) {
      const pnlSign = zone.metadata.pnl >= 0 ? "+" : "";
      parts.push(`${pnlSign}$${zone.metadata.pnl.toFixed(2)}`);
    }

    if (zone.metadata.pnlPercent !== undefined) {
      const percentSign = zone.metadata.pnlPercent >= 0 ? "+" : "";
      parts.push(`(${percentSign}${zone.metadata.pnlPercent.toFixed(2)}%)`);
    }

    return parts.join(" ");
  }

  /**
   * Render P&L label in center of zone
   */
  private renderPnLLabel(
    zone: TradeZone,
    x: number,
    y: number,
    width: number,
    height: number,
  ): unknown {
    if (!zone.showPnL || !zone.metadata) return null;

    const pnlText = this.formatPnL(zone);
    if (!pnlText) return null;

    // Position label in center of zone (relative to parent zone div, not viewport)
    // The zone div is already positioned, so we just need the center within it
    const centerX = width / 2;
    const centerY = height / 2;

    // Use custom text color if provided, otherwise determine based on P&L
    let textColor: string;
    if (zone.textColor) {
      textColor = zone.textColor;
    } else {
      const isProfitable =
        zone.metadata.pnl !== undefined
          ? zone.metadata.pnl >= 0
          : zone.metadata.pnlPercent !== undefined
            ? zone.metadata.pnlPercent >= 0
            : true;
      textColor = isProfitable ? "#10b981" : "#ef4444";
    }

    return html`
      <div
        class="pnl-label"
        style="
          left: ${centerX}px;
          top: ${centerY}px;
          color: ${textColor};
        "
      >
        ${pnlText}
      </div>
    `;
  }

  render() {
    const visibleZones = this.getVisibleZones();

    return html`
      <div class="zones-container">
        ${visibleZones.map((zone) => {
          const startX = this.timestampToX(zone.startTimestamp);
          const endX = this.timestampToX(zone.endTimestamp);

          // Entry and exit prices - flip min/max for canvas coordinates
          const entryY = this.priceToY(zone.entryPrice);
          const exitY = this.priceToY(zone.exitPrice);

          const topY = Math.min(entryY, exitY);
          const bottomY = Math.max(entryY, exitY);

          const zoneWidth = endX - startX;
          const zoneHeight = bottomY - topY;

          // Skip zones with invalid dimensions
          if (zoneWidth <= 0 || zoneHeight <= 0) return null;

          const fillColor = this.getZoneFillColor(zone);
          const fillOpacity = zone.fillOpacity ?? 0.2;
          const borderColor = zone.borderColor || fillColor;
          const borderWidth = zone.borderWidth ?? 1;

          return html`
            <div
              class="trade-zone"
              style="
                left: ${startX}px;
                top: ${topY}px;
                width: ${zoneWidth}px;
                height: ${zoneHeight}px;
              "
              @click="${(e: MouseEvent) => this.handleZoneClick(zone, e)}"
              @mouseenter="${() => this.handleZoneHover(zone)}"
            >
              <svg
                class="zone-svg"
                width="${zoneWidth}"
                height="${zoneHeight}"
                style="position: absolute; left: 0; top: 0;"
              >
                <rect
                  x="0"
                  y="0"
                  width="${zoneWidth}"
                  height="${zoneHeight}"
                  fill="${fillColor}"
                  fill-opacity="${fillOpacity}"
                  stroke="${borderColor}"
                  stroke-width="${borderWidth}"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              ${this.renderPnLLabel(zone, startX, topY, zoneWidth, zoneHeight)}
            </div>
          `;
        })}
      </div>
    `;
  }
}
