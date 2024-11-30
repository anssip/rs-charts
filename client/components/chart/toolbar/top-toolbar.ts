import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  getAllGranularities,
  granularityLabel,
} from "../../../../server/services/price-data/price-history-model";
import { CoinbaseProduct } from "../../../api/firestore-client";
import "./product-select";

@customElement("top-toolbar")
export class TopToolbar extends LitElement {
  @property({ type: String })
  selectedTimeframe = "1H";

  @property({ type: String })
  selectedProduct = "BTC-USD";

  @property({ type: Array })
  products: CoinbaseProduct[] = [];

  firstUpdated() {
    // Add keyboard listener for the whole toolbar
    document.addEventListener("keydown", this.handleKeyPress);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyPress);
  }

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

          <product-select
            .products=${this.products}
            .selectedProduct=${this.selectedProduct}
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
