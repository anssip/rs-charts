import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TradeMarker, TradeMarkerClickedEvent, TradeMarkerHoveredEvent } from "../../types/trading-overlays";
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("trading-markers-layer");
logger.setLoggerLevel("trading-markers-layer", LogLevel.INFO);

/**
 * Layer component for rendering trade markers (buy/sell execution points)
 * Handles rendering, events, and visibility filtering
 */
@customElement("trading-markers-layer")
export class TradingMarkersLayer extends LitElement {
  @property({ type: Array, attribute: false })
  markers: TradeMarker[] = [];

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
      z-index: 100; /* Higher than trend lines */
      overflow: hidden;
    }

    .markers-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .trade-marker {
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.1s ease;
    }

    .trade-marker:hover {
      transform: scale(1.2);
    }

    .trade-marker.buy {
      color: var(--buy-color, #10b981);
    }

    .trade-marker.sell {
      color: var(--sell-color, #ef4444);
    }

    .marker-tooltip {
      display: none;
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
    }

    .trade-marker:hover .marker-tooltip {
      display: block;
    }

    .marker-text {
      font-size: 10px;
      font-weight: 600;
      margin-top: 2px;
      text-align: center;
    }
  `;

  /**
   * Get visible markers within the current time range
   */
  private getVisibleMarkers(): TradeMarker[] {
    if (!this.state?.timeRange) return this.markers;

    const { start, end } = this.state.timeRange;
    return this.markers.filter(
      (marker) => marker.timestamp >= start && marker.timestamp <= end
    ).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); // Sort by z-index
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
   * Get marker size in pixels
   */
  private getMarkerSize(size: 'small' | 'medium' | 'large'): number {
    const sizes = {
      small: 8,
      medium: 12,
      large: 16,
    };
    return sizes[size] || sizes.medium;
  }

  /**
   * Render marker SVG based on shape
   */
  private renderMarkerSVG(marker: TradeMarker): unknown {
    const size = this.getMarkerSize(marker.size);
    const color = marker.color;

    switch (marker.shape) {
      case 'arrow':
        // Arrow pointing up for buy, down for sell
        if (marker.side === 'buy') {
          return html`
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
              <path d="M12 2L2 12h7v10h6V12h7z"/>
            </svg>
          `;
        } else {
          return html`
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
              <path d="M12 22L22 12h-7V2H9v10H2z"/>
            </svg>
          `;
        }

      case 'flag':
        return html`
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <path d="M6 3v18M6 3h12l-4 6 4 6H6"/>
          </svg>
        `;

      case 'triangle':
        if (marker.side === 'buy') {
          return html`
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
              <path d="M12 2L22 20H2z"/>
            </svg>
          `;
        } else {
          return html`
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
              <path d="M12 22L2 4h20z"/>
            </svg>
          `;
        }

      case 'circle':
      default:
        return html`
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        `;
    }
  }

  /**
   * Handle marker click
   */
  private handleMarkerClick(marker: TradeMarker, event: MouseEvent): void {
    if (!marker.interactive) return;

    event.stopPropagation();

    const clickEvent: TradeMarkerClickedEvent = {
      markerId: marker.id,
      marker,
    };

    this.dispatchEvent(
      new CustomEvent("trade-marker-clicked", {
        detail: clickEvent,
        bubbles: true,
        composed: true,
      })
    );

    logger.debug(`Trade marker clicked: ${marker.id}`);
  }

  /**
   * Handle marker hover
   */
  private handleMarkerHover(marker: TradeMarker): void {
    if (!marker.interactive) return;

    const hoverEvent: TradeMarkerHoveredEvent = {
      markerId: marker.id,
      marker,
    };

    this.dispatchEvent(
      new CustomEvent("trade-marker-hovered", {
        detail: hoverEvent,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Render tooltip content
   */
  private renderTooltip(marker: TradeMarker): unknown {
    if (!marker.tooltip) return null;

    return html`
      <div class="marker-tooltip">
        <div style="font-weight: 600; margin-bottom: 4px;">
          ${marker.tooltip.title}
        </div>
        ${marker.tooltip.details.map(
          (detail) => html`<div>${detail}</div>`
        )}
      </div>
    `;
  }

  render() {
    const visibleMarkers = this.getVisibleMarkers();

    return html`
      <div class="markers-container">
        ${visibleMarkers.map((marker) => {
          const x = this.timestampToX(marker.timestamp);
          const y = this.priceToY(marker.price);
          const size = this.getMarkerSize(marker.size);

          // Center the marker on the point
          const offsetX = x - size / 2;
          const offsetY = y - size / 2;

          return html`
            <div
              class="trade-marker ${marker.side}"
              style="left: ${offsetX}px; top: ${offsetY}px;"
              @click="${(e: MouseEvent) => this.handleMarkerClick(marker, e)}"
              @mouseenter="${() => this.handleMarkerHover(marker)}"
            >
              ${this.renderMarkerSVG(marker)}
              ${marker.text ? html`<div class="marker-text">${marker.text}</div>` : null}
              ${this.renderTooltip(marker)}
            </div>
          `;
        })}
      </div>
    `;
  }
}
