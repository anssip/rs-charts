import { html, LitElement, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { observe, xinValue } from "xinjs";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { formatPrice } from "../../util/price-util";
import {
  Granularity,
  granularityLabel,
} from "../../../server/services/price-data/price-history-model";

@customElement("price-info")
export class PriceInfo extends LitElement {
  @property({ type: String })
  symbol = "";

  @property({ type: String })
  granularity: Granularity = (xin["state.granularity"] ??
    "ONE_HOUR") as Granularity;

  @state()
  private liveCandle: LiveCandle | null = null;

  // TODO: style this once we have the brand colors
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
      flex-direction: column;
      gap: 4px;
    }

    .product-info {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .price-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .price-row {
      display: flex;
      gap: 8px;
      flex: 1 1 100%;
      min-width: 0;
    }

    .price-item {
      display: inline-flex;
      align-items: center;
      flex: 1;
      min-width: 80px;
      max-width: calc(50% - 4px);
    }

    .price-label {
      color: rgba(255, 255, 255, 0.9);
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 500;
      font-family: var(--font-secondary);
      flex-shrink: 0;
    }

    .price-value {
      font-size: 13px;
      font-weight: 600;
      margin-left: 4px;
      flex-shrink: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (min-width: 768px) {
      :host {
        min-width: min-content;
        white-space: nowrap;
      }

      .price-info {
        flex-direction: row;
        align-items: center;
        width: max-content;
      }

      .product-info {
        margin-bottom: 0;
        margin-right: 12px;
        flex-shrink: 0;
      }

      .price-group {
        display: flex;
        flex-wrap: nowrap;
        gap: 12px;
      }

      .price-row {
        flex: 0 0 auto;
        gap: 12px;
      }

      .price-item {
        min-width: max-content;
        max-width: none;
      }

      .price-value {
        overflow: visible;
      }
    }
  `;

  firstUpdated() {
    observe("state.liveCandle", () => {
      this.liveCandle = xinValue(xin["state.liveCandle"]) as LiveCandle;
    });
    observe("state.granularity", () => {
      this.granularity = xinValue(xin["state.granularity"]) as Granularity;
    });
    observe("state.symbol", () => {
      this.symbol = xinValue(xin["state.symbol"]) as string;
      console.log("PriceInfo: symbol changed", this.symbol);
    });
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

    return html`<div class="price-info">
      <span class="product-info">
        ${this.symbol} • ${granularityLabel(this.granularity)}
      </span>
      <div class="price-group">
        <div class="price-row">
          <span class="price-item">
            <span class="price-label">Open</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${open}</span
            >
          </span>
          <span class="price-item">
            <span class="price-label">High</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${high}</span
            >
          </span>
        </div>
        <div class="price-row">
          <span class="price-item">
            <span class="price-label">Low</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${low}</span
            >
          </span>
          <span class="price-item">
            <span class="price-label">Close</span>
            <span class="price-value" style="color: ${priceValueColor}"
              >${close}</span
            >
          </span>
        </div>
      </div>
    </div>`;
  }
}
