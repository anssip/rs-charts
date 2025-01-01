import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface MenuItem {
  label: string;
  action: () => void;
  separator?: boolean;
}

@customElement("chart-context-menu")
export class ChartContextMenu extends LitElement {
  @property({ type: Object })
  position: MenuPosition = { x: 0, y: 0 };

  @property({ type: Array })
  items: MenuItem[] = [];

  @property({ type: Boolean })
  show = false;

  render() {
    if (!this.show) return null;

    return html`
      <div
        class="context-menu"
        style="left: ${this.position.x}px; top: ${this.position.y}px"
      >
        ${this.items.map(
          (item, index) => html`
            ${item.separator ? html`<div class="separator"></div>` : ""}
            <div class="menu-item" @click=${item.action}>${item.label}</div>
          `
        )}
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
    }

    .menu-item {
      padding: 8px 16px;
      cursor: pointer;
      color: var(--color-accent-2);
      font-size: 14px;
    }

    .menu-item:hover {
      background: rgba(143, 143, 143, 0.5);
    }

    .separator {
      height: 1px;
      background: rgba(143, 143, 143, 0.2);
      margin: 4px 0;
    }
  `;
}
