# Refactoring Plan: Reduce chart-container.ts Size

## Current State
- **File:** `client/components/chart/chart-container.ts`
- **Current size:** 2,071 lines
- **Target size:** ~1,280 lines (38% reduction)

## Analysis: What's NOT Core Container Responsibility

The container's **core responsibilities** are:
- Component lifecycle management
- Template rendering
- State coordination
- Draw orchestration

Everything else below can be extracted:

## Proposed Refactorings

### 1. **Event Handlers Manager** (HIGH PRIORITY)
**Impact:** ~400 lines saved
**New file:** `client/components/chart/chart-event-handlers.ts`

**Methods to extract:**
```typescript
- handleCandleClick (lines 1506-1538)
- handlePriceLineDragged (lines 1543-1549)
- handleAnnotationDraggedEvent (lines 1555-1559)
- handleRiskZoneClicked (lines 1564-1576)
- handleRiskZoneHovered (lines 1581-1593)
- handleDocumentClick (lines 1595-1612)
- handleChartAreaDoubleClick (lines 1614-1674)
- handleFullScreenToggle (lines 1676-1691)
- handleFullscreenChange (lines 1693-1702)
- handleClickOutside (lines 1704-1710)
- toggleFullWindow (lines 1712-1728)
- handleTrendLineUpdate (lines 1758-1792)
- handleTrendLineRemove (lines 1794-1840)
- handlePatternClick (lines 1842-1846)
- handleIndicatorToggle (lines 938-1017)
- handleUpgrade (lines 567-571)
- handleWindowFocus (lines 1502-1504)
- handleMobileChange (lines 500-505)
- showCandleTooltipFromContextMenu (lines 1019-1042)
```

**Structure:**
```typescript
export class ChartEventHandlers {
  constructor(
    private container: ChartContainer,
    private getState: () => ChartState
  ) {}

  // All handlers as methods
  handleCandleClick = (event: CustomEvent) => { /* ... */ }
  handleTrendLineUpdate = (event: CustomEvent) => { /* ... */ }
  // etc.

  // Setup method to attach all listeners
  attachListeners() { /* ... */ }
  detachListeners() { /* ... */ }
}
```

---

### 2. **Layer Update Coordinator** (HIGH PRIORITY)
**Impact:** ~120 lines saved
**New file:** `client/components/chart/layer-update-coordinator.ts`

**Methods to extract:**
```typescript
- updateLayer (lines 622-642)
- updateTimeMarkersLayer (lines 648-665)
- updatePositionOverlay (lines 671-691)
- updateRiskZonesCanvasLayer (lines 697-716)
- updateEquityCurveCanvasLayer (lines 722-744)
```

**Structure:**
```typescript
export class LayerUpdateCoordinator {
  constructor(
    private container: HTMLElement,
    private renderRoot: ShadowRoot,
    private getChart: () => CandlestickChart | null,
    private getState: () => ChartState,
    private priceAxisWidth: number
  ) {}

  updateLayer(layer: Layer) { /* ... */ }
  updateTimeMarkersLayer() { /* ... */ }
  updatePositionOverlay() { /* ... */ }
  updateRiskZonesCanvasLayer() { /* ... */ }
  updateEquityCurveCanvasLayer(controller?: EquityCurveController) { /* ... */ }

  // Convenience method to update all layers
  updateAllLayers() { /* ... */ }
}
```

---

### 3. **Interaction Setup Module** (MEDIUM PRIORITY)
**Impact:** ~120 lines saved
**Extend existing:** `client/components/chart/interaction/controller-factory.ts`

**Method to extract:**
```typescript
- initializeInteractionController (lines 1953-2069)
```

**Structure:**
```typescript
// Add to controller-factory.ts
export function initializeInteractionLayers(params: {
  container: ChartContainer;
  interactionController: ChartInteractionController;
  state: ChartState;
  priceAxisWidth: number;
  canvas: HTMLCanvasElement;
  controllers: {
    annotationsController?: AnnotationsController;
    trendLineController?: TrendLineController;
    timeMarkersController?: TimeMarkersController;
    riskZonesController?: RiskZonesController;
  };
}): void {
  // All layer registration logic
}
```

---

### 4. **Browser Integration** (MEDIUM PRIORITY)
**Impact:** ~100 lines saved
**New file:** `client/components/chart/browser-integration.ts`

**Methods to extract:**
```typescript
- setupZoomPrevention (lines 507-565)
- setupFocusHandler (lines 1498-1500)
- Mobile detection logic from constructor (lines 230-238)
```

**Structure:**
```typescript
export class BrowserIntegration {
  private handlers: any = {};

  constructor(
    private element: HTMLElement,
    private shadowRoot: ShadowRoot
  ) {}

  setupZoomPrevention(): void { /* ... */ }
  setupFocusHandler(onFocus: () => void): void { /* ... */ }
  setupMobileDetection(onChange: (isMobile: boolean) => void): MediaQueryList { /* ... */ }

  cleanup(): void {
    // Remove all listeners
  }
}
```

---

### 5. **Context Menu Builder** (LOW PRIORITY)
**Impact:** ~50 lines saved
**New file:** `client/components/chart/context-menu-builder.ts`

**Code to extract:**
```typescript
- Menu items construction in render() (lines 1045-1088)
```

**Structure:**
```typescript
export function buildContextMenuItems(params: {
  isFullWindow: boolean;
  showVolume: boolean;
  indicators: Map<string, IndicatorConfig>;
  container: ChartContainer;
  actions: {
    showCandleTooltip: () => void;
    toggleFullWindow: () => void;
  };
}): MenuItem[] {
  // Pure function returning menu items
}
```

---

## Implementation Strategy

### Phase 1: Foundation (Low Risk)
1. **Browser Integration** - Most isolated, no complex dependencies
2. **Context Menu Builder** - Pure function, easy to test

### Phase 2: Coordination (Medium Risk)
3. **Layer Update Coordinator** - Clear interface, well-defined boundaries
4. **Interaction Setup** - Extend existing factory pattern

### Phase 3: Events (Higher Risk)
5. **Event Handlers Manager** - Largest impact, needs careful `this` binding

---

## Benefits

1. **Readability**: Smaller, focused files are easier to understand
2. **Maintainability**: Single responsibility per module
3. **Testability**: Isolated logic can be unit tested
4. **Reusability**: Extracted modules could be used by other components
5. **Performance**: No runtime impact, purely organizational

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking `this` bindings | Use arrow functions or explicit binding in managers |
| Circular dependencies | Pass interfaces/getters instead of direct references |
| Testing complexity | Keep integration tests at container level initially |
| State access patterns | Pass accessor functions, not direct state references |

---

## Estimated Results

```
Current:  2,071 lines
Removed:    ~790 lines (38%)
Result:   ~1,280 lines
```

Each extracted module: 50-400 lines, focused on single responsibility.

---

## Next Steps

Start with **Browser Integration** (Phase 1) as it's the lowest risk and will provide a template for the other refactorings.
