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
