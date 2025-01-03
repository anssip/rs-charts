import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface MenuItem {
  label: string;
  action?: () => void;
  separator?: boolean;
  isHeader?: boolean;
}

@customElement("chart-context-menu")
export class ChartContextMenu extends LitElement {
  @property({ type: Object })
  position: MenuPosition = { x: 0, y: 0 };

  @property({ type: Array })
  items: MenuItem[] = [];

  @property({ type: Boolean })
  show = false;

  @state()
  private selectedIndex = -1;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.show) return;

    const menuItems = this.items.filter(
      (item) => !item.separator && !item.isHeader
    );

    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        const isArrowDown = e.key === "ArrowDown";
        this.selectedIndex = isArrowDown
          ? Math.min(this.selectedIndex + 1, menuItems.length - 1)
          : Math.max(this.selectedIndex - 1, 0);
        if (isArrowDown && this.selectedIndex === -1) this.selectedIndex = 0;
        this.scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        if (this.selectedIndex >= 0) {
          const selectedItem = menuItems[this.selectedIndex];
          if (selectedItem?.action) {
            selectedItem.action();
            this.show = false;
            this.dispatchEvent(
              new CustomEvent("menu-close", {
                bubbles: true,
                composed: true,
              })
            );
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.show = false;
        this.dispatchEvent(
          new CustomEvent("menu-close", {
            bubbles: true,
            composed: true,
          })
        );
        break;
    }
  };

  private scrollToSelected() {
    const selectedElement = this.renderRoot.querySelector(
      ".menu-item.selected"
    ) as HTMLElement;
    const menuContainer = this.renderRoot.querySelector(
      ".context-menu"
    ) as HTMLElement;

    if (selectedElement && menuContainer) {
      const containerRect = menuContainer.getBoundingClientRect();
      const elementRect = selectedElement.getBoundingClientRect();

      if (elementRect.bottom > containerRect.bottom) {
        menuContainer.scrollTop += elementRect.bottom - containerRect.bottom;
      } else if (elementRect.top < containerRect.top) {
        menuContainer.scrollTop -= containerRect.top - elementRect.top;
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  private renderMenuItem(item: MenuItem, index: number) {
    if (item.separator) {
      return html`<div class="separator"></div>`;
    }
    if (item.isHeader) {
      return html`<div class="menu-header">${item.label}</div>`;
    }

    const actionableItems = this.items.filter(
      (item) => !item.separator && !item.isHeader
    );
    const actionableIndex = actionableItems.indexOf(item);
    const isSelected = actionableIndex === this.selectedIndex;

    return html`
      <div
        class="menu-item ${isSelected ? "selected" : ""}"
        @click=${() => {
          item.action?.();
          this.show = false;
          this.dispatchEvent(
            new CustomEvent("menu-close", {
              bubbles: true,
              composed: true,
            })
          );
        }}
        @mouseover=${() => (this.selectedIndex = actionableIndex)}
      >
        ${item.label}
      </div>
    `;
  }

  render() {
    if (!this.show) return null;

    return html`
      <div
        class="context-menu"
        style="left: ${this.position.x}px; top: ${this.position.y}px"
        tabindex="0"
      >
        ${this.items.map((item, index) => this.renderMenuItem(item, index))}
      </div>
    `;
  }

  static styles = css`
    .context-menu {
      position: fixed;
      background: rgba(24, 24, 24, 0.5);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(143, 143, 143, 0.2);
      border-radius: 4px;
      padding: 0;
      min-width: 150px;
      z-index: 1001;
      outline: none;
      max-height: 80vh;
      overflow-y: auto;
    }

    .menu-item {
      padding: 8px 16px;
      cursor: pointer;
      color: var(--color-accent-2);
      font-size: 14px;
      transition: background-color 0.2s ease;
    }

    .menu-item:hover,
    .menu-item.selected {
      background: rgba(143, 143, 143, 0.5);
    }

    .menu-header {
      padding: 8px 16px;
      color: var(--color-primary);
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
      opacity: 0.7;
      cursor: default;
      user-select: none;
    }

    .separator {
      height: 1px;
      background: rgba(143, 143, 143, 0.2);
      margin: 4px 0;
    }
  `;
}
