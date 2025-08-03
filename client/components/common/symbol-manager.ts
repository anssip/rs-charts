import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CoinbaseProduct } from "../../api/firestore-client";
import { getLogger } from "../../util/logger";

const logger = getLogger("SymbolManager");

export interface StarredSymbol {
  symbol: string;
  timestamp: number;
}

@customElement("symbol-manager")
export class SymbolManager extends LitElement {
  @property({ type: Boolean })
  open = false;

  @property({ type: Array })
  allProducts: CoinbaseProduct[] = [];

  @property({ type: Array })
  starredSymbols: string[] = [];

  @property({ type: String })
  userEmail = "";

  @state()
  private searchQuery = "";

  @state()
  private filteredProducts: CoinbaseProduct[] = [];

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("open") && this.open) {
      // Focus search input when modal opens
      setTimeout(() => {
        const input = this.renderRoot.querySelector("input");
        if (input) {
          input.focus();
        }
      }, 0);
      // Initialize filtered products
      this.filterProducts();
    }

    if (changedProperties.has("allProducts") || changedProperties.has("searchQuery")) {
      this.filterProducts();
    }
  }

  private filterProducts() {
    if (!this.searchQuery) {
      this.filteredProducts = [...this.allProducts];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredProducts = this.allProducts.filter(product => {
      const symbol = `${product.baseCurrency}-${product.quoteCurrency}`;
      return (
        product.baseCurrency.toLowerCase().includes(query) ||
        product.quoteCurrency.toLowerCase().includes(query) ||
        symbol.toLowerCase().includes(query)
      );
    });
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent("close", {
      bubbles: true,
      composed: true
    }));
    this.searchQuery = "";
  }

  private handleSearch(e: InputEvent) {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  private isStarred(product: CoinbaseProduct): boolean {
    const symbol = `${product.baseCurrency}-${product.quoteCurrency}`;
    return this.starredSymbols.includes(symbol);
  }

  private toggleStar(product: CoinbaseProduct) {
    const symbol = `${product.baseCurrency}-${product.quoteCurrency}`;
    const isCurrentlyStarred = this.isStarred(product);

    logger.debug(`Toggling star for ${symbol}, currently starred: ${isCurrentlyStarred}`);

    this.dispatchEvent(new CustomEvent("toggle-star", {
      detail: {
        symbol,
        starred: !isCurrentlyStarred
      },
      bubbles: true,
      composed: true
    }));
  }

  private get yourSymbols() {
    return this.filteredProducts.filter(product => this.isStarred(product));
  }

  private get availableSymbols() {
    return this.filteredProducts.filter(product => !this.isStarred(product));
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div class="modal-backdrop" @click=${this.handleClose}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Symbol Manager</h2>
            <button class="close-button" @click=${this.handleClose}>×</button>
          </div>

          <div class="search-container">
            <input
              type="text"
              placeholder="Search by name or symbol"
              .value=${this.searchQuery}
              @input=${this.handleSearch}
            />
          </div>

          <div class="symbols-container">
            ${this.yourSymbols.length > 0 ? html`
              <div class="section">
                <h3>Your Symbols</h3>
                <div class="symbol-grid">
                  ${this.yourSymbols.map(product => html`
                    <div class="symbol-card starred">
                      <div class="symbol-info">
                        <div class="symbol-name">
                          ${product.baseCurrency}-${product.quoteCurrency}
                        </div>
                        <div class="symbol-exchange">Coinbase</div>
                      </div>
                      <button 
                        class="star-button active" 
                        @click=${() => this.toggleStar(product)}
                        title="Remove from favorites"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                      </button>
                    </div>
                  `)}
                </div>
              </div>
            ` : nothing}

            <div class="section">
              <h3>Available Symbols</h3>
              ${this.availableSymbols.length === 0 ? html`
                <div class="no-results">
                  ${this.searchQuery ? 'No symbols match your search' : 'All symbols are in your favorites'}
                </div>
              ` : html`
                <div class="symbol-grid">
                  ${this.availableSymbols.map(product => html`
                    <div class="symbol-card">
                      <div class="symbol-info">
                        <div class="symbol-name">
                          ${product.baseCurrency}-${product.quoteCurrency}
                        </div>
                        <div class="symbol-exchange">Coinbase</div>
                      </div>
                      <button 
                        class="star-button" 
                        @click=${() => this.toggleStar(product)}
                        title="Add to favorites"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                      </button>
                    </div>
                  `)}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .modal {
      background: var(--color-primary-dark-50);
      border-radius: 12px;
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 1px solid var(--color-background-secondary-20);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid var(--color-background-secondary-20);
    }

    .modal-header h2 {
      margin: 0;
      color: var(--color-accent-2);
      font-size: 20px;
      font-weight: 500;
    }

    .close-button {
      background: none;
      border: none;
      color: var(--color-accent-2);
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .close-button:hover {
      background: rgba(143, 143, 143, 0.1);
      color: var(--color-accent-1);
    }

    .search-container {
      padding: 20px;
      border-bottom: 1px solid var(--color-background-secondary-20);
    }

    input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid var(--color-background-secondary-30);
      background: var(--color-primary-dark-98);
      color: var(--color-accent-2);
      font-size: 14px;
      transition: all 0.2s ease;
    }

    input:focus {
      outline: none;
      border-color: var(--color-accent-1);
      box-shadow: 0 0 0 3px rgba(93, 91, 237, 0.1);
    }

    .symbols-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .section {
      margin-bottom: 32px;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section h3 {
      margin: 0 0 16px 0;
      color: var(--color-accent-2);
      font-size: 16px;
      font-weight: 500;
    }

    .symbol-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .symbol-card {
      background: var(--color-primary-dark-98);
      border: 1px solid var(--color-background-secondary-20);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
      cursor: default;
    }

    .symbol-card:hover {
      background: rgba(143, 143, 143, 0.05);
      border-color: var(--color-background-secondary-30);
    }

    .symbol-card.starred {
      background: rgba(93, 91, 237, 0.1);
      border-color: rgba(93, 91, 237, 0.3);
    }

    .symbol-info {
      flex: 1;
    }

    .symbol-name {
      color: var(--color-accent-2);
      font-weight: 500;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .symbol-exchange {
      color: var(--color-background-secondary);
      font-size: 12px;
    }

    .star-button {
      background: none;
      border: none;
      color: var(--color-background-secondary);
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .star-button:hover {
      background: rgba(143, 143, 143, 0.1);
      color: var(--color-accent-1);
    }

    .star-button.active {
      color: var(--color-accent-1);
    }

    .no-results {
      text-align: center;
      color: var(--color-background-secondary);
      padding: 40px 20px;
      font-size: 14px;
    }

    /* Scrollbar styles */
    .symbols-container::-webkit-scrollbar {
      width: 8px;
    }

    .symbols-container::-webkit-scrollbar-track {
      background: var(--color-primary-dark-98);
    }

    .symbols-container::-webkit-scrollbar-thumb {
      background-color: var(--color-background-secondary);
      border-radius: 4px;
      border: 2px solid var(--color-primary-dark-98);
    }

    /* Mobile styles */
    @media (max-width: 767px) {
      .modal {
        width: 95%;
        max-height: 90vh;
      }

      .symbol-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}