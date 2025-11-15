import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState } from "../..";
import { getLocalChartId, observeLocal } from "../../util/state-context";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("live-candle-display");
logger.setLoggerLevel("live-candle-display", LogLevel.ERROR);

@customElement("live-candle-display")
export class LiveCandleDisplay extends LitElement {
  @state() private liveCandle: LiveCandle | null = null;
  private _chartId: string = "state";

  static styles = css`
    :host {
      position: relative;
      pointer-events: none;
    }

    @media (max-width: 768px) {
      :host {
        display: none;
      }
    }

    .display-container {
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 8px;
      border-radius: 6px;
      font-size: 12px;
      font-family: monospace;
      min-width: 100px;
      line-height: 1.4;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .display-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }

    .display-label {
      color: #999;
      margin-right: 0;
    }

    .display-value {
      font-weight: 500;
      text-align: right;
    }

    .display-value.green {
      color: var(--color-accent-1, #26a69a);
    }

    .display-value.red {
      color: var(--color-error, #ef5350);
    }

    .change-indicator {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .change-value {
      font-weight: bold;
    }

    .arrow {
      margin-right: 4px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.initializeState();
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    logger.debug("Got chart ID:", this._chartId);

    // Initialize with current state
    const stateData = xin[this._chartId] as ChartState;
    if (stateData && stateData.liveCandle) {
      this.liveCandle = stateData.liveCandle;
    }

    // Set up observer for live candle updates
    observeLocal(this, "state.liveCandle", () => {
      const newLiveCandle = xin[`${this._chartId}.liveCandle`] as LiveCandle;
      logger.debug("Live candle updated:", newLiveCandle);
      if (newLiveCandle) {
        this.liveCandle = newLiveCandle;
      }
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

  private formatChange(
    open: number,
    close: number,
  ): { value: string; percentage: string } {
    const change = close - open;
    const percentageChange = (change / open) * 100;
    return {
      value: this.formatPrice(Math.abs(change)),
      percentage: `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(2)}%`,
    };
  }

  render() {
    if (!this.liveCandle) {
      return html``;
    }

    const isGreen = this.liveCandle.close >= this.liveCandle.open;
    const colorClass = isGreen ? "green" : "red";
    const arrow = isGreen ? "▲" : "▼";
    const change = this.formatChange(
      this.liveCandle.open,
      this.liveCandle.close,
    );

    return html`
      <div class="display-container">
        <div class="display-row">
          <span class="display-label">Open:</span>
          <span class="display-value"
            >${this.formatPrice(this.liveCandle.open)}</span
          >
        </div>
        <div class="display-row">
          <span class="display-label">High:</span>
          <span class="display-value"
            >${this.formatPrice(this.liveCandle.high)}</span
          >
        </div>
        <div class="display-row">
          <span class="display-label">Low:</span>
          <span class="display-value"
            >${this.formatPrice(this.liveCandle.low)}</span
          >
        </div>
        <div class="display-row">
          <span class="display-label">Close:</span>
          <span class="display-value ${colorClass}">
            ${this.formatPrice(this.liveCandle.close)}
          </span>
        </div>
        ${this.liveCandle.volume !== undefined
          ? html`
              <div class="display-row">
                <span class="display-label">Volume:</span>
                <span class="display-value">
                  ${this.formatVolume(this.liveCandle.volume)}
                </span>
              </div>
            `
          : ""}
        <div class="change-indicator">
          <span class="change-value ${colorClass}">
            <span class="arrow">${arrow}</span>
            ${change.value} (${change.percentage})
          </span>
        </div>
      </div>
    `;
  }
}
