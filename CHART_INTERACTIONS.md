# Chart Interaction Guide

## Overview
The chart provides different interaction methods for navigating and zooming across three main areas: the Chart Area (main canvas), Timeline (horizontal axis), and Price Axis (vertical axis). Each area responds differently to mouse and touch inputs.

## Chart Area (Main Canvas)

### Mouse/Trackpad Interactions
- **Click and Drag**: Pan the chart
  - Drag left → View earlier time periods (move backward in time)
  - Drag right → View later time periods (move forward in time)
  - Drag up → View lower price levels
  - Drag down → View higher price levels

- **Scroll Wheel/Trackpad Scroll**:
  - Horizontal scroll → Pan through time
  - Vertical scroll → Pan through price levels
  - Smooth trackpad scrolling supported with natural scroll direction

### Touch Interactions (iPad/Tablet)
- **Single Finger Swipe**: Pan the chart
  - Swipe left → Chart moves left (view earlier data)
  - Swipe right → Chart moves right (view later data)
  - Swipe up → Chart moves up (view lower prices)
  - Swipe down → Chart moves down (view higher prices)
  - Uses natural scrolling behavior expected on touch devices

- **Two Finger Pinch**: Directional zoom based on gesture orientation
  - **Horizontal pinch** (fingers move horizontally): Zoom the timeline
    - Pinch in → Zoom out (see more time period)
    - Pinch out → Zoom in (see less time period)
  - **Vertical pinch** (fingers move vertically): Zoom the price axis
    - Pinch in → Zoom out (wider price range)
    - Pinch out → Zoom in (narrower price range)
  - **Diagonal pinch**: Zooms both axes proportionally
  - Zoom centers on the midpoint between fingers

## Timeline (Horizontal Axis)

### Mouse/Trackpad Interactions
- **Click and Drag**: Zoom the timeline
  - Drag left → Zoom out (show more candles/time)
  - Drag right → Zoom in (show fewer candles/time)

- **Scroll Wheel/Trackpad**: Zoom the timeline
  - Scroll up or right → Zoom in
  - Scroll down or left → Zoom out
  - Zoom centers on cursor position

### Touch Interactions
- **Single Finger Swipe**: Zoom the timeline
  - Swipe left → Zoom out (show more time)
  - Swipe right → Zoom in (show less time)

- **Two Finger Pinch**: Zoom the timeline (horizontal only)
  - Pinch in → Zoom out (show more time)
  - Pinch out → Zoom in (show less time)
  - Zoom centers on the midpoint between fingers
  - Note: Pinch gestures on the timeline only affect horizontal zoom

## Price Axis (Vertical Axis)

### Mouse/Trackpad Interactions
- **Click and Drag**: Zoom the price axis
  - Drag up → Zoom out (show wider price range)
  - Drag down → Zoom in (show narrower price range)

- **Scroll Wheel/Trackpad**: Zoom the price axis
  - Scroll up → Zoom in
  - Scroll down → Zoom out

### Touch Interactions
- **Single Finger Swipe**: Zoom the price axis
  - Swipe up → Zoom out (show wider price range)
  - Swipe down → Zoom in (show narrower price range)

- **Two Finger Pinch**: Zoom the price axis (vertical only)
  - Pinch in → Zoom out (wider price range)
  - Pinch out → Zoom in (narrower price range)
  - Zoom is applied uniformly regardless of pinch direction
  - Note: Pinch gestures on the price axis only affect vertical zoom, timeline remains unchanged

## Interaction Zones Summary

| Area | Mouse Drag | Mouse Wheel | Touch Single Finger | Touch Pinch |
|------|------------|-------------|-------------------|--------------|
| **Chart Area** | Pan X/Y | Pan X/Y | Pan X/Y | Directional Zoom* |
| **Timeline** | Zoom Time | Zoom Time | Zoom Time | Zoom Time (H only) |
| **Price Axis** | Zoom Price | Zoom Price | Zoom Price | Zoom Price (V only) |

*Directional zoom in chart area: Horizontal pinch → timeline zoom, Vertical pinch → price zoom, Diagonal → both

## Key Behaviors

### Zoom Limits
- **Minimum zoom**: 10 candles visible
- **Maximum zoom**: Limited by candle width to prevent overlap (minimum 5px candle width + 6px gap)

### Pan Limits
- Cannot pan beyond current time (future)
- Automatically loads more historical data when panning to the past (if available)

### Touch-Specific Behaviors
- **Natural scrolling**: Touch gestures follow natural scrolling patterns (content moves with finger)
- **Momentum scrolling**: Not currently implemented
- **Gesture isolation**: Pinch gestures on specific areas are isolated:
  - Price axis pinch → only vertical zoom
  - Timeline pinch → only horizontal zoom
  - Chart area pinch → directional zoom based on finger movement
- **Directional pinch detection** (Chart area only):
  - System detects whether fingers move primarily horizontally, vertically, or diagonally
  - Applies appropriate zoom based on gesture direction

### Performance Optimizations
- **Smart data loading**: Additional data loads automatically when approaching viewport edges
- **Buffer zones**: Maintains data buffer (1x viewport width) for smooth panning
- **Responsive design**: Price axis width adjusts for mobile devices

## Tips for Users

1. **Quick Navigation**:
   - Use the main chart area for general navigation
   - Use timeline for time-specific zoom control
   - Use price axis for price-specific zoom control

2. **Precision Control**:
   - Mouse wheel provides fine-grained control
   - Timeline and price axis dragging offer precise zoom adjustments

3. **Touch Devices**:
   - Single finger gestures work consistently across all areas
   - Pinch-to-zoom in chart area provides familiar zoom experience
   - Each axis can be controlled independently

4. **Combined Operations**:
   - You can pan and zoom simultaneously using different areas
   - Zoom settings persist while panning
   - All interactions are real-time with immediate visual feedback