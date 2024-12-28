import { LitElement, html, css, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CoinbaseProduct } from "../../../api/firestore-client";
import "../../common/button";

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
    ) as HTMLElement;
    const resultsContainer = this.renderRoot.querySelector(
      ".results"
    ) as HTMLElement;

    if (selectedElement && resultsContainer) {
      const containerRect = resultsContainer.getBoundingClientRect();
      const elementRect = selectedElement.getBoundingClientRect();
      const padding = 40; // Pixels of padding to keep visible above/below

      // Check if element is getting close to the bottom of visible area
      if (elementRect.bottom > containerRect.bottom - padding) {
        resultsContainer.scrollTop +=
          elementRect.bottom - containerRect.bottom + padding;
      }
      // Check if element is getting close to the top of visible area
      else if (elementRect.top < containerRect.top + padding) {
        resultsContainer.scrollTop -=
          containerRect.top - elementRect.top + padding;
      }
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
        <spot-button
          @click=${this.handleOpen}
          label="Symbol"
          .value=${this.selectedProduct || "Select Symbol"}
        ></spot-button>

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

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-modal-backdrop);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 100px;
      z-index: 1000;
      isolation: isolate;
    }

    .modal {
      position: relative;
      z-index: 1001;
      background: var(--color-primary-dark-50);
      border-radius: 8px;
      width: 500px;
      max-width: 90vw;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--color-background-secondary-20);
    }

    .modal::before {
      content: "";
      position: absolute;
      inset: 0;
      background: var(--color-primary-dark-50);
      border-radius: inherit;
      z-index: -1;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--color-background-secondary-20);
      background: var(--color-primary-dark-98);
    }

    .modal-header h2 {
      margin: 0;
      color: var(--color-accent-2);
      font-size: 18px;
    }

    .close-button {
      background: none;
      border: none;
      color: var(--color-accent-2);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
    }

    .close-button:hover {
      color: var(--color-accent-1);
    }

    .search-container {
      padding: 16px;
      border-bottom: 1px solid var(--color-background-secondary-20);
      background: var(--color-primary-dark-98);
    }

    input {
      width: calc(100% - 32px);
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
      border: 1px solid var(--color-background-secondary-30);
      background: var(--color-primary-dark-98);
      color: var(--color-accent-2);
    }

    input:focus {
      outline: none;
      border-color: var(--color-accent-1);
      box-shadow: 0 0 0 2px var(--color-accent-1);
    }

    .tabs {
      display: flex;
      padding: 8px 16px;
      gap: 8px;
      border-bottom: 1px solid var(--color-background-secondary-20);
      background: var(--color-primary-dark-98);
    }

    .tabs button {
      padding: 4px 12px;
      border: none;
      background: none;
      color: var(--color-accent-2);
      cursor: pointer;
      border-radius: 4px;
    }

    .tabs button:hover {
      background: var(--color-background-secondary);
    }

    .tabs button.active {
      background: var(--color-accent-1);
      color: var(--color-primary-dark);
    }

    .filter-row {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      gap: 8px;
      border-bottom: 1px solid var(--color-background-secondary-20);
      background: var(--color-primary-dark-98);
    }

    .source-select {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--color-background-secondary-30);
      background: var(--color-primary-dark-98);
      color: var(--color-accent-2);
    }

    .coming-soon-badge {
      font-size: 12px;
      color: var(--color-background-secondary);
    }

    .results {
      max-height: 300px;
      overflow-y: auto;
      scroll-behavior: smooth;
      scrollbar-width: thin;
      scrollbar-color: var(--color-background-secondary)
        var(--color-primary-dark-98);
      background: var(--color-primary-dark-98);
    }

    .results::-webkit-scrollbar {
      width: 8px;
    }

    .results::-webkit-scrollbar-track {
      background: var(--color-primary-dark-98);
    }

    .results::-webkit-scrollbar-thumb {
      background-color: var(--color-background-secondary);
      border-radius: 4px;
      border: 2px solid var(--color-primary-dark);
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      cursor: pointer;
      color: var(--color-accent-2);
      transition: background-color 0.2s ease;
    }

    .result-item:hover:not(.selected) {
      background: rgba(var(--color-background-secondary-rgb), 0.2);
    }

    .result-item.selected {
      background: rgba(var(--color-background-secondary-rgb), 0.3);
    }

    .symbol {
      font-weight: bold;
    }

    .exchange {
      color: var(--color-background-secondary);
      font-size: 14px;
    }

    .highlight {
      background: var(--color-accent-1);
      color: var(--color-primary-dark);
      padding: 0 2px;
      border-radius: 2px;
    }

    .coming-soon {
      padding: 32px;
      text-align: center;
      color: var(--color-background-secondary);
    }

    .coming-soon-message {
      font-size: 18px;
      margin-bottom: 8px;
    }
  `;
}
