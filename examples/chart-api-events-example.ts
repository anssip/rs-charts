// examples/chart-api-events-example.ts
import {
  initChartWithApi,
  createChartContainer,
  ChartApi,
  ChartApiEventMap,
  ChartApiEventName,
  ChartApiEventCallback,
  SymbolChangeEvent,
  GranularityChangeEvent,
  IndicatorChangeEvent,
  FullscreenChangeEvent
} from '@anssipiirainen/sc-charts';

/**
 * Example demonstrating type-safe Chart API event handling
 */
class ChartEventHandler {
  private api: ChartApi | null = null;

  async initialize(firebaseConfig: any) {
    const chartContainer = createChartContainer();
    document.body.appendChild(chartContainer);

    const { app, api } = await initChartWithApi(chartContainer, firebaseConfig);
    this.api = api;

    // Setup type-safe event listeners
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.api) return;

    // Type-safe event listeners with specific event data types
    this.api.on('symbolChange', this.handleSymbolChange);
    this.api.on('granularityChange', this.handleGranularityChange);
    this.api.on('indicatorChange', this.handleIndicatorChange);
    this.api.on('fullscreenChange', this.handleFullscreenChange);

    // Generic event handler using the event map
    this.setupGenericEventHandler();
  }

  // Type-safe event handlers with properly typed parameters
  private handleSymbolChange = (data: SymbolChangeEvent) => {
    console.log('Symbol changed:', {
      from: data.oldSymbol,
      to: data.newSymbol,
      willRefetch: data.refetch
    });

    // Update UI or application state
    this.updateSymbolDisplay(data.newSymbol);
  };

  private handleGranularityChange = (data: GranularityChangeEvent) => {
    console.log('Granularity changed:', {
      from: data.oldGranularity,
      to: data.newGranularity,
      willRefetch: data.refetch
    });

    // Update timeframe selector
    this.updateGranularityDisplay(data.newGranularity);
  };

  private handleIndicatorChange = (data: IndicatorChangeEvent) => {
    console.log('Indicator changed:', {
      action: data.action,
      indicatorId: data.indicatorId || data.indicator?.id,
      indicatorName: data.indicator?.name
    });

    // Update indicator panel
    if (data.action === 'show' && data.indicator) {
      this.showIndicatorInPanel(data.indicator);
    } else if (data.action === 'hide' && data.indicatorId) {
      this.hideIndicatorInPanel(data.indicatorId);
    }
  };

  private handleFullscreenChange = (data: FullscreenChangeEvent) => {
    console.log('Fullscreen state changed:', {
      type: data.type,
      isFullscreen: data.isFullscreen,
      isFullWindow: data.isFullWindow
    });

    // Update UI controls
    if (data.type === 'fullscreen') {
      this.updateFullscreenButton(data.isFullscreen || false);
    } else if (data.type === 'fullwindow') {
      this.updateFullWindowButton(data.isFullWindow || false);
    }
  };

  // Example of a generic event handler using the event map
  private setupGenericEventHandler() {
    if (!this.api) return;

    // This demonstrates how you can create generic event handling functions
    const createEventLogger = <T extends ChartApiEventName>(
      eventName: T
    ): ChartApiEventCallback<T> => {
      return (data: ChartApiEventMap[T]) => {
        console.log(`[${eventName}] Event fired:`, data);
        
        // Log to analytics or external systems
        this.logEventToAnalytics(eventName, data);
      };
    };

    // Add generic loggers for all events
    this.api.on('symbolChange', createEventLogger('symbolChange'));
    this.api.on('granularityChange', createEventLogger('granularityChange'));
    this.api.on('indicatorChange', createEventLogger('indicatorChange'));
    this.api.on('fullscreenChange', createEventLogger('fullscreenChange'));
  }

  // Example UI update methods
  private updateSymbolDisplay(symbol: string) {
    const symbolElement = document.getElementById('current-symbol');
    if (symbolElement) {
      symbolElement.textContent = symbol;
    }
  }

  private updateGranularityDisplay(granularity: string) {
    const granularityElement = document.getElementById('current-granularity');
    if (granularityElement) {
      granularityElement.textContent = granularity;
    }
  }

  private showIndicatorInPanel(indicator: any) {
    const panel = document.getElementById('indicators-panel');
    if (panel) {
      const indicatorElement = document.createElement('div');
      indicatorElement.id = `indicator-${indicator.id}`;
      indicatorElement.textContent = `${indicator.name} (Active)`;
      panel.appendChild(indicatorElement);
    }
  }

  private hideIndicatorInPanel(indicatorId: string) {
    const indicatorElement = document.getElementById(`indicator-${indicatorId}`);
    if (indicatorElement) {
      indicatorElement.remove();
    }
  }

  private updateFullscreenButton(isFullscreen: boolean) {
    const button = document.getElementById('fullscreen-button');
    if (button) {
      button.textContent = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }
  }

  private updateFullWindowButton(isFullWindow: boolean) {
    const button = document.getElementById('fullwindow-button');
    if (button) {
      button.textContent = isFullWindow ? 'Exit Full Window' : 'Enter Full Window';
    }
  }

  private logEventToAnalytics(eventName: string, data: any) {
    // Example analytics logging
    console.log(`Analytics: ${eventName}`, data);
    
    // In a real application, you might send this to Google Analytics, Mixpanel, etc.
    // analytics.track(eventName, data);
  }

  // Example of removing event listeners with proper typing
  cleanup() {
    if (!this.api) return;

    // Remove specific event listeners
    this.api.off('symbolChange', this.handleSymbolChange);
    this.api.off('granularityChange', this.handleGranularityChange);
    this.api.off('indicatorChange', this.handleIndicatorChange);
    this.api.off('fullscreenChange', this.handleFullscreenChange);

    // Dispose the API
    this.api.dispose();
  }
}

// Example usage in a React-like component
export class TypedChartComponent {
  private eventHandler: ChartEventHandler;
  private api: ChartApi | null = null;

  constructor() {
    this.eventHandler = new ChartEventHandler();
  }

  async mount(firebaseConfig: any) {
    await this.eventHandler.initialize(firebaseConfig);
  }

  unmount() {
    this.eventHandler.cleanup();
  }

  // Example methods that use the API with type safety
  async changeSymbol(symbol: string) {
    if (!this.api) return;
    
    // The API methods return properly typed promises
    await this.api.setSymbol({
      symbol,
      refetch: true
    });
  }

  async changeGranularity(granularity: any) {
    if (!this.api) return;
    
    await this.api.setGranularity({
      granularity,
      refetch: false
    });
  }

  toggleIndicator(indicatorId: string) {
    if (!this.api) return;
    
    this.api.toggleIndicator(indicatorId, {
      name: indicatorId.toUpperCase()
    });
  }
}

// Example for framework integrations
export interface ChartEventHandlers {
  onSymbolChange?: (data: SymbolChangeEvent) => void;
  onGranularityChange?: (data: GranularityChangeEvent) => void;
  onIndicatorChange?: (data: IndicatorChangeEvent) => void;
  onFullscreenChange?: (data: FullscreenChangeEvent) => void;
}

/**
 * Helper function to setup event handlers with type safety
 */
export function setupChartEventHandlers(api: ChartApi, handlers: ChartEventHandlers) {
  if (handlers.onSymbolChange) {
    api.on('symbolChange', handlers.onSymbolChange);
  }
  
  if (handlers.onGranularityChange) {
    api.on('granularityChange', handlers.onGranularityChange);
  }
  
  if (handlers.onIndicatorChange) {
    api.on('indicatorChange', handlers.onIndicatorChange);
  }
  
  if (handlers.onFullscreenChange) {
    api.on('fullscreenChange', handlers.onFullscreenChange);
  }
}

// Export the handler class for use in other files
export { ChartEventHandler };