import type { ChartContainer } from "./chart-container";
import { getLogger } from "../../util/logger";
import { touch } from "xinjs";

const logger = getLogger("ChartEventHandlers");

/**
 * ChartEventHandlers manages all event handler logic for ChartContainer.
 * Extracted from ChartContainer to reduce complexity and improve maintainability.
 */
export class ChartEventHandlers {
  constructor(private container: ChartContainer) {}

  /**
   * Handle upgrade event - exit fullscreen if active
   */
  handleUpgrade = async () => {
    if ((this.container as any).isFullscreen) {
      await document.exitFullscreen();
    }
  };

  /**
   * Handle candle click events
   */
  handleCandleClick = (event: CustomEvent) => {
    event.stopPropagation();
    const { candle, x, y } = event.detail;
    const chartId = (this.container as any)._chartId || "unknown";

    logger.debug(
      `handleCandleClick called for chart ${chartId} with candle:`,
      candle,
      "x:",
      x,
      "y:",
      y,
    );

    // x and y are already relative coordinates from the event detail
    // but we should ensure they're relative to the chart container
    const containerRect = this.container.getBoundingClientRect();
    (this.container as any).candleTooltipData = {
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      x: x - containerRect.left,
      y: y - containerRect.top,
    };
    (this.container as any).showCandleTooltip = true;
    logger.debug(
      `Set showCandleTooltip to true for chart ${chartId}, data:`,
      (this.container as any).candleTooltipData,
    );
  };

  /**
   * Handle price line dragged events from interaction layer
   */
  handlePriceLineDragged = (event: CustomEvent) => {
    const { lineId, newPrice, line } = event.detail;

    // Update the price line with the new price
    const updatedLine = { ...line, price: newPrice };
    this.container.updatePriceLine(lineId, updatedLine);
  };

  /**
   * Handle annotation dragged events from interaction layer
   * Routes to controller's callback
   */
  handleAnnotationDraggedEvent = (event: CustomEvent) => {
    if ((this.container as any).annotationsController) {
      (this.container as any).annotationsController.handleAnnotationDragged(
        event.detail,
      );
    }
  };

  /**
   * Handle risk zone clicked events from interaction layer
   */
  handleRiskZoneClicked = (event: CustomEvent) => {
    const { zoneId, zone } = event.detail;
    logger.debug(`ChartContainer: Risk zone clicked: ${zoneId}`);

    // Forward event to Chart API
    this.container.dispatchEvent(
      new CustomEvent("risk-zone-clicked", {
        detail: { zoneId, zone },
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * Handle risk zone hovered events from interaction layer
   */
  handleRiskZoneHovered = (event: CustomEvent) => {
    const { zoneId, zone } = event.detail;
    logger.debug(`ChartContainer: Risk zone hovered: ${zoneId}`);

    // Forward event to Chart API
    this.container.dispatchEvent(
      new CustomEvent("risk-zone-hovered", {
        detail: { zoneId, zone },
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * Handle document click to hide tooltip when clicking outside
   */
  handleDocumentClick = (event: MouseEvent) => {
    // Hide tooltip if clicking outside the chart
    const target = event.target as Element;
    // Check if the click is within this chart container or the tooltip itself
    const tooltip = (this.container as any).renderRoot.querySelector(
      "candle-tooltip",
    );
    const isInTooltip = tooltip && tooltip.contains(target);

    if (!this.container.contains(target) && !isInTooltip) {
      // Only hide if we're showing a tooltip and click is outside both chart and tooltip
      if ((this.container as any).showCandleTooltip) {
        const chartId = (this.container as any)._chartId || "unknown";
        logger.debug(
          `Hiding tooltip for chart ${chartId} due to outside click`,
        );
        (this.container as any).showCandleTooltip = false;
      }
    }
  };

  /**
   * Handle double click on chart area
   */
  handleChartAreaDoubleClick = (event: MouseEvent) => {
    const chartId = (this.container as any)._chartId || "unknown";
    logger.debug(`handleChartAreaDoubleClick called for chart ${chartId}`);

    // Try to find the chart and canvas
    const chart = (this.container as any).renderRoot.querySelector(
      "candlestick-chart",
    ) as any;
    if (!chart || !chart.shadowRoot) {
      logger.debug(`No chart or shadowRoot found for chart ${chartId}`);
      return;
    }

    const canvas = chart.shadowRoot.querySelector("canvas");
    if (!canvas) {
      logger.debug(`No canvas found for chart ${chartId}`);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    // Don't multiply by DPR - our stored positions are in logical pixels
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    logger.debug(`Double-click position for chart ${chartId} - x:`, x, "y:", y);

    // Use the drawing strategy to find candle at position
    if (
      chart.drawingStrategy &&
      typeof chart.drawingStrategy.getCandleAtPosition === "function"
    ) {
      logger.debug(`Drawing strategy available for chart ${chartId}`);
      const candle = chart.drawingStrategy.getCandleAtPosition(x, y);
      logger.debug(
        `Found candle from double-click in chart ${chartId}:`,
        candle,
      );

      if (candle) {
        // Get the chart container's position to convert to relative coordinates
        const containerRect = this.container.getBoundingClientRect();
        (this.container as any).candleTooltipData = {
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top,
        };
        (this.container as any).showCandleTooltip = true;
        logger.debug(`Set showCandleTooltip to true for chart ${chartId}`);
      } else {
        (this.container as any).showCandleTooltip = false;
        logger.debug(`No candle found, hiding tooltip for chart ${chartId}`);
      }
    } else {
      logger.debug(
        `Drawing strategy or getCandleAtPosition not available for chart ${chartId}`,
      );
    }
  };

  /**
   * Handle fullscreen toggle
   */
  handleFullScreenToggle = async (e: Event) => {
    if ((this.container as any).isMobile) return;
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      if (!(this.container as any).isFullscreen) {
        await this.container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      logger.error("Error attempting to toggle fullscreen:", err);
    }
  };

  /**
   * Handle fullscreen change event
   */
  handleFullscreenChange = () => {
    if ((this.container as any).isMobile) return; // Don't handle fullscreen on mobile
    (this.container as any).isFullscreen =
      document.fullscreenElement === this.container;
    if (!(this.container as any).isFullscreen) {
      // Add a small delay to ensure dimensions are properly updated
      setTimeout(() => {
        (this.container as any).handleResize(
          this.container.clientWidth,
          this.container.clientHeight,
        );
      }, 100);
    }
  };

  /**
   * Handle click outside context menu
   */
  handleClickOutside = (e: MouseEvent | TouchEvent) => {
    const target = e.target as HTMLElement;
    const contextMenu = (this.container as any).renderRoot.querySelector(
      "chart-context-menu",
    );
    if (contextMenu && !contextMenu.contains(target)) {
      (this.container as any).showContextMenu = false;
    }
  };

  /**
   * Toggle full window mode
   */
  toggleFullWindow = (e?: Event) => {
    if (e?.defaultPrevented) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    (this.container as any).isFullWindow = !(this.container as any)
      .isFullWindow;
    if ((this.container as any).isFullWindow) {
      this.container.classList.add("full-window");
    } else {
      this.container.classList.remove("full-window");
    }
    // Force a resize after the class change with a small delay
    setTimeout(() => {
      (this.container as any).handleResize(
        this.container.clientWidth,
        this.container.clientHeight,
      );
    }, 100);
  };

  /**
   * Handle trend line update events
   */
  handleTrendLineUpdate = (event: CustomEvent) => {
    logger.debug(`ChartContainer: handleTrendLineUpdate called`, event.detail);
    const { trendLine } = event.detail;
    // Convert Proxy IDs to strings for comparison
    const trendLines = (this.container as any).trendLines;
    const index = trendLines.findIndex(
      (l: any) => String(l.id) === String(trendLine.id),
    );
    logger.debug(
      `ChartContainer: Looking for trend line with ID ${String(trendLine.id)}, found at index: ${index}`,
    );
    if (index !== -1) {
      (this.container as any).trendLines = [
        ...trendLines.slice(0, index),
        trendLine,
        ...trendLines.slice(index + 1),
      ];

      // Update state
      (this.container as any)._state.trendLines = (
        this.container as any
      ).trendLines;
      touch("state.trendLines");

      // Emit API event
      this.container.dispatchEvent(
        new CustomEvent("trend-line-updated", {
          detail: event.detail,
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      logger.warn(
        `ChartContainer: Could not find trend line with ID ${String(trendLine.id)} to update`,
      );
    }
  };

  /**
   * Handle trend line remove events
   */
  handleTrendLineRemove = (event: CustomEvent) => {
    logger.debug(`ChartContainer: handleTrendLineRemove called, event:`, event);
    logger.debug(`ChartContainer: Event detail:`, event.detail);
    logger.debug(`ChartContainer: Event type:`, event.detail?.type);

    const eventDetail = event.detail;
    const trendLine = eventDetail.trendLine || eventDetail;

    if (!trendLine || !trendLine.id) {
      logger.error(
        `ChartContainer: Invalid event detail, cannot find trend line`,
        eventDetail,
      );
      return;
    }

    const lineId = String(trendLine.id);
    logger.debug(`ChartContainer: Removing trend line ${lineId}`);
    const trendLines = (this.container as any).trendLines;
    logger.debug(
      `ChartContainer: Before removal, trendLines:`,
      trendLines.map((l: any) => String(l.id)),
    );

    // Use String conversion for Proxy comparison
    (this.container as any).trendLines = trendLines.filter(
      (l: any) => String(l.id) !== lineId,
    );

    // Update state
    (this.container as any)._state.trendLines = (
      this.container as any
    ).trendLines;
    touch("state.trendLines");

    // Force update to ensure UI reflects the change
    this.container.requestUpdate();

    logger.debug(
      `ChartContainer: After removal, ${(this.container as any).trendLines.length} lines remaining:`,
      (this.container as any).trendLines.map((l: any) => String(l.id)),
    );

    // Emit API event
    this.container.dispatchEvent(
      new CustomEvent("trend-line-removed", {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * Handle pattern click events
   */
  handlePatternClick = (event: CustomEvent) => {
    // Pattern click is already handled by the markers layer itself
    // This is here if we need to do additional processing at the container level
    logger.debug("ChartContainer: Pattern clicked", event.detail);
  };

  /**
   * Handle indicator toggle events
   */
  handleIndicatorToggle = (e: CustomEvent) => {
    const {
      id,
      visible,
      display,
      class: indicatorClass,
      params,
      skipFetch,
      scale,
      name,
      gridStyle,
    } = e.detail;

    logger.debug(
      `ChartContainer: Indicator ${id} toggled to ${
        visible ? "visible" : "hidden"
      }`,
    );

    // Special handling for volume indicator
    if (id === "volume") {
      (this.container as any).showVolume = visible;
      logger.debug(
        `ChartContainer: Volume indicator toggled to ${
          visible ? "visible" : "hidden"
        }`,
      );
      // Force redraw of the volume chart
      const volumeChart = (this.container as any).renderRoot.querySelector(
        ".volume-chart",
      ) as HTMLElement;
      if (volumeChart) {
        volumeChart.hidden = !visible;
        logger.debug(
          `ChartContainer: Volume chart container ${
            visible ? "shown" : "hidden"
          }`,
        );

        // Force a redraw on the volume-chart element
        const volumeChartElement = volumeChart.querySelector("volume-chart");
        if (volumeChartElement) {
          volumeChartElement.dispatchEvent(
            new CustomEvent("force-redraw", {
              bubbles: false,
              composed: true,
            }),
          );
        }
      }

      // Skip adding volume to indicators map - it has special handling
      return;
    }

    const indicators = (this.container as any).indicators;
    if (visible) {
      indicators.set(id, {
        id,
        visible,
        display,
        class: indicatorClass,
        params,
        skipFetch,
        scale,
        name,
        gridStyle,
        ...e.detail,
      });
      // Update state.indicators
      (this.container as any)._state.indicators = Array.from(
        indicators.values(),
      )
        .filter((ind: any) => ind.visible)
        .map((ind: any) => ind);
    } else {
      indicators.delete(id);
      // Update state.indicators
      (this.container as any)._state.indicators = Array.from(
        indicators.values(),
      );
    }

    this.container.requestUpdate();

    // After the DOM updates, ensure all layers (especially live-decorators) are updated
    // with the new chart height after indicators are added/removed
    requestAnimationFrame(() => {
      const layerUpdateCoordinator = (this.container as any)
        .layerUpdateCoordinator;
      if (layerUpdateCoordinator) {
        // Update live-decorators layer with new chart height
        layerUpdateCoordinator.updateLiveDecoratorsLayer();

        // Also update other layers that depend on chart height
        layerUpdateCoordinator.updateAllLayers({
          trendLineLayer: (this.container as any).trendLineLayer,
          patternLabelsLayer: (this.container as any).patternLabelsLayer,
          tradingMarkersLayer: (this.container as any).tradingMarkersLayer,
          priceLinesLayer: (this.container as any).priceLinesLayer,
          tradeZonesLayer: (this.container as any).tradeZonesLayer,
          annotationsLayer: (this.container as any).annotationsLayer,
        });
      }
    });
  };

  /**
   * Show candle tooltip from context menu
   */
  showCandleTooltipFromContextMenu = () => {
    const chart = (this.container as any).chart;
    const contextMenuMousePosition = (this.container as any)
      .contextMenuMousePosition;
    if (!chart || !contextMenuMousePosition) return;

    const chartRect = chart.getBoundingClientRect();
    const x = contextMenuMousePosition.x - chartRect.left;
    const y = contextMenuMousePosition.y - chartRect.top;

    const candle = chart.getCandleAtPosition(x, y);
    if (candle) {
      const containerRect = this.container.getBoundingClientRect();
      (this.container as any).candleTooltipData = {
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        x: contextMenuMousePosition.x - containerRect.left,
        y: contextMenuMousePosition.y - containerRect.top,
      };
      (this.container as any).showCandleTooltip = true;
      (this.container as any).showContextMenu = false;
    }
  };
}
