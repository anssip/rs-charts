# Trend Line Implementation Plan

## Overview

This document outlines the implementation plan for adding TradingView-style trend lines to the Rekt Sense Charts. The feature will allow users to draw, adjust, and persist trend lines on the chart with support for infinite extensions and database persistence.

## Requirements

- Draw trend lines by clicking two points on the chart
- Adjust lines using draggable handles at endpoints
- Extend lines infinitely to the left and/or right
- Lock lines to specific price and time coordinates
- Persist lines across sessions via API events
- Support multiple trend lines simultaneously
- Maintain visibility when panning/zooming

## Architecture

### Data Model

```typescript
interface TrendLinePoint {
  timestamp: number;  // X-axis anchor (Unix timestamp)
  price: number;      // Y-axis anchor (price value)
}

interface TrendLine {
  id: string;                        // Unique identifier
  startPoint: TrendLinePoint;        // First anchor point
  endPoint: TrendLinePoint;          // Second anchor point
  extendLeft: boolean;               // Extend line infinitely to the left
  extendRight: boolean;              // Extend line infinitely to the right
  color?: string;                    // Line color (default: theme color)
  lineWidth?: number;                // Line thickness (default: 1)
  style?: 'solid' | 'dashed' | 'dotted';  // Line style (default: solid)
  label?: string;                    // Optional label for the line
}

interface TrendLineEvent {
  type: 'add' | 'update' | 'remove';
  trendLine: TrendLine;
  previousState?: TrendLine;         // For update events
}
```

### Component Structure

```
client/components/chart/
├── trend-line-layer.ts          # Container for all trend lines
├── trend-line.ts                # Individual trend line component
├── tools/
│   └── trend-line-tool.ts      # Drawing tool controller
└── chart-container.ts           # Modified to include trend line layer
```

## Implementation Phases

### Phase 1: Core Components

#### 1.1 Create `trend-line.ts` Component

**Location:** `client/components/chart/trend-line.ts`

**Responsibilities:**
- Render a single trend line using SVG or Canvas
- Convert price/time coordinates to pixel positions
- Support infinite line extensions via calculation
- Render draggable handles at endpoints
- Emit events when line is modified

**Key Methods:**
```typescript
class TrendLine extends LitElement {
  @property() trendLine: TrendLine;
  @property() timeRange: TimeRange;
  @property() priceRange: PriceRange;

  private renderLine(): void;
  private renderHandles(): void;
  private calculateExtendedPoints(): [Point, Point];
  private handleDragStart(handle: 'start' | 'end'): void;
  private handleDragMove(event: MouseEvent): void;
  private handleDragEnd(): void;
}
```

#### 1.2 Create `trend-line-layer.ts` Component

**Location:** `client/components/chart/trend-line-layer.ts`

**Responsibilities:**
- Manage collection of trend lines
- Handle coordinate system updates
- Implement visibility culling
- Forward events from individual lines

**Key Methods:**
```typescript
class TrendLineLayer extends LitElement {
  @property() trendLines: TrendLine[] = [];
  @property() state: ChartState;

  addTrendLine(line: TrendLine): void;
  removeTrendLine(id: string): void;
  updateTrendLine(id: string, updates: Partial<TrendLine>): void;
  getVisibleTrendLines(): TrendLine[];
}
```

#### 1.3 Create `trend-line-tool.ts` Component

**Location:** `client/components/chart/tools/trend-line-tool.ts`

**Responsibilities:**
- Handle drawing mode activation
- Capture two-click drawing interaction
- Show preview line during drawing
- Create new trend line on completion

**Key Methods:**
```typescript
class TrendLineTool {
  private isActive: boolean = false;
  private firstPoint: TrendLinePoint | null = null;

  activate(): void;
  deactivate(): void;
  handleClick(event: MouseEvent): void;
  private showPreview(currentPoint: Point): void;
  private createTrendLine(): TrendLine;
}
```

### Phase 2: Interaction System

#### 2.1 Handle Adjustments
- Implement draggable handles with visual feedback
- Add hover effects for better UX
- Support touch events for mobile
- Optional snap-to-candle functionality

#### 2.2 Coordinate Transformation
- Implement pixel ↔ price/time conversion utilities: Existing ones for canvas drawing exist in `client/util/chart-util.ts`
- Update line positions on pan/zoom
- Handle viewport clipping for extended lines
- Optimize rendering for off-screen lines

### Phase 3: State Management

#### 3.1 State Integration
- Add `trendLines: TrendLine[]` to ChartState
- Update ChartStateManager with trend line methods
- Ensure persistence across chart updates

#### 3.2 API Events
- Emit `trend-line-added` event
- Emit `trend-line-updated` event
- Emit `trend-line-removed` event
- Add ChartAPI methods for external control

### Phase 4: UI Integration

#### 4.1 Toolbar Integration
- Add trend line tool button to chart toolbar
- Visual indicator for active drawing mode
- Keyboard shortcut support (e.g., Alt+T)

#### 4.2 Context Menu
- Right-click menu on trend lines
- Options: Delete, Edit Properties, Duplicate
- Line style customization dialog

## API Integration

### New API Methods

```typescript
interface ChartApi {
  // Trend Line Methods
  addTrendLine(trendLine: Omit<TrendLine, 'id'>): string;
  removeTrendLine(id: string): void;
  updateTrendLine(id: string, updates: Partial<TrendLine>): void;
  getTrendLines(): TrendLine[];
  clearTrendLines(): void;

  // Tool Methods
  activateTrendLineTool(): void;
  deactivateTrendLineTool(): void;
  isToolActive(tool: 'trendLine'): boolean;
}
```

### Event Listeners

```typescript
// Listen for trend line events
api.on('trend-line-added', (event: TrendLineEvent) => {
  // Save to database
  await saveTrendLine(event.trendLine);
});

api.on('trend-line-updated', (event: TrendLineEvent) => {
  // Update in database
  await updateTrendLine(event.trendLine.id, event.trendLine);
});

api.on('trend-line-removed', (event: TrendLineEvent) => {
  // Remove from database
  await deleteTrendLine(event.trendLine.id);
});
```

### Usage Examples

```typescript
// Programmatically add a trend line
const lineId = api.addTrendLine({
  startPoint: { timestamp: 1704067200000, price: 42000 },
  endPoint: { timestamp: 1704153600000, price: 44000 },
  extendRight: true,
  color: '#00ff00',
  style: 'dashed'
});

// Update existing trend line
api.updateTrendLine(lineId, {
  extendLeft: true,
  color: '#ff0000'
});

// Get all trend lines
const lines = api.getTrendLines();

// Load trend lines from database
const savedLines = await loadTrendLinesFromDB();
savedLines.forEach(line => api.addTrendLine(line));
```

## Rendering Strategy

### SVG Approach (Recommended and chosen)
- **Pros:** Precise rendering, easy event handling, CSS styling
- **Cons:** Performance with many lines (>100)

### Canvas Approach (Alternative)
- **Pros:** Better performance with many lines
- **Cons:** Manual hit detection, complex event handling

### Hybrid Approach
- Use SVG for interactive lines (being drawn/edited)
- Convert to Canvas for static lines
- Switch based on line count threshold

## Performance Considerations

1. **Visibility Culling:** Only render lines visible in viewport
2. **Debounced Updates:** Batch coordinate updates during pan/zoom
3. **RequestAnimationFrame:** Use for smooth dragging
4. **Line Simplification:** Reduce points for extended lines
5. **Lazy Loading:** Load historical lines on demand

## Mobile Support

1. **Touch Events:** Support touch for drawing and dragging
2. **Larger Hit Areas:** Increase handle size on mobile
3. **Touch Gestures:** Two-finger zoom compatibility
4. **Responsive UI:** Adapt tool UI for mobile screens

## Testing Strategy

### Unit Tests
- Coordinate transformation accuracy
- Line extension calculations
- State management operations

### Integration Tests
- Drawing interaction flow
- Pan/zoom behavior
- Event emission and handling

### E2E Tests
- Complete user workflow
- Cross-browser compatibility
- Mobile device testing

## Future Enhancements

1. **Advanced Line Types:**
   - Fibonacci retracements
   - Parallel channels
   - Pitchforks

2. **Line Interactions:**
   - Alerts when price crosses line
   - Line-to-line measurements
   - Magnetic snap to price levels

3. **Collaboration:**
   - Share trend lines with other users
   - Real-time collaborative drawing
   - Line ownership and permissions

4. **Analytics:**
   - Line accuracy statistics
   - Historical performance tracking
   - Pattern recognition

## Timeline Estimate

- **Phase 1:** 3-4 days (Core components)
- **Phase 2:** 2-3 days (Interaction system)
- **Phase 3:** 2 days (State management)
- **Phase 4:** 1-2 days (UI integration)
- **Testing:** 2 days
- **Documentation:** 1 day

**Total:** ~2 weeks for full implementation

## Success Criteria

- [ ] Users can draw trend lines with two clicks
- [ ] Lines can be adjusted via draggable handles
- [ ] Lines extend infinitely when configured
- [ ] Lines persist across sessions
- [ ] Multiple lines can coexist
- [ ] Lines remain accurate during pan/zoom
- [ ] API events fire correctly
- [ ] Mobile support works smoothly
- [ ] Performance remains good with 50+ lines
