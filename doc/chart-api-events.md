# Chart API Events Documentation

This document provides comprehensive documentation for the type-safe event system in the Rekt Sense Charts API.

## Overview

The Chart API provides a robust, type-safe event system that allows external applications to monitor and react to chart state changes. All events are fully typed using TypeScript interfaces, providing excellent developer experience with IntelliSense support and compile-time type checking.

## Event Types

### Import Event Types

```typescript
import {
  ChartApiEventMap,
  ChartApiEventName,
  ChartApiEventCallback,
  SymbolChangeEvent,
  GranularityChangeEvent,
  IndicatorChangeEvent,
  FullscreenChangeEvent
} from '@anssipiirainen/sc-charts';
```

## Event Definitions

### `symbolChange`

Fired when the trading pair symbol changes (e.g., from BTC-USD to ETH-USD).

```typescript
interface SymbolChangeEvent {
  oldSymbol: string;        // Previous trading pair symbol
  newSymbol: string;        // New trading pair symbol
  refetch: boolean;         // Whether price data will be refetched
}
```

**Example:**
```typescript
api.on('symbolChange', (data: SymbolChangeEvent) => {
  console.log(`Symbol changed from ${data.oldSymbol} to ${data.newSymbol}`);
  if (data.refetch) {
    showLoadingIndicator();
  }
  updateSymbolInUI(data.newSymbol);
});
```

### `granularityChange`

Fired when the chart timeframe/granularity changes (e.g., from 1H to 1D).

```typescript
interface GranularityChangeEvent {
  oldGranularity: Granularity;    // Previous timeframe
  newGranularity: Granularity;    // New timeframe
  refetch: boolean;               // Whether price data will be refetched
}
```

**Example:**
```typescript
api.on('granularityChange', (data: GranularityChangeEvent) => {
  console.log(`Timeframe changed from ${data.oldGranularity} to ${data.newGranularity}`);
  updateTimeframeSelector(data.newGranularity);
  
  if (data.refetch) {
    showDataRefreshMessage();
  }
});
```

### `indicatorChange`

Fired when technical indicators are shown, hidden, or toggled.

```typescript
interface IndicatorChangeEvent {
  action: 'show' | 'hide';            // Action performed on the indicator
  indicator?: ApiIndicatorConfig;      // Full indicator config (when showing)
  indicatorId?: string;               // Indicator ID (when hiding)
}
```

**Example:**
```typescript
api.on('indicatorChange', (data: IndicatorChangeEvent) => {
  if (data.action === 'show' && data.indicator) {
    console.log(`Showing indicator: ${data.indicator.name}`);
    addIndicatorToPanel(data.indicator);
  } else if (data.action === 'hide' && data.indicatorId) {
    console.log(`Hiding indicator: ${data.indicatorId}`);
    removeIndicatorFromPanel(data.indicatorId);
  }
});
```

### `fullscreenChange`

Fired when fullscreen or full window mode changes.

```typescript
interface FullscreenChangeEvent {
  isFullscreen?: boolean;             // True if in browser fullscreen mode
  isFullWindow?: boolean;             // True if in full window mode
  type: 'fullscreen' | 'fullwindow';  // Which display mode changed
}
```

**Example:**
```typescript
api.on('fullscreenChange', (data: FullscreenChangeEvent) => {
  if (data.type === 'fullscreen') {
    console.log(`Fullscreen: ${data.isFullscreen ? 'Entered' : 'Exited'}`);
    updateFullscreenButton(data.isFullscreen || false);
  } else if (data.type === 'fullwindow') {
    console.log(`Full Window: ${data.isFullWindow ? 'Entered' : 'Exited'}`);
    updateFullWindowButton(data.isFullWindow || false);
  }
});
```

## Type-Safe Event Handling

### Basic Usage

```typescript
import { ChartApi, SymbolChangeEvent } from '@anssipiirainen/sc-charts';

// Type-safe event listener
api.on('symbolChange', (data: SymbolChangeEvent) => {
  // TypeScript knows the exact shape of 'data'
  console.log(data.oldSymbol);  // ✅ Type: string
  console.log(data.newSymbol);  // ✅ Type: string
  console.log(data.refetch);    // ✅ Type: boolean
});
```

### Generic Event Handlers

You can create generic event handlers using the event map:

```typescript
import { ChartApiEventMap, ChartApiEventName, ChartApiEventCallback } from '@anssipiirainen/sc-charts';

// Generic event logger
function createEventLogger<T extends ChartApiEventName>(
  eventName: T
): ChartApiEventCallback<T> {
  return (data: ChartApiEventMap[T]) => {
    console.log(`[${eventName}]`, data);
    
    // Send to analytics
    analytics.track(eventName, data);
  };
}

// Use the generic logger
api.on('symbolChange', createEventLogger('symbolChange'));
api.on('granularityChange', createEventLogger('granularityChange'));
```

### Event Handler Interface

For framework integrations, you can define handler interfaces:

```typescript
interface ChartEventHandlers {
  onSymbolChange?: (data: SymbolChangeEvent) => void;
  onGranularityChange?: (data: GranularityChangeEvent) => void;
  onIndicatorChange?: (data: IndicatorChangeEvent) => void;
  onFullscreenChange?: (data: FullscreenChangeEvent) => void;
}

function setupEventHandlers(api: ChartApi, handlers: ChartEventHandlers) {
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
```

## Framework Integration Examples

### React

```tsx
import React, { useEffect, useState } from 'react';
import { ChartApi, SymbolChangeEvent } from '@anssipiirainen/sc-charts';

interface ChartEventProps {
  api: ChartApi;
}

const ChartEventHandler: React.FC<ChartEventProps> = ({ api }) => {
  const [currentSymbol, setCurrentSymbol] = useState<string>('');

  useEffect(() => {
    const handleSymbolChange = (data: SymbolChangeEvent) => {
      setCurrentSymbol(data.newSymbol);
    };

    api.on('symbolChange', handleSymbolChange);

    return () => {
      api.off('symbolChange', handleSymbolChange);
    };
  }, [api]);

  return <div>Current Symbol: {currentSymbol}</div>;
};
```

### Vue.js

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { ChartApi, GranularityChangeEvent } from '@anssipiirainen/sc-charts';

export function useChartEvents(api: ChartApi) {
  const currentGranularity = ref<string>('');

  const handleGranularityChange = (data: GranularityChangeEvent) => {
    currentGranularity.value = data.newGranularity;
  };

  onMounted(() => {
    api.on('granularityChange', handleGranularityChange);
  });

  onUnmounted(() => {
    api.off('granularityChange', handleGranularityChange);
  });

  return {
    currentGranularity
  };
}
```

### Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ChartApi, IndicatorChangeEvent } from '@anssipiirainen/sc-charts';

@Component({
  selector: 'app-chart-indicators',
  template: `<div>Active Indicators: {{ activeIndicators.join(', ') }}</div>`
})
export class ChartIndicatorsComponent implements OnInit, OnDestroy {
  activeIndicators: string[] = [];

  constructor(private api: ChartApi) {}

  ngOnInit() {
    this.api.on('indicatorChange', this.handleIndicatorChange);
  }

  ngOnDestroy() {
    this.api.off('indicatorChange', this.handleIndicatorChange);
  }

  private handleIndicatorChange = (data: IndicatorChangeEvent) => {
    if (data.action === 'show' && data.indicator) {
      this.activeIndicators.push(data.indicator.name);
    } else if (data.action === 'hide' && data.indicatorId) {
      this.activeIndicators = this.activeIndicators.filter(
        name => name !== data.indicatorId
      );
    }
  };
}
```

## Best Practices

### 1. Always Remove Event Listeners

```typescript
// ✅ Good: Remove listeners when component unmounts
useEffect(() => {
  const handler = (data: SymbolChangeEvent) => {
    // Handle event
  };
  
  api.on('symbolChange', handler);
  
  return () => {
    api.off('symbolChange', handler); // Cleanup
  };
}, []);
```

### 2. Use Type Annotations

```typescript
// ✅ Good: Explicit type annotation
const handler: ChartApiEventCallback<'symbolChange'> = (data) => {
  // TypeScript knows 'data' is SymbolChangeEvent
};

// ❌ Avoid: Generic callback without typing
const handler = (data: any) => {
  // No type safety
};
```

### 3. Handle Errors Gracefully

```typescript
api.on('symbolChange', (data: SymbolChangeEvent) => {
  try {
    updateUI(data.newSymbol);
  } catch (error) {
    console.error('Error handling symbol change:', error);
    // Fallback behavior
  }
});
```

### 4. Debounce Rapid Events

```typescript
import { debounce } from 'lodash';

const debouncedHandler = debounce((data: SymbolChangeEvent) => {
  expensiveOperation(data.newSymbol);
}, 300);

api.on('symbolChange', debouncedHandler);
```

## Error Handling

The Chart API handles event listener errors gracefully:

```typescript
api.on('symbolChange', (data) => {
  throw new Error('Handler error'); // Won't crash the application
});

// Other event listeners will still work
api.on('symbolChange', (data) => {
  console.log('This handler still works');
});
```

## Complete Example

```typescript
import {
  initChartWithApi,
  createChartContainer,
  ChartApi,
  SymbolChangeEvent,
  GranularityChangeEvent,
  IndicatorChangeEvent,
  FullscreenChangeEvent
} from '@anssipiirainen/sc-charts';

class TradingDashboard {
  private api: ChartApi | null = null;
  private currentState = {
    symbol: '',
    granularity: '',
    activeIndicators: [] as string[],
    isFullscreen: false
  };

  async initialize(firebaseConfig: any) {
    const container = createChartContainer();
    document.body.appendChild(container);

    const { app, api } = await initChartWithApi(container, firebaseConfig);
    this.api = api;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.api) return;

    // Symbol changes
    this.api.on('symbolChange', (data: SymbolChangeEvent) => {
      this.currentState.symbol = data.newSymbol;
      this.updateSymbolDisplay(data.newSymbol);
      
      if (data.refetch) {
        this.showLoadingIndicator();
      }
    });

    // Granularity changes
    this.api.on('granularityChange', (data: GranularityChangeEvent) => {
      this.currentState.granularity = data.newGranularity;
      this.updateGranularityDisplay(data.newGranularity);
    });

    // Indicator changes
    this.api.on('indicatorChange', (data: IndicatorChangeEvent) => {
      if (data.action === 'show' && data.indicator) {
        this.currentState.activeIndicators.push(data.indicator.id);
      } else if (data.action === 'hide' && data.indicatorId) {
        this.currentState.activeIndicators = this.currentState.activeIndicators
          .filter(id => id !== data.indicatorId);
      }
      this.updateIndicatorPanel();
    });

    // Fullscreen changes
    this.api.on('fullscreenChange', (data: FullscreenChangeEvent) => {
      this.currentState.isFullscreen = data.isFullscreen || data.isFullWindow || false;
      this.updateFullscreenControls();
    });
  }

  private updateSymbolDisplay(symbol: string) {
    const element = document.getElementById('symbol-display');
    if (element) element.textContent = symbol;
  }

  private updateGranularityDisplay(granularity: string) {
    const element = document.getElementById('granularity-display');
    if (element) element.textContent = granularity;
  }

  private updateIndicatorPanel() {
    const panel = document.getElementById('indicator-panel');
    if (panel) {
      panel.innerHTML = this.currentState.activeIndicators
        .map(id => `<div>${id}</div>`)
        .join('');
    }
  }

  private updateFullscreenControls() {
    const button = document.getElementById('fullscreen-button');
    if (button) {
      button.textContent = this.currentState.isFullscreen ? 'Exit' : 'Enter';
    }
  }

  private showLoadingIndicator() {
    // Show loading UI
  }

  cleanup() {
    this.api?.dispose();
  }
}
```

This comprehensive event system provides type safety, excellent developer experience, and robust error handling for all Chart API interactions.