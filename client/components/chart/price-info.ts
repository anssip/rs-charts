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
      display: grid;
      grid-template-columns: repeat(6, auto);
      gap: 24px;
      align-items: center;
    }

    .price-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
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
    }

    .product-info {
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-secondary);
    }

    @media (max-width: 767px) {
      .price-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .price-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .price-item {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .price-value {
        flex-shrink: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .product-info {
        margin-bottom: 4px;
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

    // Desktop layout
    // TODO: use a responsive flex layout here to remove code duplication
    const desktopLayout = html`
      <div class="price-info">
        <div class="price-item">
          <span class="price-label">Symbol</span>
          <span class="price-value" style="color: var(--color-accent-2)"
            >${this.symbol}</span
          >
        </div>
        <div class="price-item">
          <span class="price-label">Time Frame</span>
          <span class="price-value" style="color: var(--color-accent-2)"
            >${granularityLabel(this.granularity)}</span
          >
        </div>
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
    `;

    // Mobile layout
    const mobileLayout = html`
      <div class="price-info">
        <div class="price-item">
          <span class="price-label">Symbol</span>
          <span class="price-value" style="color: var(--color-accent-2)"
            >${this.symbol}</span
          >
        </div>
        <div class="price-item">
          <span class="price-label">Time Frame</span>
          <span class="price-value" style="color: var(--color-accent-2)"
            >${granularityLabel(this.granularity)}</span
          >
        </div>
        <div class="price-group">
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
    `;

    return window.innerWidth >= 768 ? desktopLayout : mobileLayout;
  }
}
