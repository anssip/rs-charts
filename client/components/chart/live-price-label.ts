import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState } from "../..";
import { getLocalChartId, observeLocal } from "../../util/state-context";
import { getLogger, LogLevel } from "../../util/logger";
import { formatPrice } from "../../util/price-util";
import {
  granularityToMs,
  Granularity,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { priceToY, getDpr } from "../../util/chart-util";

const logger = getLogger("live-price-label");
logger.setLoggerLevel("live-price-label", LogLevel.ERROR);

@customElement("live-price-label")
export class LivePriceLabel extends LitElement {
  @state() private liveCandle: LiveCandle | null = null;
  @state() private livePriceYPosition: number = 0;
  @state() private isBearish: boolean = false;
  @state() private timeLeft: string = "";
  @state() private priceRange: PriceRange | null = null;
  @state() private chartHeight: number = 0;

  private _chartId: string = "state";
  private countdownInterval: number | null = null;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      right: 0;
      width: var(--price-axis-width, 60px);
      pointer-events: none;
      z-index: 10;
    }

    .live-price-label {
      position: absolute;
      width: 97%;
      height: 30px;
      background-color: var(--color-primary-dark);
      border: 1px solid;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-size: 10px;
      line-height: 1.2;
      margin-right: 2px;
      pointer-events: none;
      transform: translateY(-50%);
    }

    .price {
      font-weight: bold;
      color: var(--color-accent-2);
    }

    .time {
      color: var(--color-background-secondary);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.initializeState();
    // Update position after a short delay to ensure parent is ready
    requestAnimationFrame(() => {
      this.updatePosition();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    logger.debug("Got chart ID:", this._chartId);

    // Initialize with current state
    const stateData = xin[this._chartId] as ChartState;
    if (stateData) {
      this.liveCandle = stateData.liveCandle || null;
      this.priceRange = stateData.priceRange || null;

      if (this.liveCandle) {
        this.isBearish = this.liveCandle.close < this.liveCandle.open;
        this.startCountdown();
      }
    }

    // Set up observers
    observeLocal(this, "state.liveCandle", () => {
      const newLiveCandle = xin[`${this._chartId}.liveCandle`] as LiveCandle;
      logger.debug("Live candle updated:", newLiveCandle);
      if (newLiveCandle) {
        this.liveCandle = newLiveCandle;
        this.isBearish = newLiveCandle.close < newLiveCandle.open;
        this.startCountdown();
        this.updatePosition();
      }
    });

    observeLocal(this, "state.priceRange", () => {
      const newPriceRange = xin[`${this._chartId}.priceRange`] as PriceRange;
      logger.debug("Price range updated:", newPriceRange);
      this.priceRange = newPriceRange;
      this.updatePosition();
    });
  }

  private updatePosition() {
    if (!this.liveCandle || !this.priceRange) return;

    // Get parent element height (chart-area)
    const parentElement = this.parentElement;
    if (!parentElement) {
      // Retry after a short delay if parent not available yet
      setTimeout(() => this.updatePosition(), 100);
      return;
    }

    const rect = parentElement.getBoundingClientRect();
    this.chartHeight = rect.height;

    const priceY = priceToY(this.chartHeight, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    this.livePriceYPosition = priceY(this.liveCandle.close);
    this.requestUpdate();
  }

  private formatTimeLeft(msLeft: number): string {
    const totalSeconds = Math.floor(msLeft / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const granularityMs = granularityToMs(
      xin[`${this._chartId}.granularity`] as Granularity,
    );
    const showHours = granularityMs >= 24 * 60 * 60 * 1000;

    if (showHours) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
  }

  private updateCountdown() {
    if (!this.liveCandle || !this.priceRange) return;

    const now = Date.now();
    const granularityMs = granularityToMs(
      xin[`${this._chartId}.granularity`] as Granularity,
    );

    // Calculate the start of the current candle period
    const currentPeriodStart = Math.floor(now / granularityMs) * granularityMs;
    // Calculate the end of the current candle period
    const currentPeriodEnd = currentPeriodStart + granularityMs;
    // Calculate remaining time
    const msLeft = currentPeriodEnd - now;

    this.timeLeft = this.formatTimeLeft(msLeft);

    // Update position as well
    this.updatePosition();
  }

  private startCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.updateCountdown();
    this.countdownInterval = window.setInterval(
      () => this.updateCountdown(),
      1000,
    );
  }

  render() {
    if (!this.liveCandle) {
      return html``;
    }

    const priceColor = this.isBearish
      ? "var(--color-error)"
      : "var(--color-accent-1)";

    const labelHeight = 30;
    const top = `${this.livePriceYPosition - labelHeight / 2}px`;

    return html`
      <div
        class="live-price-label"
        style="
          top: ${top};
          border-color: ${priceColor};
        "
      >
        <div class="price">${formatPrice(this.liveCandle.close)}</div>
        <div class="time">${this.timeLeft}</div>
      </div>
    `;
  }
}
