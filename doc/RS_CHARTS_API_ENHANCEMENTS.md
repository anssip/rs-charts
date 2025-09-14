# RS-Charts API Enhancement Specification

## Support & Resistance Levels Visualization

This document describes the necessary enhancements to the rs-charts library to support advanced visualization of support and resistance levels as specified in `FRONTEND_VISUAL_GUIDE.md`.

## Current State

The rs-charts library currently supports trend lines with these properties:
- `id`: string
- `startPoint`: { timestamp: number, price: number }
- `endPoint`: { timestamp: number, price: number }
- `extendLeft`: boolean
- `extendRight`: boolean
- `color`: string (optional)
- `lineWidth`: number (optional)
- `style`: 'solid' | 'dashed' | 'dotted' (optional)
- `label`: string (optional)
- `name`: string (optional)
- `description`: string (optional)

## Required Enhancements

### 1. Type Definitions Update

#### File: `/Users/anssi/projects/spotcanvas/rs-charts/client/types/trend-line.ts`

Add the following properties to the `TrendLine` interface:

```typescript
export interface TrendLine {
  // ... existing properties ...

  // New properties for support/resistance visualization
  levelType?: 'swing' | 'horizontal';  // Type of support/resistance level
  opacity?: number;                     // Opacity value (0.0 to 1.0)
  markers?: {                          // Optional markers along the line
    enabled: boolean;
    symbol: 'diamond' | 'circle' | 'square' | 'triangle';
    size: number;                      // Size in pixels
    spacing: number;                   // Spacing between markers in pixels
    color?: string;                    // Marker color (defaults to line color)
  };
  zIndex?: number;                      // Z-index for layering (higher = on top)
}
```

### 2. Trend Line Component Rendering

#### File: `/Users/anssi/projects/spotcanvas/rs-charts/client/components/chart/trend-line.ts`

Enhance the `render()` method to support new visual properties:

```typescript
render() {
  // ... existing code ...

  const lineColor = this.trendLine.color || "#2962ff";
  const lineStyle = this.trendLine.style || "solid";
  const lineWidth = this.trendLine.lineWidth || 2;
  const opacity = this.trendLine.opacity ?? 1.0;  // New: opacity support
  const zIndex = this.trendLine.zIndex ?? 0;      // New: z-index support

  // ... existing code ...

  return html`
    <svg
      class="${this.hovered ? "hovered" : ""} ${this.selected ? "selected" : ""}"
      style="z-index: ${zIndex}"  // Apply z-index
    >
      ${/* Render defs for markers if enabled */
      this.trendLine.markers?.enabled ? this.renderMarkerDefs(lineColor) : ''}

      <line
        class="trend-line"
        x1="${extendedStart.x}"
        y1="${extendedStart.y}"
        x2="${extendedEnd.x}"
        y2="${extendedEnd.y}"
        stroke="${lineColor}"
        stroke-width="${lineWidth}"
        stroke-opacity="${opacity}"  // Apply opacity
        stroke-dasharray="${this.getStrokeDashArray(lineStyle)}"
        ${/* Add marker references if enabled */
        this.trendLine.markers?.enabled
          ? `marker-mid="url(#marker-${this.trendLine.id})"`
          : ''}
        @mousedown="${this.handleLineMouseDown}"
        @touchstart="${this.handleLineTouchStart}"
        @click="${this.handleLineClick}"
      />

      ${/* Render invisible markers along the line for marker placement */
      this.trendLine.markers?.enabled
        ? this.renderMarkers(extendedStart, extendedEnd)
        : ''}

      <!-- ... rest of existing SVG content ... -->
    </svg>
  `;
}

// New helper method for marker definitions
private renderMarkerDefs(lineColor: string): TemplateResult {
  const markers = this.trendLine.markers!;
  const markerColor = markers.color || lineColor;
  const markerSize = markers.size || 4;

  return html`
    <defs>
      <marker
        id="marker-${this.trendLine.id}"
        markerWidth="${markerSize * 2}"
        markerHeight="${markerSize * 2}"
        refX="${markerSize}"
        refY="${markerSize}"
        orient="auto"
      >
        ${this.renderMarkerShape(markers.symbol, markerSize, markerColor)}
      </marker>
    </defs>
  `;
}

// New helper method for marker shape
private renderMarkerShape(
  symbol: string,
  size: number,
  color: string
): TemplateResult {
  switch (symbol) {
    case 'diamond':
      return html`
        <polygon
          points="${size},0 ${size*2},${size} ${size},${size*2} 0,${size}"
          fill="${color}"
        />
      `;
    case 'circle':
      return html`
        <circle cx="${size}" cy="${size}" r="${size/2}" fill="${color}" />
      `;
    case 'square':
      return html`
        <rect
          x="${size/2}"
          y="${size/2}"
          width="${size}"
          height="${size}"
          fill="${color}"
        />
      `;
    case 'triangle':
      return html`
        <polygon
          points="${size},0 ${size*2},${size*2} 0,${size*2}"
          fill="${color}"
        />
      `;
    default:
      return html``;
  }
}

// New helper method to render markers along the line
private renderMarkers(start: Point, end: Point): TemplateResult {
  const markers = this.trendLine.markers!;
  const spacing = markers.spacing || 100;

  // Calculate line length
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  // Calculate number of markers
  const numMarkers = Math.floor(lineLength / spacing);

  // Generate marker positions
  const markerPositions: Point[] = [];
  for (let i = 1; i < numMarkers; i++) {
    const t = i / numMarkers;
    markerPositions.push({
      x: start.x + dx * t,
      y: start.y + dy * t
    });
  }

  // Render invisible points for marker placement
  return html`
    ${markerPositions.map(pos => html`
      <circle
        cx="${pos.x}"
        cy="${pos.y}"
        r="0"
        class="marker-point"
      />
    `)}
  `;
}
```

### 3. CSS Enhancements

#### File: `/Users/anssi/projects/spotcanvas/rs-charts/client/components/chart/trend-line.ts`

Add CSS for better visual hierarchy:

```css
:host {
  /* ... existing styles ... */
}

.trend-line {
  /* ... existing styles ... */
  transition: stroke-opacity 0.2s ease;
}

/* Different hover effects based on level type */
.trend-line[data-level-type="swing"]:hover {
  filter: drop-shadow(0 0 4px currentColor);
}

.trend-line[data-level-type="horizontal"]:hover {
  filter: drop-shadow(0 0 2px currentColor);
}

/* Marker animations */
.marker-point {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
```

### 4. Chart API Enhancement

#### File: `/Users/anssi/projects/spotcanvas/rs-charts/client/api/chart-api.ts`

No changes needed to the `addTrendLine` method as it already accepts all properties through the generic `TrendLine` interface. The method signature remains:

```typescript
addTrendLine(
  trendLine: Omit<TrendLine, "id"> & { selected?: boolean }
): string
```

### 5. Trend Line Layer Enhancement

#### File: `/Users/anssi/projects/spotcanvas/rs-charts/client/components/chart/trend-line-layer.ts`

Update the render method to sort trend lines by z-index:

```typescript
render() {
  const visibleLines = this.getVisibleTrendLines()
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); // Sort by z-index

  // ... rest of existing render logic ...
}
```

## Usage Example

With these enhancements, the sc-app can create differentiated support/resistance lines:

```typescript
// Swing level (precise reversal point)
chartApi.addTrendLine({
  startPoint: { timestamp: startTime, price: 115892.08 },
  endPoint: { timestamp: endTime, price: 115892.08 },
  color: '#00FF00',           // Bright green for support
  lineWidth: 3,                // Thicker for swing levels
  style: 'solid',              // Based on confidence
  opacity: 0.9,                // High opacity for high confidence
  levelType: 'swing',          // Mark as swing level
  markers: {                   // Diamond markers for swing levels
    enabled: true,
    symbol: 'diamond',
    size: 4,
    spacing: 100
  },
  zIndex: 100,                 // Swing levels on top
  extendLeft: true,
  extendRight: true,
  name: '◆ S 82%',
  description: 'Swing support at 115892.08, confidence: 82%'
});

// Horizontal level (consolidation zone)
chartApi.addTrendLine({
  startPoint: { timestamp: startTime, price: 114500.00 },
  endPoint: { timestamp: endTime, price: 114500.00 },
  color: '#66CC66',           // Soft green for support
  lineWidth: 1.5,              // Thinner for horizontal levels
  style: 'dashed',             // Based on confidence
  opacity: 0.7,                // Lower opacity
  levelType: 'horizontal',     // Mark as horizontal level
  markers: {                   // No markers for horizontal levels
    enabled: false
  },
  zIndex: 90,                  // Horizontal levels below swing levels
  extendLeft: true,
  extendRight: true,
  name: '— S 65%',
  description: 'Horizontal support at 114500.00, confidence: 65%'
});
```

## Implementation Priority

1. **Phase 1 - Core Properties** (Required)
   - Add `opacity` property support
   - Add `levelType` property for metadata
   - Add `zIndex` property for layering

2. **Phase 2 - Markers** (Enhanced visualization)
   - Implement marker definitions
   - Add marker rendering along lines
   - Support different marker symbols

3. **Phase 3 - Optimizations** (Performance)
   - Batch rendering for multiple trend lines
   - Optimize marker calculations for long lines
   - Add level-of-detail (LOD) rendering

## Testing Requirements

1. Verify opacity renders correctly (0.0 to 1.0 range)
2. Test z-index layering with multiple overlapping lines
3. Validate marker rendering at different zoom levels
4. Ensure performance with 10+ trend lines with markers
5. Test touch interactions on mobile devices
6. Verify marker spacing calculations for diagonal lines

## Migration Notes

- The changes are backward compatible
- Existing trend lines will continue to work without the new properties
- Default values ensure no visual changes for existing implementations