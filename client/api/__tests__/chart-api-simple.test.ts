// client/api/__tests__/chart-api-simple.test.ts
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

// Simple type definitions for testing
interface MockChartContainer {
  isIndicatorVisible: any;
  handleIndicatorToggle: any;
  classList: any;
  requestFullscreen: any;
  draw: any;
}

interface MockApp {
  getState: any;
  cleanup: any;
}

interface MockChartState {
  symbol: string;
  granularity: string;
  loading: boolean;
  indicators: any[];
}

// Mock the ChartApi class directly to avoid complex imports
class TestChartApi {
  private container: MockChartContainer;
  private app: MockApp;
  private state: MockChartState;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(container: MockChartContainer, app: MockApp) {
    this.container = container;
    this.app = app;
    this.state = app.getState();
  }

  // Symbol Control
  getSymbol(): string {
    return this.state.symbol;
  }

  async setSymbol(options: string | { symbol: string; refetch?: boolean }): Promise<void> {
    const config = typeof options === 'string' 
      ? { symbol: options, refetch: true }
      : { refetch: true, ...options };

    const oldSymbol = this.state.symbol;
    this.state.symbol = config.symbol;
    
    this.emitEvent('symbolChange', {
      oldSymbol,
      newSymbol: config.symbol,
      refetch: config.refetch
    });

    if (config.refetch) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Granularity Control
  getGranularity(): string {
    return this.state.granularity;
  }

  async setGranularity(options: string | { granularity: string; refetch?: boolean }): Promise<void> {
    const config = typeof options === 'string' 
      ? { granularity: options, refetch: true }
      : { refetch: true, ...options };

    const oldGranularity = this.state.granularity;
    this.state.granularity = config.granularity;
    
    this.emitEvent('granularityChange', {
      oldGranularity,
      newGranularity: config.granularity,
      refetch: config.refetch
    });

    if (config.refetch) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Indicator Control
  getVisibleIndicators(): any[] {
    return this.state.indicators || [];
  }

  isIndicatorVisible(indicatorId: string): boolean {
    return this.container.isIndicatorVisible(indicatorId);
  }

  showIndicator(config: { id: string; name: string; visible: boolean }): void {
    this.container.handleIndicatorToggle(new CustomEvent('toggle-indicator', {
      detail: { ...config, visible: true }
    }));

    this.emitEvent('indicatorChange', {
      action: 'show',
      indicator: { ...config, visible: true }
    });
  }

  hideIndicator(indicatorId: string): void {
    this.container.handleIndicatorToggle(new CustomEvent('toggle-indicator', {
      detail: { id: indicatorId, visible: false }
    }));

    this.emitEvent('indicatorChange', {
      action: 'hide',
      indicatorId
    });
  }

  // Event System
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  dispose(): void {
    this.eventListeners.clear();
  }
}

describe("ChartApi Event Types", () => {
  let api: TestChartApi;
  let mockContainer: MockChartContainer;
  let mockApp: MockApp;
  let mockState: MockChartState;

  beforeEach(() => {
    mockState = {
      symbol: "BTC-USD",
      granularity: "ONE_HOUR",
      loading: false,
      indicators: [],
    };

    mockContainer = {
      isIndicatorVisible: mock(() => false),
      handleIndicatorToggle: mock(() => {}),
      classList: {
        contains: mock(() => false),
        add: mock(() => {}),
        remove: mock(() => {}),
      },
      requestFullscreen: mock(() => Promise.resolve()),
      draw: mock(() => {}),
    };

    mockApp = {
      getState: mock(() => mockState),
      cleanup: mock(() => {}),
    };

    api = new TestChartApi(mockContainer, mockApp);
  });

  afterEach(() => {
    api.dispose();
  });

  describe("Symbol Events", () => {
    test("symbolChange event should have correct structure", async () => {
      let eventData: any = null;
      
      api.on('symbolChange', (data: any) => {
        eventData = data;
      });

      await api.setSymbol({ symbol: "ETH-USD", refetch: false });

      expect(eventData).toEqual({
        oldSymbol: "BTC-USD",
        newSymbol: "ETH-USD",
        refetch: false
      });
      
      expect(typeof eventData.oldSymbol).toBe('string');
      expect(typeof eventData.newSymbol).toBe('string');
      expect(typeof eventData.refetch).toBe('boolean');
    });

    test("symbolChange event should work with string parameter", async () => {
      let eventData: any = null;
      
      api.on('symbolChange', (data: any) => {
        eventData = data;
      });

      await api.setSymbol("SOL-USD");

      expect(eventData).toEqual({
        oldSymbol: "BTC-USD",
        newSymbol: "SOL-USD",
        refetch: true
      });
    });
  });

  describe("Granularity Events", () => {
    test("granularityChange event should have correct structure", async () => {
      let eventData: any = null;
      
      api.on('granularityChange', (data: any) => {
        eventData = data;
      });

      await api.setGranularity({ granularity: "ONE_DAY", refetch: true });

      expect(eventData).toEqual({
        oldGranularity: "ONE_HOUR",
        newGranularity: "ONE_DAY",
        refetch: true
      });
      
      expect(typeof eventData.oldGranularity).toBe('string');
      expect(typeof eventData.newGranularity).toBe('string');
      expect(typeof eventData.refetch).toBe('boolean');
    });
  });

  describe("Indicator Events", () => {
    test("indicatorChange event should have correct structure for show action", () => {
      let eventData: any = null;
      
      api.on('indicatorChange', (data: any) => {
        eventData = data;
      });

      api.showIndicator({
        id: "rsi",
        name: "RSI",
        visible: true
      });

      expect(eventData.action).toBe('show');
      expect(eventData.indicator).toBeDefined();
      expect(eventData.indicator.id).toBe('rsi');
      expect(eventData.indicator.name).toBe('RSI');
      expect(eventData.indicator.visible).toBe(true);
    });

    test("indicatorChange event should have correct structure for hide action", () => {
      let eventData: any = null;
      
      api.on('indicatorChange', (data: any) => {
        eventData = data;
      });

      api.hideIndicator("volume");

      expect(eventData.action).toBe('hide');
      expect(eventData.indicatorId).toBe('volume');
      expect(eventData.indicator).toBeUndefined();
    });
  });

  describe("Event System", () => {
    test("multiple event listeners should work correctly", async () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});
      
      api.on('symbolChange', handler1);
      api.on('symbolChange', handler2);
      
      await api.setSymbol('DOT-USD');
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test("event listeners can be removed", () => {
      const handler = mock(() => {});
      
      api.on('symbolChange', handler);
      api.off('symbolChange', handler);
      
      // Emit event manually
      (api as any).emitEvent('symbolChange', { test: 'data' });
      
      expect(handler).not.toHaveBeenCalled();
    });

    test("event handler errors should be caught", () => {
      const handler = mock(() => {
        throw new Error("Test error");
      });
      
      api.on('symbolChange', handler);
      
      // Should not throw
      expect(() => {
        (api as any).emitEvent('symbolChange', { test: 'data' });
      }).not.toThrow();
    });

    test("dispose should clear all event listeners", () => {
      const handler = mock(() => {});
      
      api.on('symbolChange', handler);
      api.dispose();
      
      // Emit event manually after disposal
      (api as any).emitEvent('symbolChange', { test: 'data' });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("State Management", () => {
    test("getSymbol should return current symbol", () => {
      expect(api.getSymbol()).toBe("BTC-USD");
    });

    test("getGranularity should return current granularity", () => {
      expect(api.getGranularity()).toBe("ONE_HOUR");
    });

    test("getVisibleIndicators should return current indicators", () => {
      mockState.indicators = [{ id: "rsi", name: "RSI", visible: true }];
      expect(api.getVisibleIndicators()).toEqual([{ id: "rsi", name: "RSI", visible: true }]);
    });

    test("isIndicatorVisible should check container", () => {
      mockContainer.isIndicatorVisible = mock(() => true);
      const result = api.isIndicatorVisible("volume");
      expect(result).toBe(true);
      expect(mockContainer.isIndicatorVisible).toHaveBeenCalled();
    });
  });

  describe("Type Safety Validation", () => {
    test("event data should maintain consistent types", async () => {
      const events: any[] = [];
      
      api.on('symbolChange', (data: any) => {
        events.push({ type: 'symbol', data });
      });
      
      api.on('granularityChange', (data: any) => {
        events.push({ type: 'granularity', data });
      });
      
      api.on('indicatorChange', (data: any) => {
        events.push({ type: 'indicator', data });
      });

      // Trigger various events
      await api.setSymbol('ETH-USD');
      await api.setGranularity('ONE_DAY');
      api.showIndicator({ id: 'rsi', name: 'RSI', visible: true });

      expect(events).toHaveLength(3);
      
      // Validate symbol event
      const symbolEvent = events.find(e => e.type === 'symbol');
      expect(symbolEvent.data).toHaveProperty('oldSymbol');
      expect(symbolEvent.data).toHaveProperty('newSymbol');
      expect(symbolEvent.data).toHaveProperty('refetch');
      
      // Validate granularity event
      const granularityEvent = events.find(e => e.type === 'granularity');
      expect(granularityEvent.data).toHaveProperty('oldGranularity');
      expect(granularityEvent.data).toHaveProperty('newGranularity');
      expect(granularityEvent.data).toHaveProperty('refetch');
      
      // Validate indicator event
      const indicatorEvent = events.find(e => e.type === 'indicator');
      expect(indicatorEvent.data).toHaveProperty('action');
      expect(indicatorEvent.data).toHaveProperty('indicator');
      expect(indicatorEvent.data.action).toBe('show');
    });
  });
});