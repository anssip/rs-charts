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

  @property({ type: Boolean })
  compact = false;

  @property({ type: Array })
  starredSymbols: string[] = [];

  @state()
  private isOpen = false;

  @state()
  private selectedIndex = -1;

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("isOpen") && this.isOpen) {
      // Reset selection when opening
      this.selectedIndex = 0;
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isOpen) return;

    e.stopPropagation(); // Prevent event from bubbling up
    const products = this.starredProducts;
    const totalItems = products.length + 1; // +1 for "Manage Symbols"

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          totalItems - 1
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
        if (this.selectedIndex === products.length) {
          // Selected "Manage Symbols"
          this.handleManageSymbols();
        } else if (this.selectedIndex >= 0 && this.selectedIndex < products.length) {
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
    this.selectedIndex = -1;
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

  private get starredProducts() {
    return this.products.filter((product) => {
      const symbol = `${product.baseCurrency}-${product.quoteCurrency}`;
      return this.starredSymbols.includes(symbol);
    });
  }

  private handleManageSymbols() {
    this.handleClose();
    this.dispatchEvent(new CustomEvent("manage-symbols", {
      bubbles: true,
      composed: true
    }));
  }




  render() {
    return html`
      <div class="product-select" part="container">
        <spot-button
          @click=${this.handleOpen}
          .label=${this.compact ? undefined : "Symbol"}
          .value=${this.selectedProduct || "Select Symbol"}
          ?compact=${this.compact}
          part="button"
        ></spot-button>

        ${this.isOpen
          ? html`
              <div class="dropdown-backdrop" @click=${this.handleClose}>
                <div 
                  class="dropdown-menu"
                  @click=${(e: Event) => e.stopPropagation()}
                  @keydown=${this.handleKeyDown}
                >
                  <div class="dropdown-content">
                    ${this.starredProducts.length === 0 
                      ? html`
                          <div class="empty-state">
                            <p>No symbols added yet</p>
                            <p class="empty-hint">Click "Manage Symbols" to add symbols</p>
                          </div>
                        `
                      : html`
                          ${this.starredProducts.map((product, index) => html`
                            <div
                              class="dropdown-item ${index === this.selectedIndex ? "selected" : ""}"
                              @click=${() => this.handleProductSelect(product)}
                              @mouseover=${() => (this.selectedIndex = index)}
                            >
                              <div class="symbol-name">
                                ${product.baseCurrency}-${product.quoteCurrency}
                              </div>
                              <div class="exchange-name">Coinbase</div>
                            </div>
                          `)}
                        `
                    }
                  </div>
                  <div class="dropdown-footer">
                    <div
                      class="dropdown-item manage-symbols ${this.selectedIndex === this.starredProducts.length ? "selected" : ""}"
                      @click=${this.handleManageSymbols}
                      @mouseover=${() => (this.selectedIndex = this.starredProducts.length)}
                    >
                      <div class="manage-symbols-text">⚙️ Manage Symbols</div>
                    </div>
                  </div>
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
      width: 100%;
    }

    .dropdown-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--color-primary-dark-50);
      border: 1px solid var(--color-background-secondary-20);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      z-index: 1000;
      min-width: 250px;
    }

    .dropdown-content {
      max-height: 300px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-background-secondary) var(--color-primary-dark-98);
    }

    .dropdown-content::-webkit-scrollbar {
      width: 8px;
    }

    .dropdown-content::-webkit-scrollbar-track {
      background: var(--color-primary-dark-98);
    }

    .dropdown-content::-webkit-scrollbar-thumb {
      background-color: var(--color-background-secondary);
      border-radius: 4px;
    }

    .dropdown-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .dropdown-item:hover:not(.selected) {
      background: rgba(143, 143, 143, 0.1);
    }

    .dropdown-item.selected {
      background: rgba(93, 91, 237, 0.15);
    }

    .symbol-name {
      color: var(--color-accent-2);
      font-weight: 500;
      font-size: 14px;
    }

    .exchange-name {
      color: var(--color-background-secondary);
      font-size: 12px;
    }

    .dropdown-footer {
      border-top: 1px solid var(--color-background-secondary-20);
      background: var(--color-primary-dark-98);
    }

    .manage-symbols {
      border-top: none;
    }

    .manage-symbols-text {
      color: var(--color-accent-2);
      font-weight: 500;
      font-size: 14px;
    }

    .empty-state {
      padding: 20px;
      text-align: center;
      color: var(--color-background-secondary);
    }

    .empty-state p {
      margin: 0 0 8px 0;
      font-size: 14px;
    }

    .empty-state .empty-hint {
      font-size: 12px;
      opacity: 0.7;
    }

    /* Keyboard navigation highlight */
    .dropdown-item.selected .symbol-name,
    .dropdown-item.selected .manage-symbols-text {
      color: var(--color-accent-1);
    }
  `;
}
