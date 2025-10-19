# Add initial chart configuration

Is it now possible to supply the initial indicators, symbol and time granularity to this chart library
so that it uses those to load the initial candles and indicators to show? Or is it now first loading candles
using a default (BTC-USD) symbol and 1 hour granularity? I'd like it to be possible to provide the initial
configuration at the start of the app so that it loads using correct data.

# Remove the logo

Remove the logo from the bottom left corner or the chart.

# Trend lines

I want to make it possible to add trend lines to the chart. This would be something similar to the trend lines
in TradingView.

- There should be a setting to extend the line either to the left or right, and if extended the line should be visible in the extended direction indefinitely if the user pans the chart to that direction.
- There should be a tool to draw the line to the chart. After drawn, it needs to be possible to adjust the line by moving the handles that were added when the line was created.
- The line should be locked to the price and time where the handled are positioned.
- The line should appear in view when the chart is panned to a position where the line is visible.
- The API should have an event that is triggered when the line is added or removed. I will then use this event to store the line in the database. It will store the handle positions (time, price). Using these it should be then possible to recreate the line in the future.
- There should be a separate layer div and a web component for drawing these lines. It can hold several trend lines each of them drawn in separate components.
- There can be multiple trend lines and these could be drawn in separate components.

Can you provide a plan first on how to implement this feature?

Let's implement the SVG approach for drawing trend lines. The first step now is to create the first stab at this: Users can draw trend with two clicks. Implement everything needed for this first step: The core components, Interaction system, state management, UI integration.

# Line editing

- Add an event to the chart-api that is emitted when a line is selected. It should include an ID of the line that can be then used to identify the line in later API calls.
- Then add an API method that can be used to set settings to a line: the color, thickness, line style (solid, dashed, dotted), and whether it is extended in either directions.
- The ability to extend the line needs to added as well. If the line is extended towardsits end pointing to left, then the line will be visible when the chart is panned to the left. This is similar to how TradingView does it.

We can implement the extended line feature later. Now just add it to the API interface.

# Line deletion

Let's add line deletion.

- Add a API method to delete a line by its ID.
- Make it possible to delete a line by hitting the backspace key when the line is selected.
- Add an event to the chart-api that is emitted when a line is deleted. It should include an ID of the line that was deleted.

# Line modification

- Add an event to the chart-api that is emitted when a line is modified. It should include an ID of the line that can be then used to identify the line in later API calls.
- Then add an API method that can be used to modify a line by its ID.

# API enhancements

Add the follwing methods to chart-api.ts and make these functional:

- getTimeRange(): returns the currently visible time range
- setTimeRange(): sets a new time range for the chart and makes it visible
- getPriceRange(): returns the currently visible price range
- setPriceRange(): sets a new price range for the chart and makes it visible

# Trend line enhancelemts

Add name and description to the trend lines. There needs to be a way to provide these in the API methods that are used to create and update trend lines. The name should be shown as a small text above the line so that the name is visible when a part of the line is visible in the chart - the name might move as the chart is panned or zoomed. The description shoule be shown when the user hovers over the line's touch area- there needs to be a small delay before it's shown.

Add a way to set these properties to the testing overlay that is in client/index.html

# Pattern highlight

Add a highlightCandles function to the chart-api. This should highlight candles based on the provided timestamps. This will be used to highlight patterns on the chart. The name of the pattern should be shown above the first candle of the pattern. The description should be shown when the user clicks the pattern name. The `color` and `style` are used to add the highlight.

```typescript
interface PatternHighlight {
  id: string;                    // Unique ID for the pattern instance
  type: string;                   // Pattern type (e.g., "doji", "hammer", "bullish_engulfing")
  name: string;                   // Display name (e.g., "Doji", "Hammer", "Bullish Engulfing")
  description: string;            // Detailed description (e.g., "Bullish Engulfing pattern at support $115,633.58")
  candleTimestamps: number[];     // Array of timestamps for candles involved in the pattern
  significance: 'low' | 'medium' | 'high' | 'very high';  // Pattern significance
  color?: string;                 // Optional highlight color (defaults based on pattern type)
  style?: 'outline' | 'fill' | 'both';  // How to highlight the candles
  nearLevel?: {                  // Optional key level information
    type: 'support' | 'resistance';
    price: number;
    distance: number;           // Percentage distance from the level
  };
}

// Method to add to the Chart API:
highlightPatterns: (patterns: PatternHighlight[]) => void;
clearPatternHighlights: () => void;
getHighlightedPatterns: () => PatternHighlight[];
```

## Example usage

```typescript
const patterns: PatternHighlight[] = [
  {
    id: 'pattern_1',
    type: 'bullish_engulfing',
    name: 'Bullish Engulfing',
    description: 'Bullish Engulfing pattern at support $115,633.58',
    candleTimestamps: [1758344400000, 1758348000000],
    significance: 'very high',
    color: '#4ade80',  // Green for bullish
    style: 'both',
    nearLevel: {
      type: 'support',
      price: 115633.58,
      distance: 0.3
    }
  },
  {
    id: 'pattern_2',
    type: 'doji',
    name: 'Doji',
    description: 'Doji pattern (body 4.5% of range)',
    candleTimestamps: [1758369600000],
    significance: 'medium',
    color: '#fbbf24',  // Yellow for indecision
    style: 'outline'
  }
];

// Highlight patterns on the chart
activeChartApi.highlightPatterns(patterns);

// Clear all highlights
activeChartApi.clearPatternHighlights();

// Get currently highlighted patterns
const currentPatterns = activeChartApi.getHighlightedPatterns();
```

# Interaction controller improvements

We have implemented all features in @paper-trading-plan.md from beginning up to section 6. Annotations. The current issue is that after adding Annotations and making it possible to drag the draggable annotations, it's no longer possible to drag the price lines (price lines were also in the paper trading plan). Price line dragging was working fine before we added annotations.

To me it looks like we need a better way to handle the mouse interactions (especially dragging) now as we have so many different layers on top of the chart. Plan an improved way to handle the dragging of items in the different layers. Following needs to be taken into account:

- clicking on the chart needs to open the @live-candle-display.ts
- it needs to be possible to pan and zoom the chart
- it needs to be possible to draw new trend lines, and to move existing trend lines (there is a layer for trend lines)
- it needs to be possible to move price lines (there is a layer for these)
- it needs to be possible to move draggable annotations (there is a layer for these)
- the items in the different layers need to zoom and pan when the chart is zoomed and panned
- the paper-trading-plan.md contains features (risk zones, equity curve overlay) which might need additional layers to be added, these should be managed by the new interaction manager

We already have the chart-intgeraction-controller.ts for managing user interactions. This could be enhanced so that it's able to manage this complex environment of several layers.

# Paper trading layers refactor

Make the same design for how click-to-trade mode is implemented. [@chart-api.ts](zed:///agent/file?path=%2FUsers%2Fanssi%2Fprojects%2Fspotcanvas%2Frs-charts%2Fclient%2Fapi%2Fchart-api.ts) should call methods in a new click-to-trade-controller module and the public Click-to-Trade methods should be removed from chart-container.

Make the same design with a new controller for how risk zones is implemented. [@chart-api.ts](zed:///agent/file?path=%2FUsers%2Fanssi%2Fprojects%2Fspotcanvas%2Frs-charts%2Fclient%2Fapi%2Fchart-api.ts) should call methods in a new risk-zones-controller module and the public risk zones related methods should be removed from chart-container.

Make the same design with a new controller for how time markers is implemented. [@chart-api.ts](zed:///agent/file?path=%2FUsers%2Fanssi%2Fprojects%2Fspotcanvas%2Frs-charts%2Fclient%2Fapi%2Fchart-api.ts) should call methods in a new time-markers-controller module and the public time markers related methods should be removed from chart-container.

## annotations

Make the same design with a new controller for how annotations is implemented. [@chart-api.ts](zed:///agent/file?path=%2FUsers%2Fanssi%2Fprojects%2Fspotcanvas%2Frs-charts%2Fclient%2Fapi%2Fchart-api.ts) should call methods in a new annotations-controller module and the public annotations related methods should be removed from chart-container.

## position overlay

Make the same design with a new controller for how position overlay is implemented. [@chart-api.ts](zed:///agent/file?path=%2FUsers%2Fanssi%2Fprojects%2Fspotcanvas%2Frs-charts%2Fclient%2Fapi%2Fchart-api.ts) should call methods in a new position-overlay-controller module and the public position overlay related methods should be removed from chart-container.
