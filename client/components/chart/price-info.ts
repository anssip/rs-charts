import { html, LitElement, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { observe, xinValue } from "xinjs";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { formatPrice } from "../../util/price-util";
import {
  Granularity,
  granularityLabel,
  getAllGranularities,
  granularityToMs,
  numCandlesInRange,
} from "../../../server/services/price-data/price-history-model";
import { CoinbaseProduct } from "../../api/firestore-client";
import "../chart/toolbar/product-select";
import { ChartState } from "../..";
import "../common/button";

@customElement("price-info")
export class PriceInfo extends LitElement {
  @property({ type: String })
  symbol = "";

  @property({ type: Array })
  symbols: CoinbaseProduct[] = [];

  @property({ type: String })
  granularity: Granularity = (xin["state.granularity"] ??
    "ONE_HOUR") as Granularity;

  @state()
  private liveCandle: LiveCandle | null = null;

  @state()
  private isGranularityDropdownOpen = false;

  @state()
  private _state: ChartState = xin["state"] as ChartState;

  firstUpdated() {
    observe("state.liveCandle", () => {
      this.liveCandle = xinValue(xin["state.liveCandle"]) as LiveCandle;
    });
    observe("state.granularity", () => {
      this.granularity = xinValue(xin["state.granularity"]) as Granularity;
    });
    observe("state.symbol", () => {
      this.symbol = xinValue(xin["state.symbol"]) as string;
    });
    observe("state", () => {
      this._state = xin["state"] as ChartState;
    });

    document.addEventListener("click", this.handleClickOutside);
    document.addEventListener("keydown", this.handleKeyPress);
    document.addEventListener("click", this.handleClickOutside);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this.handleClickOutside);
  }

  private handleClickOutside = (e: MouseEvent) => {
    const path = e.composedPath();
    const dropdownEl = this.renderRoot.querySelector(".granularity-dropdown");
    const timeframeEl = this.renderRoot.querySelector(".timeframe-button");
    if (
      !path.includes(dropdownEl as EventTarget) &&
      !path.includes(timeframeEl as EventTarget)
    ) {
      this.isGranularityDropdownOpen = false;
    }
  };

  private handleKeyPress = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
      return;
    }

    if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
      e.preventDefault();
      const productSelect = this.renderRoot.querySelector("product-select");
      if (productSelect) {
        (productSelect as any).openWithSearch(e.key);
      }
    }
  };

  private handleGranularityChange(newGranularity: Granularity) {
    const currentTimeRange = this._state.timeRange;
    const candleCount = this._state.priceHistory.getCandlesInRange(
      currentTimeRange.start,
      currentTimeRange.end
    ).length;

    const newGranularityMs = granularityToMs(newGranularity);

    // Calculate current number of candles and ensure it doesn't exceed MAX_CANDLES
    const MAX_CANDLES = 300;
    const newTimeSpan = candleCount * newGranularityMs;
    const candidateTimeRange = {
      start: currentTimeRange.end - newTimeSpan,
      end: currentTimeRange.end,
    };
    const newCandleCount = numCandlesInRange(
      newGranularity,
      candidateTimeRange.start,
      candidateTimeRange.end
    );

    const finalCandleCount = Math.min(newCandleCount, MAX_CANDLES);
    const newEnd = Math.min(currentTimeRange.end, new Date().getTime());
    const newTimeRange = {
      start: newEnd - finalCandleCount * newGranularityMs,
      end: newEnd,
    };

    this._state.timeRange = newTimeRange;
    this._state.granularity = newGranularity;
    this.isGranularityDropdownOpen = false;
  }

  private handleProductChange(e: CustomEvent) {
    this._state.symbol = e.detail.product;
  }

  render() {
    const isBearish = this.liveCandle
      ? this.liveCandle.close < this.liveCandle.open
      : false;
    const priceValueColor = isBearish
      ? "var(--color-error)"
      : "var(--color-accent-1)";

    const [close, open, low, high] = ["close", "open", "low", "high"].map(
      (price) =>
        this.liveCandle?.[price as keyof LiveCandle]
          ? `$${formatPrice(
              this.liveCandle[price as keyof LiveCandle] as number
            )}`
          : "..."
    );

    return html`
      <div class="price-info">
        <div class="metadata-group">
          <div class="price-item">
            <product-select
              .products=${this.symbols}
              .selectedProduct=${this.symbol}
              @product-changed=${this.handleProductChange}
            ></product-select>
          </div>
          <div class="price-item" style="position: relative;">
            <spot-button
              class="timeframe-button"
              label="Time Frame"
              .value=${granularityLabel(this.granularity)}
              @click=${() =>
                (this.isGranularityDropdownOpen =
                  !this.isGranularityDropdownOpen)}
            ></spot-button>
            ${this.isGranularityDropdownOpen
              ? html`
                  <div class="granularity-dropdown">
                    ${getAllGranularities().map(
                      (g) => html`
                        <div
                          class="granularity-option ${g === this.granularity
                            ? "selected"
                            : ""}"
                          @click=${() => this.handleGranularityChange(g)}
                        >
                          ${granularityLabel(g)}
                        </div>
                      `
                    )}
                  </div>
                `
              : ""}
          </div>
        </div>
        <div class="price-group">
          <div class="price-item">
            <span class="price-label">Open</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${open}</span
            >
          </div>
          <div class="price-item">
            <span class="price-label">High</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${high}</span
            >
          </div>
          <div class="price-item">
            <span class="price-label">Low</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${low}</span
            >
          </div>
          <div class="price-item">
            <span class="price-label">Close</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${close}</span
            >
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-width: 160px;
      max-width: 100%;
      white-space: normal;
      font-family: var(--font-primary);
    }

    .price-info {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: center;
      width: 100%;
    }

    .metadata-group {
      display: flex;
      gap: 24px;
      align-items: center;
      flex: 1;
      min-width: 200px;
    }

    .price-group {
      display: flex;
      gap: 24px;
      align-items: center;
      flex: 2;
      justify-content: space-between;
      min-width: 400px;
    }

    .price-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .price-label {
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 500;
      font-family: var(--font-secondary);
    }

    .price-value {
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 767px) {
      .price-info {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .metadata-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        min-width: 0;
      }

      .price-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        min-width: 0;
      }

      .price-item {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        flex: 0;
      }

      .price-label {
        min-width: 60px;
      }

      .price-value {
        flex: 1;
        min-width: 0;
      }
    }

    .granularity-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      background: rgb(24, 26, 27);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3),
        0 0 8px rgba(255, 255, 255, 0.05);
      z-index: 1000;
      min-width: 120px;
    }

    .granularity-option {
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      color: var(--color-background-secondary);
    }

    .granularity-option:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .granularity-option.selected {
      background: rgba(255, 255, 255, 0.15);
      color: var(--color-accent-1);
    }
  `;
}
