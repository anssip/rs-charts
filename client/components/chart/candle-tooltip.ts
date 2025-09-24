import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("candle-tooltip");
logger.setLoggerLevel("candle-tooltip", LogLevel.DEBUG);

export interface CandleTooltipData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  x: number;
  y: number;
}

@customElement("candle-tooltip")
export class CandleTooltip extends LitElement {
  @property({ type: Object })
  data: CandleTooltipData | null = null;

  @property({ type: Boolean })
  visible = false;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1000;
    }

    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 0.75em;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: opacity 0.2s ease;
      min-width: 180px;
      line-height: 1.5;
    }

    .tooltip.hidden {
      opacity: 0;
      pointer-events: none;
    }

    .tooltip-header {
      font-weight: bold;
      margin-bottom: 0.5em;
      padding-bottom: 0.25em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .tooltip-row {
      display: flex;
      justify-content: space-between;
      margin: 0.25em 0;
    }

    .tooltip-label {
      color: #999;
      margin-right: 1em;
    }

    .tooltip-value {
      font-weight: 500;
      text-align: right;
    }

    .tooltip-value.green {
      color: var(--color-accent-1, #26a69a);
    }

    .tooltip-value.red {
      color: var(--color-error, #ef5350);
    }
  `;

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private formatPrice(price: number): string {
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  }

  private formatVolume(volume: number): string {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  }

  render() {
    logger.debug(
      "CandleTooltip render - data:",
      this.data,
      "visible:",
      this.visible,
    );

    if (!this.data || !this.visible) {
      logger.debug("CandleTooltip not rendering - data or visible is false");
      return html``;
    }

    const isGreen = this.data.close >= this.data.open;
    const colorClass = isGreen ? "green" : "red";

    // Calculate position - offset to avoid covering the candle
    const tooltipX = Math.min(
      this.data.x + 10,
      window.innerWidth - 220, // Ensure tooltip stays within viewport
    );
    const tooltipY = Math.max(10, this.data.y - 100); // Position above the click point

    return html`
      <div
        class="tooltip ${!this.visible ? "hidden" : ""}"
        style="left: ${tooltipX}px; top: ${tooltipY}px;"
      >
        <div class="tooltip-header">
          ${this.formatTimestamp(this.data.timestamp)}
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Open:</span>
          <span class="tooltip-value">${this.formatPrice(this.data.open)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">High:</span>
          <span class="tooltip-value">${this.formatPrice(this.data.high)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Low:</span>
          <span class="tooltip-value">${this.formatPrice(this.data.low)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Close:</span>
          <span class="tooltip-value ${colorClass}">
            ${this.formatPrice(this.data.close)}
          </span>
        </div>
        ${this.data.volume !== undefined
          ? html`
              <div class="tooltip-row">
                <span class="tooltip-label">Volume:</span>
                <span class="tooltip-value">
                  ${this.formatVolume(this.data.volume)}
                </span>
              </div>
            `
          : ""}
      </div>
    `;
  }
}
