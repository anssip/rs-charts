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
      min-width: 300px;
      white-space: nowrap;
      font-family: var(--font-primary);
    }

    .product-info {
      font-weight: 600;
      font-size: 14px;
    }

    .price-label {
      color: rgba(255, 255, 255, 0.9);
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 500;
      margin-left: 8px;
    }

    .price-value {
      color: var(--accent-secondary-yellow-green);
      font-size: 13px;
      font-weight: 600;
      margin-left: 4px;
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
      <span>
        <span class="price-label">Open</span>
        <span class="price-value">${open}</span>
        <span class="price-label">High</span>
        <span class="price-value">${high}</span>
        <span class="price-label">Low</span>
        <span class="price-value">${low}</span>
        <span class="price-label">Close</span>
        <span class="price-value">${close}</span>
      </span>
    </div>`;
  }
}
