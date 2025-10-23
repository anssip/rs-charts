import type { CandlestickChart } from "./chart";
import type { ChartState, Layer } from "../..";
import type { TimeMarkersLayer } from "./time-markers-layer";
import type { PositionOverlay as PositionOverlayComponent } from "./position-overlay";
import { getDpr } from "../../util/chart-util";

/**
 * LayerUpdateCoordinator handles dimension and state updates for all chart layers.
 * Centralizes the logic for updating layer dimensions based on chart area size
 * and maintaining layer state synchronization.
 */
export class LayerUpdateCoordinator {
  constructor(
    private renderRoot: ShadowRoot,
    private getChart: () => CandlestickChart | null,
    private getState: () => ChartState,
    private getPriceAxisWidth: () => number,
  ) {}

  /**
   * Get the height of the main chart area, excluding bottom stacked indicators.
   * This ensures layers don't overlap with bottom indicators like RSI.
   * Falls back to canvas height if the chart item element is not found.
   */
  private getMainChartHeight(): number {
    const chart = this.getChart();
    if (!chart?.canvas) return 0;

    // Try to get the height from the chart item container (excludes bottom indicators)
    const indicatorStack = this.renderRoot.querySelector("indicator-stack.main-chart");
    if (indicatorStack) {
      const chartItem = indicatorStack.shadowRoot?.querySelector(".stack-item.chart-item") as HTMLElement;
      if (chartItem && chartItem.clientHeight > 0) {
        return chartItem.clientHeight;
      }
    }

    // Fallback to canvas height if chart item not found
    const dpr = getDpr();
    return chart.canvas.height / dpr;
  }

  /**
   * Update a generic layer with dimensions and state
   */
  updateLayer(layer: Layer | undefined): void {
    if (!layer) return;
    const chart = this.getChart();
    if (!chart?.canvas) return;

    // Get the chart area dimensions
    const chartArea = this.renderRoot.querySelector(
      ".chart-area",
    ) as HTMLElement;
    if (chartArea && chart.canvas) {
      // Use the chart area width minus price axis (same as what the tool uses)
      layer.width = chartArea.clientWidth - this.getPriceAxisWidth();

      // Use the main chart height (excludes bottom stacked indicators)
      layer.height = this.getMainChartHeight();
    }

    // Update the state to ensure trend lines recalculate positions
    layer.state = this.getState();
    layer.requestUpdate();
  }

  /**
   * Update time markers layer
   * Special case: Uses full chart area height to span over all indicators
   */
  updateTimeMarkersLayer(): void {
    const timeMarkersLayer = this.renderRoot.querySelector(
      "time-markers-layer",
    ) as TimeMarkersLayer;
    if (!timeMarkersLayer) return;

    const chartArea = this.renderRoot.querySelector(
      ".chart-area",
    ) as HTMLElement;
    if (chartArea) {
      timeMarkersLayer.width =
        chartArea.clientWidth - this.getPriceAxisWidth();
      // Use full chart-area height to span over all indicators
      timeMarkersLayer.height = chartArea.clientHeight;
    }

    timeMarkersLayer.state = this.getState();
    timeMarkersLayer.requestUpdate();
  }

  /**
   * Update position overlay components
   * Special case: Controller manages two components (entry line + info box)
   */
  updatePositionOverlay(): void {
    const chart = this.getChart();
    if (!chart?.canvas) return;

    const positionOverlays = this.renderRoot.querySelectorAll(
      "position-overlay",
    ) as NodeListOf<PositionOverlayComponent>;

    positionOverlays.forEach((overlay) => {
      if (overlay && chart.canvas) {
        const chartArea = this.renderRoot.querySelector(
          ".chart-area",
        ) as HTMLElement;
        if (chartArea && chart.canvas) {
          overlay.width = chartArea.clientWidth - this.getPriceAxisWidth();
          // Use the main chart height (excludes bottom stacked indicators)
          overlay.height = this.getMainChartHeight();
        }

        overlay.state = this.getState();
        overlay.requestUpdate();
      }
    });
  }

  /**
   * Update risk zones canvas layer
   * Special case: Sets timeRange and priceRange properties for coordinate mapping
   */
  updateRiskZonesCanvasLayer(): void {
    const chart = this.getChart();
    if (!chart?.canvas) return;

    const riskZonesLayer = this.renderRoot.querySelector(
      "risk-zones-canvas-layer",
    ) as any;
    if (!riskZonesLayer) return;

    const chartArea = this.renderRoot.querySelector(
      ".chart-area",
    ) as HTMLElement;
    if (chartArea && chart.canvas) {
      riskZonesLayer.width = chartArea.clientWidth - this.getPriceAxisWidth();
      // Use the main chart height (excludes bottom stacked indicators)
      riskZonesLayer.height = this.getMainChartHeight();
    }

    const state = this.getState();
    riskZonesLayer.state = state;
    riskZonesLayer.timeRange = state.timeRange;
    riskZonesLayer.priceRange = state.priceRange;
    riskZonesLayer.requestUpdate();
  }

  /**
   * Update live decorators layer (live price line)
   * Special case: Uses resize() method instead of width/height properties
   */
  updateLiveDecoratorsLayer(): void {
    const chart = this.getChart();
    if (!chart?.canvas) return;

    const liveDecoratorsLayer = this.renderRoot.querySelector(
      "live-decorators",
    ) as any;
    if (!liveDecoratorsLayer) return;

    const chartArea = this.renderRoot.querySelector(
      ".chart-area",
    ) as HTMLElement;
    if (chartArea && chart.canvas) {
      const width = chartArea.clientWidth - this.getPriceAxisWidth();
      const height = this.getMainChartHeight();

      // Call resize method on live-decorators to update its canvas dimensions
      if (typeof liveDecoratorsLayer.resize === 'function') {
        liveDecoratorsLayer.resize(width, height);
      }
    }
  }

  /**
   * Convenience method to update all layers at once
   * Useful during draw operations or viewport changes
   */
  updateAllLayers(layers: {
    trendLineLayer?: Layer;
    patternLabelsLayer?: Layer;
    tradingMarkersLayer?: Layer;
    priceLinesLayer?: Layer;
    tradeZonesLayer?: Layer;
    annotationsLayer?: Layer;
  }): void {
    if (layers.trendLineLayer) this.updateLayer(layers.trendLineLayer);
    if (layers.patternLabelsLayer) this.updateLayer(layers.patternLabelsLayer);
    if (layers.tradingMarkersLayer)
      this.updateLayer(layers.tradingMarkersLayer);
    if (layers.priceLinesLayer) this.updateLayer(layers.priceLinesLayer);
    if (layers.tradeZonesLayer) this.updateLayer(layers.tradeZonesLayer);
    if (layers.annotationsLayer) this.updateLayer(layers.annotationsLayer);

    // Special cases with unique requirements
    this.updateTimeMarkersLayer();
    this.updateRiskZonesCanvasLayer();
    this.updatePositionOverlay();
    this.updateLiveDecoratorsLayer();
  }
}
