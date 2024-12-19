import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  getAllGranularities,
  Granularity,
  granularityLabel,
  granularityToMs,
  numCandlesInRange,
} from "../../../../server/services/price-data/price-history-model";
import { CoinbaseProduct } from "../../../api/firestore-client";
import "./product-select";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";

@customElement("top-toolbar")
export class TopToolbar extends LitElement {
  @property({ type: Array })
  products: CoinbaseProduct[] = [];

  @state()
  private isDropdownOpen = false;

  @state()
  private _state: ChartState = xin["state"] as ChartState;

  firstUpdated() {
    // Add keyboard listener for the whole toolbar
    document.addEventListener("keydown", this.handleKeyPress);
    document.addEventListener("click", this.handleClickOutside);

    // Observe state changes
    observe("state", () => {
      this._state = xin["state"] as ChartState;
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyPress);
    document.removeEventListener("click", this.handleClickOutside);
  }

  private handleClickOutside = (e: MouseEvent) => {
    const path = e.composedPath();
    const dropdownEl = this.renderRoot.querySelector(".custom-dropdown");
    if (!path.includes(dropdownEl as EventTarget)) {
      this.isDropdownOpen = false;
    }
  };

  private handleTimeframeChange(granularity: Granularity) {
    console.log("TopToolbar: timeframe-changed", granularity);

    const currentTimeRange = this._state.timeRange;
    const candleCount = this._state.priceHistory.getCandlesInRange(
      currentTimeRange.start,
      currentTimeRange.end
    ).length;

    const newGranularityMs = granularityToMs(granularity);

    // Calculate current number of candles and ensure it doesn't exceed MAX_CANDLES
    const MAX_CANDLES = 300;
    const newTimeSpan = candleCount * newGranularityMs;
    const candidateTimeRange = {
      start: currentTimeRange.end - newTimeSpan,
      end: currentTimeRange.end,
    };
    const newCandleCount = numCandlesInRange(
      granularity,
      candidateTimeRange.start,
      candidateTimeRange.end
    );
    // check if newCandleCount is within MAX_CANDLES
    const finalCandleCount = Math.min(newCandleCount, MAX_CANDLES);
    const newEnd = Math.min(currentTimeRange.end, new Date().getTime());
    const newTimeRange = {
      start: newEnd - finalCandleCount * newGranularityMs,
      end: newEnd,
    };

    this._state.timeRange = newTimeRange;
    this._state.granularity = granularity;
    this.isDropdownOpen = false;
  }

  private handleProductChange(e: CustomEvent) {
    const product = e.detail.product;
    this._state.symbol = product;
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
    const currentLabel = granularityLabel(this._state.granularity);

    return html`
      <div class="toolbar">
        <div class="controls">
          <div class="custom-dropdown">
            <button
              class="dropdown-button"
              @click=${() => (this.isDropdownOpen = !this.isDropdownOpen)}
            >
              ${currentLabel}
              <span class="arrow ${this.isDropdownOpen ? "up" : "down"}"></span>
            </button>
            ${this.isDropdownOpen
              ? html`
                  <div class="dropdown-menu">
                    ${granularities.map(
                      (granularity) => html`
                        <div
                          class="dropdown-item ${granularity ===
                          this._state.granularity
                            ? "selected"
                            : ""}"
                          @click=${() =>
                            this.handleTimeframeChange(granularity)}
                        >
                          ${granularityLabel(granularity)}
                        </div>
                      `
                    )}
                  </div>
                `
              : ""}
          </div>

          <product-select
            .products=${this.products}
            .selectedProduct=${this._state.symbol}
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
      padding: 0 8px;
      height: 100%;
      background: var(--color-primary-dark);
      color: var(--color-accent-2);
    }

    .controls {
      display: flex;
      gap: 8px;
    }

    .custom-dropdown {
      position: relative;
      min-width: 80px;
      width: 80px;
    }

    .dropdown-button {
      width: 100%;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--color-background-secondary);
      background: var(--color-primary-dark);
      color: var(--color-accent-2);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }

    .dropdown-button:hover {
      border-color: var(--color-accent-1);
    }

    .arrow {
      border: solid var(--color-background-secondary);
      border-width: 0 2px 2px 0;
      display: inline-block;
      padding: 3px;
      margin-left: 8px;
      transition: transform 0.2s ease;
    }

    .arrow.down {
      transform: rotate(45deg);
    }

    .arrow.up {
      transform: rotate(-135deg);
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: var(--color-primary-dark);
      border: 1px solid var(--color-background-secondary);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
    }

    .dropdown-item {
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      color: var(--color-accent-2);
      font-size: 14px;
    }

    .dropdown-item:hover {
      background: var(--color-background-secondary);
    }

    .dropdown-item.selected {
      background: var(--color-background-secondary);
      font-weight: bold;
    }
  `;
}
