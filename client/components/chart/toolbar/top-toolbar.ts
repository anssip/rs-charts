import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  getAllGranularities,
  granularityLabel,
} from "../../../../server/services/price-data/price-history-model";

@customElement("top-toolbar")
export class TopToolbar extends LitElement {
  @property({ type: String })
  selectedTimeframe = "1H";

  @property({ type: String })
  selectedProduct = "BTC-USD";

  private handleTimeframeChange(e: Event) {
    const timeframe = (e.target as HTMLSelectElement).value;
    this.selectedTimeframe = timeframe;
    this.dispatchEvent(
      new CustomEvent("timeframe-changed", {
        detail: { timeframe },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleProductChange(e: Event) {
    const product = (e.target as HTMLSelectElement).value;
    this.dispatchEvent(
      new CustomEvent("product-changed", {
        detail: { product },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const granularities = getAllGranularities();

    // TODO: query products from our server

    return html`
      <div class="toolbar">
        <div class="controls">
          <select
            class="timeframe-select"
            .value=${this.selectedTimeframe}
            @change=${this.handleTimeframeChange}
          >
            ${granularities.map(
              (granularity) =>
                html`<option value=${granularity}>
                  ${granularityLabel(granularity)}
                </option>`
            )}
          </select>

          <select
            .value=${this.selectedProduct}
            @change=${this.handleProductChange}
          >
            <option value="BTC-USD">BTC-USD</option>
            <option value="ETH-USD">ETH-USD</option>
          </select>
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
