import { html, LitElement, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { observe, xinValue } from "xinjs";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { formatPrice } from "../../util/price-util";
import {
  Granularity,
  granularityLabel,
  getAllGranularities,
  granularityToMs,
  numCandlesInRange,
} from "../../../server/services/price-data/price-history-model";
import { CoinbaseProduct } from "../../api/firestore-client";
import "../chart/toolbar/product-select";
import { ChartState } from "../..";
import "../common/button";
import "../chart/context-menu";
import "./toolbar/chart-toolbar";
import { ChartContainer } from "./chart-container";

@customElement("price-info")
export class PriceInfo extends LitElement {
  @property({ type: String })
  symbol = "";

  @property({ type: Array })
  symbols: CoinbaseProduct[] = [];

  @property({ type: Boolean })
  isFullscreen = false;

  @property({ type: Boolean })
  isFullWindow = false;

  @property({ type: Boolean })
  showVolume = false;

  @property({ type: String })
  granularity: Granularity = (xin["state.granularity"] ??
    "ONE_HOUR") as Granularity;

  @state()
  private liveCandle: LiveCandle | null = null;

  @state()
  private isGranularityDropdownOpen = false;

  @state()
  private granularityMenuPosition = { x: 0, y: 0 };

  @state()
  private _state: ChartState = xin["state"] as ChartState;

  @state()
  private isMobile = false;

  @property({ type: Object })
  container?: ChartContainer;

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");

  firstUpdated() {
    observe("state.liveCandle", () => {
      this.liveCandle = xinValue(xin["state.liveCandle"]) as LiveCandle;
    });
    observe("state.granularity", () => {
      this.granularity = xinValue(xin["state.granularity"]) as Granularity;
    });
    observe("state.symbol", () => {
      this.symbol = xinValue(xin["state.symbol"]) as string;
    });
    observe("state", () => {
      this._state = xin["state"] as ChartState;
    });

    // Add media query listener
    this.isMobile = this.mobileMediaQuery.matches;
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);

    document.addEventListener("click", this.handleClickOutside);
    window.addEventListener("keydown", this.handleKeyPress);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this.handleClickOutside);
    window.removeEventListener("keydown", this.handleKeyPress);
    this.mobileMediaQuery.removeEventListener(
      "change",
      this.handleMobileChange
    );
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
  };

  private handleClickOutside = (e: MouseEvent) => {
    const path = e.composedPath();
    const dropdownEl = this.renderRoot.querySelector(".granularity-dropdown");
    const buttonEl = this.renderRoot.querySelector("spot-button");

    // If clicking outside both the dropdown and the button, close the dropdown
    if (
      !path.includes(dropdownEl as EventTarget) &&
      !path.includes(buttonEl as EventTarget)
    ) {
      this.isGranularityDropdownOpen = false;
    }
  };

  private handleKeyPress = (e: KeyboardEvent) => {
    // Handle Escape key for granularity dropdown
    if (e.key === "Escape") {
      if (this.isGranularityDropdownOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.isGranularityDropdownOpen = false;
        return;
      }
    }

    // Handle keyboard shortcuts for product select
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

  private handleGranularityChange(newGranularity: Granularity) {
    const currentTimeRange = this._state.timeRange;
    const candleCount = this._state.priceHistory.getCandlesInRange(
      currentTimeRange.start,
      currentTimeRange.end
    ).length;

    const newGranularityMs = granularityToMs(newGranularity);

    // Calculate current number of candles and ensure it doesn't exceed MAX_CANDLES
    const MAX_CANDLES = 300;
    const newTimeSpan = candleCount * newGranularityMs;
    const candidateTimeRange = {
      start: currentTimeRange.end - newTimeSpan,
      end: currentTimeRange.end,
    };
    const newCandleCount = numCandlesInRange(
      newGranularity,
      candidateTimeRange.start,
      candidateTimeRange.end
    );

    const finalCandleCount = Math.min(newCandleCount, MAX_CANDLES);
    const newEnd =
      Math.min(currentTimeRange.end, new Date().getTime()) +
      newGranularityMs * 2;
    const newTimeRange = {
      start: newEnd - finalCandleCount * newGranularityMs,
      end: newEnd,
    };

    this._state.timeRange = newTimeRange;
    this._state.granularity = newGranularity;
    this.isGranularityDropdownOpen = false;
  }

  private handleProductChange(e: CustomEvent) {
    this._state.symbol = e.detail.product;
  }

  private handleGranularityClick(e: MouseEvent) {
    const button = e.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();

    this.granularityMenuPosition = {
      x: rect.left,
      y: rect.bottom + 4,
    };

    this.isGranularityDropdownOpen = !this.isGranularityDropdownOpen;
  }

  private handleFullscreenChange = () => {
    this.isFullscreen = document.fullscreenElement === this;
    // Delay reflow recalculation
    setTimeout(() => {
      this.requestUpdate();
    }, 100);
  };

  render() {
    const isBearish = this.liveCandle
      ? this.liveCandle.close < this.liveCandle.open
      : false;
    const priceValueColor = isBearish
      ? "var(--color-error)"
      : "var(--color-accent-1)";

    const priceLabels = {
      open: { full: "Open", short: "O:" },
      high: { full: "High", short: "H:" },
      low: { full: "Low", short: "L:" },
      close: { full: "Close", short: "C:" },
    };

    const [close, open, low, high] = ["close", "open", "low", "high"].map(
      (price) =>
        this.liveCandle?.[price as keyof LiveCandle]
          ? `$${formatPrice(
              this.liveCandle[price as keyof LiveCandle] as number
            )}`
          : "..."
    );

    return html`
      <div class="price-info">
        <div class="metadata-group">
          <div class="price-item">
            <product-select
              .compact=${this.isMobile}
              .products=${this.symbols}
              .selectedProduct=${this.symbol}
              @product-changed=${this.handleProductChange}
            ></product-select>
          </div>
          <div class="price-item" style="position: relative;">
            <spot-button
              .compact=${this.isMobile}
              label="Time Frame"
              .value=${granularityLabel(this.granularity)}
              @click=${this.handleGranularityClick}
            ></spot-button>
          </div>
        </div>
        <div class="price-group">
          <div class="price-item">
            <span class="price-label"
              >${this.isMobile
                ? priceLabels.open.short
                : priceLabels.open.full}</span
            >
            <span class="price-value" style="color: ${priceValueColor}"
              >${open}</span
            >
          </div>
          <div class="price-item">
            <span class="price-label"
              >${this.isMobile
                ? priceLabels.high.short
                : priceLabels.high.full}</span
            >
            <span class="price-value" style="color: ${priceValueColor}"
              >${high}</span
            >
          </div>
          <div class="price-item">
            <span class="price-label"
              >${this.isMobile
                ? priceLabels.low.short
                : priceLabels.low.full}</span
            >
            <span class="price-value" style="color: ${priceValueColor}"
              >${low}</span
            >
          </div>
          <div class="price-item">
            <span class="price-label"
              >${this.isMobile
                ? priceLabels.close.short
                : priceLabels.close.full}</span
            >
            <span class="price-value" style="color: ${priceValueColor}"
              >${close}</span
            >
          </div>
        </div>

        <div class="toolbar-container">
          <chart-toolbar
            .isFullscreen=${this.isFullscreen}
            .isFullWindow=${this.isFullWindow}
            .showVolume=${this.showVolume}
            .container=${this.container}
            @toggle-fullscreen=${(e: CustomEvent) => {
              if (e.defaultPrevented) return;
              e.preventDefault();
              e.stopPropagation();
              this.dispatchEvent(
                new CustomEvent("toggle-fullscreen", {
                  bubbles: true,
                  composed: true,
                  cancelable: true,
                })
              );
            }}
            @toggle-fullwindow=${(e: CustomEvent) => {
              if (e.defaultPrevented) return;
              e.preventDefault();
              e.stopPropagation();
              this.dispatchEvent(
                new CustomEvent("toggle-fullwindow", {
                  bubbles: true,
                  composed: true,
                  cancelable: true,
                })
              );
            }}
            @upgrade-click=${() =>
              this.dispatchEvent(
                new CustomEvent("upgrade-click", {
                  bubbles: true,
                  composed: true,
                })
              )}
          ></chart-toolbar>
        </div>

        <chart-context-menu
          .show=${this.isGranularityDropdownOpen}
          .position=${this.granularityMenuPosition}
          .items=${getAllGranularities().map((g) => ({
            label: granularityLabel(g),
            action: () => this.handleGranularityChange(g),
          }))}
          @menu-close=${() => {
            this.isGranularityDropdownOpen = false;
          }}
        ></chart-context-menu>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-width: 160px;
      max-width: 100%;
      white-space: normal;
      font-family: var(--font-primary);
    }

    .price-info {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: center;
      width: 100%;
      justify-content: space-between;
      position: relative;
    }

    .metadata-group {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: flex-start;
      flex: 0 auto;
      min-width: 0;
      flex-grow: 1;
    }

    .price-group {
      display: flex;
      gap: 36px;
      align-items: center;
      flex: 0 auto;
      justify-content: flex-end;
      min-width: 0;
    }

    .price-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .price-label {
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 500;
      font-family: var(--font-secondary);
    }

    .price-value {
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 80px;
    }

    .toolbar-container {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: -40px;
      z-index: 7;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    @media (max-width: 767px) {
      .price-info {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding-top: 4px;
      }

      .price-group {
        order: -1;
        display: flex;
        gap: 8px;
        min-width: 0;
        justify-content: space-between;
        margin-top: -10px;
      }

      .metadata-group {
        display: flex;
        gap: 8px;
        min-width: 0;
        justify-content: center;
        padding: 0 12px;
      }

      .metadata-group .price-item {
        flex: 1;
        max-width: 120px;
        position: relative;
      }

      .metadata-group spot-button,
      .metadata-group product-select {
        width: 100%;
      }

      .price-group .price-item {
        flex-direction: row;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: unset;
      }

      .price-label {
        min-width: 20px;
        font-size: 10px;
      }

      .price-value {
        font-size: 11px;
        min-width: unset;
      }
    }
  `;
}
