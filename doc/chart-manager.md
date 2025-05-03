# Chart Manger

We need to have the ability to view multiple charts in one page.

There could be a way to split a chart container horizontally and vertically. Ater splitting there would be two charts (instances of ChartContainer) showing.

Layter on, either of the two sides (which currently hold one ChartContainer) could be further split horizontally or vertically.

This will provide a recursive system that can support showing any number of charts.

## Implementation notes

- We should not add much further more logic to ChartContainer (chart-container.ts) which is already handling a lot of responsibilites.
- Let's add _new manager classes_ that can hold one or two ChartContainers split either horizontally or vertically.
- The manager classes should then again allow splitting their containers horizontally or vertically.
- The topmost container called ChartManager can contain a toolbar with controls to split the selected view.
