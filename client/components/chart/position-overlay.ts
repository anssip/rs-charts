import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { PositionOverlayConfig } from "../../types/trading-overlays";
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("position-overlay");
logger.setLoggerLevel("position-overlay", LogLevel.INFO);

/**
 * Component for displaying current position information overlay
 * Shows position details, P&L, and optional entry line
 */
@customElement("position-overlay")
export class PositionOverlay extends LitElement {
  @property({
    type: Object,
    hasChanged(newVal: PositionOverlayConfig | null, oldVal: PositionOverlayConfig | null) {
      // Always trigger re-render when config changes (even if same reference)
      // This ensures compact mode updates are detected
      if (newVal !== oldVal) {
        logger.debug('Position overlay config changed', {
          oldCompact: oldVal?.compact,
          newCompact: newVal?.compact
        });
        return true;
      }
      return false;
    }
  })
  config: PositionOverlayConfig | null = null;

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  @property({ type: Boolean, reflect: true, attribute: 'hide-entry-line' })
  hideEntryLine = false;

  static styles = css`
    :host {
      pointer-events: none;
    }

    /* When used as entry line layer (full chart coverage) */
    :host(:not([hide-entry-line])) {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    /* When used in flexbox (info box only) */
    :host([hide-entry-line]) {
      position: relative;
      overflow: visible;
    }

    .position-container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .position-info {
      position: relative;
      background-color: rgba(0, 0, 0, 0.9);
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      min-width: 180px;
    }

    .position-info.compact {
      padding: 8px;
      font-size: 11px;
      min-width: 140px;
    }

    .position-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .position-header.compact {
      margin-bottom: 4px;
      padding-bottom: 4px;
    }

    .position-symbol {
      font-weight: 600;
      font-size: 14px;
    }

    .position-symbol.compact {
      font-size: 12px;
    }

    .position-side {
      padding: 2px 8px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }

    .position-side.long {
      background: #10b981;
      color: white;
    }

    .position-side.short {
      background: #ef4444;
      color: white;
    }

    .position-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }

    .position-label {
      font-size: 11px;
    }

    .position-label.compact {
      font-size: 10px;
    }

    .position-value {
      font-weight: 500;
      font-family: monospace;
    }

    .pnl-positive {
      color: #10b981;
    }

    .pnl-negative {
      color: #ef4444;
    }

    .pnl-neutral {
      color: #9ca3af;
    }

    .entry-line {
      position: absolute;
      left: 0;
      width: 100%;
      height: 1px;
      pointer-events: none;
    }

    .entry-line-svg {
      position: absolute;
      left: 0;
      width: 100%;
      height: 1px;
      overflow: visible;
    }

    .entry-label {
      position: absolute;
      left: 8px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
      transform: translateY(-50%);
      z-index: 10;
    }
  `;

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
   * Format price with appropriate decimal places
   */
  private formatPrice(price: number): string {
    return price.toFixed(2);
  }

  /**
   * Format P&L with sign and currency symbol
   */
  private formatPnL(pnl: number): string {
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}$${pnl.toFixed(2)}`;
  }

  /**
   * Format P&L percentage with sign
   */
  private formatPnLPercent(percent: number): string {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  }

  /**
   * Get P&L CSS class based on value
   */
  private getPnLClass(pnl: number): string {
    if (pnl > 0) return "pnl-positive";
    if (pnl < 0) return "pnl-negative";
    return "pnl-neutral";
  }

  /**
   * Convert hex or rgb color to rgba with specified opacity
   */
  private hexToRgba(color: string, opacity: number): string {
    // If already rgba, return as is
    if (color.startsWith('rgba')) return color;

    // If rgb, convert to rgba
    if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
    }

    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Render entry price line
   */
  private renderEntryLine(): unknown {
    // Don't render entry line if hideEntryLine is true
    if (this.hideEntryLine) return null;
    if (!this.config || !this.config.showEntryLine) return null;

    const y = this.priceToY(this.config.entryPrice);
    const color = this.config.entryLineColor || "#6b7280";

    return html`
      <div class="entry-line" style="top: ${y}px;">
        <svg class="entry-line-svg">
          <line
            x1="0"
            y1="0"
            x2="${this.width}"
            y2="0"
            stroke="${color}"
            stroke-width="1"
            stroke-dasharray="4,4"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <div class="entry-label" style="background-color: ${color};">
          Entry: ${this.formatPrice(this.config.entryPrice)}
        </div>
      </div>
    `;
  }

  /**
   * Render position information box
   */
  private renderPositionInfo(): unknown {
    // Only render info box when hideEntryLine is true (flexbox mode)
    if (!this.hideEntryLine) return null;
    if (!this.config) return null;

    // Convert compact to boolean (handles Proxy values from xinjs state)
    // Use loose equality to coerce Proxy values to their primitive boolean
    const compact = this.config.compact == true;
    logger.debug(`Position overlay rendering info box, compact=${compact}`, this.config);
    const bgColor = this.config.backgroundColor || "rgba(0, 0, 0, 0.9)";
    const textColor = this.config.textColor || "#ffffff";

    // Calculate label color with opacity for dimmed effect
    const labelColor = this.hexToRgba(textColor, 0.7);

    return html`
      <div
        class="position-info ${compact ? "compact" : ""}"
        style="
          background-color: ${bgColor};
          color: ${textColor};
        "
      >
        <div class="position-header ${compact ? "compact" : ""}">
          <div class="position-symbol ${compact ? "compact" : ""}">
            ${this.config.symbol}
          </div>
          <div class="position-side ${this.config.side}">
            ${this.config.side}
          </div>
        </div>

        ${!compact
          ? html`
              <div class="position-row">
                <span class="position-label" style="color: ${labelColor}">Quantity</span>
                <span class="position-value">${this.config.quantity}</span>
              </div>
            `
          : null}

        <div class="position-row">
          <span class="position-label ${compact ? "compact" : ""}" style="color: ${labelColor}">Entry</span>
          <span class="position-value"
            >${this.formatPrice(this.config.entryPrice)}</span
          >
        </div>

        <div class="position-row">
          <span class="position-label ${compact ? "compact" : ""}" style="color: ${labelColor}"
            >Current</span
          >
          <span class="position-value"
            >${this.formatPrice(this.config.currentPrice)}</span
          >
        </div>

        <div class="position-row">
          <span class="position-label ${compact ? "compact" : ""}" style="color: ${labelColor}">P&L</span>
          <span
            class="position-value ${this.getPnLClass(
              this.config.unrealizedPnL,
            )}"
          >
            ${this.formatPnL(this.config.unrealizedPnL)}
          </span>
        </div>

        ${!compact
          ? html`
              <div class="position-row">
                <span class="position-label" style="color: ${labelColor}">P&L %</span>
                <span
                  class="position-value ${this.getPnLClass(
                    this.config.unrealizedPnLPercent,
                  )}"
                >
                  ${this.formatPnLPercent(this.config.unrealizedPnLPercent)}
                </span>
              </div>
            `
          : null}
      </div>
    `;
  }

  render() {
    if (!this.config) {
      return html``;
    }

    // Entry line layer mode: only render entry line
    if (!this.hideEntryLine) {
      return html`
        <div class="position-container">
          ${this.renderEntryLine()}
        </div>
      `;
    }

    // Info box mode: only render info box
    return html`${this.renderPositionInfo()}`;
  }
}
