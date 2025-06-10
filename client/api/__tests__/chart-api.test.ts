// client/api/__tests__/chart-api.test.ts
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { ChartApi, createChartApi } from "../chart-api";
import { ChartContainer } from "../../components/chart/chart-container";
import { App } from "../../app";
import { ChartState } from "../../index";
import { PriceRangeImpl } from "../../util/price-range";
import { SimplePriceHistory } from "../../../server/services/price-data/price-history-model";

// Mock document for fullscreen tests
const mockDocument = {
  fullscreenElement: null as any,
  exitFullscreen: mock(() => Promise.resolve()),
};

// Mock dependencies
const mockChartContainer = {
  isIndicatorVisible: mock(() => false),
  handleIndicatorToggle: mock(() => {}),
  classList: {
    contains: mock(() => false),
    add: mock(() => {}),
    remove: mock(() => {}),
  },
  requestFullscreen: mock(() => Promise.resolve()),
  draw: mock(() => {}),
} as unknown as ChartContainer;

let mockState: ChartState;

const createMockState = (): ChartState => ({
  priceRange: new PriceRangeImpl(0, 100),
  priceHistory: new SimplePriceHistory("ONE_HOUR", new Map()),
  timeRange: { start: 0, end: 0 },
  liveCandle: null,
  canvasWidth: 0,
  canvasHeight: 0,
  symbol: "BTC-USD",
  granularity: "ONE_HOUR",
  loading: false,
  indicators: [],
});

const mockApp = {
  getState: mock(() => mockState),
  cleanup: mock(() => {}),
} as unknown as App;

describe("ChartApi", () => {
  let api: ChartApi;

  beforeEach(() => {
    // Reset state
    mockState = createMockState();
    
    // Reset all mocks
    mockChartContainer.isIndicatorVisible = mock(() => false);
    mockChartContainer.handleIndicatorToggle = mock(() => {});
    mockChartContainer.classList.contains = mock(() => false);
    mockChartContainer.classList.add = mock(() => {});
    mockChartContainer.classList.remove = mock(() => {});
    mockChartContainer.requestFullscreen = mock(() => Promise.resolve());
    mockChartContainer.draw = mock(() => {});
    mockApp.getState = mock(() => mockState);
    mockApp.cleanup = mock(() => {});
    
    // Reset document mock
    mockDocument.fullscreenElement = null;
    mockDocument.exitFullscreen = mock(() => Promise.resolve());
    
    // Mock global document
    (globalThis as any).document = mockDocument;

    // Create API instance
    api = createChartApi(mockChartContainer, mockApp);
  });

  afterEach(() => {
    api.dispose();
  });

  describe("Symbol Control", () => {
    test("getSymbol returns current symbol", () => {
      expect(api.getSymbol()).toBe("BTC-USD");
    });

    test("setSymbol changes symbol with string parameter", async () => {
      await api.setSymbol("ETH-USD");
      expect(mockState.symbol).toBe("ETH-USD");
    });

    test("setSymbol changes symbol with options object", async () => {
      await api.setSymbol({
        symbol: "SOL-USD",
        refetch: false,
      });
      expect(mockState.symbol).toBe("SOL-USD");
    });

    test("setSymbol emits symbolChange event", async () => {
      let eventData: any = null;
      const eventHandler = mock((data: any) => {
        eventData = data;
      });
      api.on("symbolChange", eventHandler);

      await api.setSymbol("ETH-USD");

      expect(eventHandler).toHaveBeenCalled();
      expect(eventData).toEqual({
        oldSymbol: "BTC-USD",
        newSymbol: "ETH-USD",
        refetch: true,
      });
    });
  });

  describe("Granularity Control", () => {
    test("getGranularity returns current granularity", () => {
      expect(api.getGranularity()).toBe("ONE_HOUR");
    });

    test("getAvailableGranularities returns all granularities", () => {
      const granularities = api.getAvailableGranularities();
      expect(granularities).toContain("ONE_MINUTE");
      expect(granularities).toContain("ONE_HOUR");
      expect(granularities).toContain("ONE_DAY");
    });

    test("setGranularity changes granularity with string parameter", async () => {
      await api.setGranularity("ONE_DAY");
      expect(mockState.granularity).toBe("ONE_DAY");
    });

    test("setGranularity changes granularity with options object", async () => {
      await api.setGranularity({
        granularity: "FIVE_MINUTE",
        refetch: false,
      });
      expect(mockState.granularity).toBe("FIVE_MINUTE");
    });

    test("setGranularity emits granularityChange event", async () => {
      let eventData: any = null;
      const eventHandler = mock((data: any) => {
        eventData = data;
      });
      api.on("granularityChange", eventHandler);

      await api.setGranularity("ONE_DAY");

      expect(eventHandler).toHaveBeenCalled();
      expect(eventData).toEqual({
        oldGranularity: "ONE_HOUR",
        newGranularity: "ONE_DAY",
        refetch: true,
      });
    });
  });

  describe("Indicator Control", () => {
    test("getVisibleIndicators returns current indicators", () => {
      mockState.indicators = [
        { id: "rsi", name: "RSI", visible: true },
      ] as any;
      expect(api.getVisibleIndicators()).toEqual([
        { id: "rsi", name: "RSI", visible: true },
      ]);
    });

    test("isIndicatorVisible checks container", () => {
      mockChartContainer.isIndicatorVisible = mock(() => true);
      expect(api.isIndicatorVisible("volume")).toBe(true);
      expect(mockChartContainer.isIndicatorVisible).toHaveBeenCalled();
    });

    test("showIndicator calls container handleIndicatorToggle", () => {
      const config = {
        id: "rsi",
        name: "RSI",
        visible: true,
      };

      api.showIndicator(config);

      expect(mockChartContainer.handleIndicatorToggle).toHaveBeenCalled();
      // Verify the call was made with a CustomEvent containing the config
      const calls = (mockChartContainer.handleIndicatorToggle as any).mock.calls;
      expect(calls.length).toBe(1);
      const event = calls[0][0];
      expect(event.detail.id).toBe("rsi");
      expect(event.detail.name).toBe("RSI");
      expect(event.detail.visible).toBe(true);
    });

    test("hideIndicator calls container handleIndicatorToggle", () => {
      api.hideIndicator("rsi");

      expect(mockChartContainer.handleIndicatorToggle).toHaveBeenCalled();
      const calls = (mockChartContainer.handleIndicatorToggle as any).mock.calls;
      expect(calls.length).toBe(1);
      const event = calls[0][0];
      expect(event.detail.id).toBe("rsi");
      expect(event.detail.visible).toBe(false);
    });

    test("toggleIndicator shows indicator when not visible", () => {
      mockChartContainer.isIndicatorVisible = mock(() => false);

      api.toggleIndicator("rsi", { name: "RSI" });

      expect(mockChartContainer.handleIndicatorToggle).toHaveBeenCalled();
      const calls = (mockChartContainer.handleIndicatorToggle as any).mock.calls;
      expect(calls.length).toBe(1);
      const event = calls[0][0];
      expect(event.detail.id).toBe("rsi");
      expect(event.detail.name).toBe("RSI");
      expect(event.detail.visible).toBe(true);
    });

    test("toggleIndicator hides indicator when visible", () => {
      mockChartContainer.isIndicatorVisible = mock(() => true);

      api.toggleIndicator("rsi");

      expect(mockChartContainer.handleIndicatorToggle).toHaveBeenCalled();
      const calls = (mockChartContainer.handleIndicatorToggle as any).mock.calls;
      expect(calls.length).toBe(1);
      const event = calls[0][0];
      expect(event.detail.id).toBe("rsi");
      expect(event.detail.visible).toBe(false);
    });
  });

  describe("Fullscreen Control", () => {
    test("isFullscreen checks document.fullscreenElement", () => {
      // Test fullscreen state
      mockDocument.fullscreenElement = mockChartContainer;
      expect(api.isFullscreen()).toBe(true);

      mockDocument.fullscreenElement = null;
      expect(api.isFullscreen()).toBe(false);
    });

    test("enterFullscreen calls requestFullscreen", async () => {
      mockDocument.fullscreenElement = null;

      await api.enterFullscreen();

      expect(mockChartContainer.requestFullscreen).toHaveBeenCalled();
    });

    test("enterFullscreen does nothing if already fullscreen", async () => {
      mockDocument.fullscreenElement = mockChartContainer;

      await api.enterFullscreen();

      expect(mockChartContainer.requestFullscreen).not.toHaveBeenCalled();
    });

    test("exitFullscreen calls document.exitFullscreen", async () => {
      mockDocument.fullscreenElement = mockChartContainer;

      await api.exitFullscreen();

      expect(mockDocument.exitFullscreen).toHaveBeenCalled();
    });
  });

  describe("Full Window Control", () => {
    test("isFullWindow checks container classList", () => {
      mockChartContainer.classList.contains = mock(() => true);
      expect(api.isFullWindow()).toBe(true);
      expect(mockChartContainer.classList.contains).toHaveBeenCalled();
    });

    test("enterFullWindow adds class", () => {
      mockChartContainer.classList.contains = mock(() => false);

      api.enterFullWindow();

      expect(mockChartContainer.classList.add).toHaveBeenCalled();
    });

    test("exitFullWindow removes class", () => {
      mockChartContainer.classList.contains = mock(() => true);

      api.exitFullWindow();

      expect(mockChartContainer.classList.remove).toHaveBeenCalled();
    });

    test("toggleFullWindow toggles class", () => {
      mockChartContainer.classList.contains = mock(() => false);

      api.toggleFullWindow();

      expect(mockChartContainer.classList.add).toHaveBeenCalled();
    });
  });

  describe("State & Utility", () => {
    test("getState returns app state", () => {
      expect(api.getState()).toBe(mockState);
    });

    test("isLoading returns loading state", () => {
      mockState.loading = true;
      expect(api.isLoading()).toBe(true);

      mockState.loading = false;
      expect(api.isLoading()).toBe(false);
    });

    test("redraw calls container draw", () => {
      api.redraw();
      expect(mockChartContainer.draw).toHaveBeenCalled();
    });

    test("getContainer returns container", () => {
      expect(api.getContainer()).toBe(mockChartContainer);
    });

    test("getApp returns app", () => {
      expect(api.getApp()).toBe(mockApp);
    });
  });

  describe("Event System", () => {
    test("on adds event listener", () => {
      let receivedData: any = null;
      const handler = mock((data: any) => {
        receivedData = data;
      });
      api.on("symbolChange", handler);

      // Simulate event emission
      (api as any).emitEvent("symbolChange", { test: "data" });

      expect(handler).toHaveBeenCalled();
      expect(receivedData).toEqual({ test: "data" });
    });

    test("off removes event listener", () => {
      const handler = mock(() => {});
      api.on("symbolChange", handler);
      api.off("symbolChange", handler);

      // Simulate event emission
      (api as any).emitEvent("symbolChange", { test: "data" });

      expect(handler).not.toHaveBeenCalled();
    });

    test("event handler errors are caught", () => {
      const handler = mock(() => {
        throw new Error("Test error");
      });
      api.on("symbolChange", handler);

      // Should not throw
      expect(() => {
        (api as any).emitEvent("symbolChange", { test: "data" });
      }).not.toThrow();
    });
  });

  describe("Cleanup", () => {
    test("dispose clears event listeners", () => {
      const handler = mock(() => {});
      api.on("symbolChange", handler);

      api.dispose();

      // Simulate event emission after disposal
      (api as any).emitEvent("symbolChange", { test: "data" });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe("createChartApi", () => {
  test("creates ChartApi instance", () => {
    const api = createChartApi(mockChartContainer, mockApp);
    expect(api).toBeInstanceOf(ChartApi);
    api.dispose();
  });
});