import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CoinbaseProduct } from "../../../api/firestore-client";

@customElement("product-select")
export class ProductSelect extends LitElement {
  @property({ type: Array })
  products: CoinbaseProduct[] = [];

  @property({ type: String })
  selectedProduct = "";

  @state()
  private isOpen = false;

  @state()
  private searchQuery = "";

  @state()
  private selectedTab = "Crypto";

  private handleOpen() {
    this.isOpen = true;
  }

  private handleClose() {
    this.isOpen = false;
    this.searchQuery = "";
  }

  private handleSearch(e: InputEvent) {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  private handleProductSelect(product: CoinbaseProduct) {
    const symbol = `${product.baseCurrency}-${product.quoteCurrency}`;
    this.selectedProduct = symbol;
    this.dispatchEvent(
      new CustomEvent("product-changed", {
        detail: { product: symbol },
        bubbles: true,
        composed: true,
      })
    );
    this.handleClose();
  }

  private get filteredProducts() {
    return this.products.filter((product) => {
      const searchLower = this.searchQuery.toLowerCase();
      return (
        product.baseCurrency.toLowerCase().includes(searchLower) ||
        product.quoteCurrency.toLowerCase().includes(searchLower) ||
        `${product.baseCurrency}-${product.quoteCurrency}`
          .toLowerCase()
          .includes(searchLower)
      );
    });
  }

  private get resultsContent() {
    if (this.selectedTab === "Stocks" || this.selectedTab === "Forex") {
      return html`
        <div class="coming-soon">
          <div class="coming-soon-message">${this.selectedTab} coming soon</div>
        </div>
      `;
    }

    return html`
      <div class="results">
        ${this.filteredProducts.map(
          (product) => html`
            <div
              class="result-item"
              @click=${() => this.handleProductSelect(product)}
            >
              <div class="symbol">
                ${product.baseCurrency}-${product.quoteCurrency}
              </div>
              <div class="exchange">Coinbase</div>
            </div>
          `
        )}
      </div>
    `;
  }

  render() {
    return html`
      <div class="product-select">
        <button @click=${this.handleOpen} class="symbol-button">
          ${this.selectedProduct || "Select Symbol"}
        </button>

        ${this.isOpen
          ? html`
              <div class="modal-backdrop">
                <div class="modal">
                  <div class="modal-header">
                    <h2>Symbol Search</h2>
                    <button class="close-button" @click=${this.handleClose}>
                      ×
                    </button>
                  </div>

                  <div class="search-container">
                    <input
                      type="text"
                      placeholder="Search"
                      .value=${this.searchQuery}
                      @input=${this.handleSearch}
                      autofocus
                    />
                  </div>

                  <div class="tabs">
                    <button
                      class=${this.selectedTab === "All" ? "active" : ""}
                      @click=${() => (this.selectedTab = "All")}
                    >
                      All
                    </button>
                    <button
                      class=${this.selectedTab === "Stocks" ? "active" : ""}
                      @click=${() => (this.selectedTab = "Stocks")}
                    >
                      Stocks
                    </button>
                    <button
                      class=${this.selectedTab === "Crypto" ? "active" : ""}
                      @click=${() => (this.selectedTab = "Crypto")}
                    >
                      Crypto
                    </button>
                    <button
                      class=${this.selectedTab === "Forex" ? "active" : ""}
                      @click=${() => (this.selectedTab = "Forex")}
                    >
                      Forex
                    </button>
                  </div>

                  <div class="filter-row">
                    <select class="source-select" disabled>
                      <option>All sources</option>
                      <option selected>Coinbase</option>
                    </select>
                    <div class="coming-soon-badge">
                      More exchanges coming soon
                    </div>
                  </div>

                  ${this.resultsContent}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  static styles = css`
    .product-select {
      position: relative;
      display: inline-block;
    }

    .symbol-button {
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      min-width: 120px;
      text-align: left;
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 50px;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 8px;
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 18px;
    }

    .close-button {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      color: #666;
    }

    .search-container {
      padding: 16px;
      border-bottom: 1px solid #eee;
    }

    .search-container input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .tabs {
      display: flex;
      padding: 0 16px;
      border-bottom: 1px solid #eee;
    }

    .tabs button {
      padding: 8px 16px;
      border: none;
      background: none;
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }

    .tabs button.active {
      border-bottom-color: #2196f3;
      color: #2196f3;
    }

    .filter-row {
      padding: 8px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .source-select {
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      color: #999;
      background-color: #f5f5f5;
      cursor: not-allowed;
    }

    .source-select:disabled {
      opacity: 0.7;
    }

    .coming-soon-badge {
      font-size: 12px;
      color: #999;
      font-style: italic;
    }

    .results {
      overflow-y: auto;
      flex: 1;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    }

    .result-item:hover {
      background: #f5f5f5;
    }

    .symbol {
      font-weight: 500;
    }

    .exchange {
      color: #666;
    }

    .coming-soon {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #666;
    }

    .coming-soon-message {
      font-size: 16px;
      font-weight: 500;
      text-align: center;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }
  `;
}
