import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  getAllGranularities,
  Granularity,
  granularityLabel,
  granularityToMs,
  numCandlesInRange,
} from "../../../../server/services/price-data/price-history-model";
import { CoinbaseProduct } from "../../../api/firestore-client";
import "./product-select";
import { touch, xin } from "xinjs";
import { ChartState } from "../../..";

@customElement("top-toolbar")
export class TopToolbar extends LitElement {
  @property({ type: Array })
  products: CoinbaseProduct[] = [];

  state: ChartState = xin["state"] as ChartState;

  firstUpdated() {
    // Add keyboard listener for the whole toolbar
    document.addEventListener("keydown", this.handleKeyPress);
    this.state = xin["state"] as ChartState;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyPress);
  }

  private handleTimeframeChange(e: Event) {
    const newGranularity = (e.target as HTMLSelectElement).value as Granularity;
    console.log("TopToolbar: timeframe-changed", newGranularity);

    const currentTimeRange = this.state.timeRange;
    const candleCount = this.state.priceHistory.getCandlesInRange(
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
    // check if newCandleCount is within MAX_CANDLES
    const finalCandleCount = Math.min(newCandleCount, MAX_CANDLES);
    const newTimeRange = {
      start: currentTimeRange.end - finalCandleCount * newGranularityMs,
      end: currentTimeRange.end,
    };

    this.state.timeRange = newTimeRange;
    this.state.granularity = newGranularity;

    console.log("TopToolbar: granularity change", {
      oldGranularity: this.state.granularity,
      newGranularity,
      newCandleCount,
      finalCandleCount,
      newTimeSpan,
      newTimeRange: {
        start: new Date(this.state.timeRange.start),
        end: new Date(this.state.timeRange.end),
      },
    });
  }

  private handleProductChange(e: CustomEvent) {
    const product = e.detail.product;
    this.state.symbol = product;
  }

  private handleKeyPress = (e: KeyboardEvent) => {
    // Only handle if no input/textarea is focused
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

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

  render() {
    const granularities = getAllGranularities();

    return html`
      <div class="toolbar">
        <div class="controls">
          <select
            class="timeframe-select"
            .value=${this.state.granularity}
            @change=${this.handleTimeframeChange}
          >
            ${granularities.map(
              (granularity) =>
                html`<option value=${granularity}>
                  ${granularityLabel(granularity)}
                </option>`
            )}
          </select>

          <product-select
            .products=${this.products}
            .selectedProduct=${this.state.symbol}
            @product-changed=${this.handleProductChange}
          ></product-select>
        </div>
      </div>
    `;
  }

  static styles = css`
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0 16px;
      height: 100%;
    }

    .controls {
      display: flex;
      gap: 8px;
    }

    select {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
    }

    select:hover {
      border-color: #bbb;
    }

    select:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
  `;
}
