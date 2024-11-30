import { LitElement, html, css, nothing, TemplateResult } from "lit";
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

  @state()
  private selectedIndex = -1;

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("isOpen") && this.isOpen) {
      // Focus the input field when modal opens
      const input = this.renderRoot.querySelector("input");
      if (input) {
        input.focus();
      }
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isOpen) return;

    e.stopPropagation(); // Prevent event from bubbling up
    const products = this.filteredProducts;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          products.length - 1
        );
        this.scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < products.length) {
          this.handleProductSelect(products[this.selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        this.handleClose();
        break;
    }
  };

  private scrollToSelected() {
    const selectedElement = this.renderRoot.querySelector(
      ".result-item.selected"
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }

  private handleOpen() {
    this.isOpen = true;
    this.selectedIndex = 0; // Select first item when opening
  }

  private handleClose() {
    this.isOpen = false;
    this.searchQuery = "";
    this.selectedIndex = -1;
  }

  private handleSearch(e: InputEvent) {
    this.searchQuery = (e.target as HTMLInputElement).value;
    this.selectedIndex = 0; // Reset selection when searching
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

  private highlightMatches(text: string): string | TemplateResult {
    if (!this.searchQuery) return text;

    const searchLower = this.searchQuery.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(searchLower);

    if (index === -1) return text;

    return html`${text.slice(0, index)}<span class="highlight"
        >${text.slice(index, index + this.searchQuery.length)}</span
      >${text.slice(index + this.searchQuery.length)}`;
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
          (product, index) => html`
            <div
              class="result-item ${index === this.selectedIndex
                ? "selected"
                : ""}"
              @click=${() => this.handleProductSelect(product)}
              @mouseover=${() => (this.selectedIndex = index)}
            >
              <div class="symbol">
                ${this.highlightMatches(
                  `${product.baseCurrency}-${product.quoteCurrency}`
                )}
              </div>
              <div class="exchange">Coinbase</div>
            </div>
          `
        )}
      </div>
    `;
  }

  public openWithSearch(initialChar: string) {
    this.isOpen = true;
    this.searchQuery = initialChar;
    this.selectedIndex = 0;
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
                <div class="modal" tabindex="0">
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
                      @keydown=${this.handleKeyDown}
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
      display: flex;
      justify-content: center;
    }

    .search-container input {
      width: calc(100% - 32px);
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .search-container input:focus {
      outline: none;
      border-color: #2196f3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
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

    .result-item:hover,
    .result-item.selected {
      background: #f5f5f5;
    }

    .result-item.selected {
      background: #e3f2fd; /* Light blue background for selected item */
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

    .highlight {
      color: #4caf50;
      font-weight: bold;
    }
  `;
}
