import { ValueRange } from "../value-axis";

export function drawLine(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  style: {
    color?: string;
    lineWidth?: number;
    opacity?: number;
    dashArray?: number[];
  },
  valueRange: ValueRange
) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = style.color || "#ffffff";
  ctx.lineWidth = style.lineWidth || 1;
  ctx.globalAlpha = style.opacity || 1;

  if (style.dashArray) {
    ctx.setLineDash(style.dashArray);
  }

  // Convert value to Y position using valueRange
  const height = ctx.canvas.height / (window.devicePixelRatio ?? 1);
  const getY = (value: number) => {
    return height - ((value - valueRange.min) / valueRange.range) * height;
  };

  ctx.moveTo(points[0].x, getY(points[0].y));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, getY(points[i].y));
  }

  ctx.stroke();
  ctx.setLineDash([]); // Reset dash array
  ctx.globalAlpha = 1; // Reset opacity
}

/**
 * Draw a horizontal reference line efficiently
 * Useful for indicators like Stochastic with overbought/oversold lines
 */
export function drawHorizontalReferenceLine(
  ctx: CanvasRenderingContext2D,
  value: number,
  style: {
    color?: string;
    lineWidth?: number;
    opacity?: number;
    dashArray?: number[];
  },
  valueRange: ValueRange
) {
  const dpr = window.devicePixelRatio ?? 1;
  const width = ctx.canvas.width / dpr;
  const height = ctx.canvas.height / dpr;

  // Convert value to Y position
  const y = height - ((value - valueRange.min) / valueRange.range) * height;

  ctx.beginPath();
  ctx.strokeStyle = style.color || "#ffffff";
  ctx.lineWidth = style.lineWidth || 1;
  ctx.globalAlpha = style.opacity || 1;

  if (style.dashArray) {
    ctx.setLineDash(style.dashArray);
  }

  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();

  ctx.setLineDash([]); // Reset dash array
  ctx.globalAlpha = 1; // Reset opacity
}

export function drawBand(
  ctx: CanvasRenderingContext2D,
  upperPoints: { x: number; y: number }[],
  lowerPoints: { x: number; y: number }[],
  style: {
    color?: string;
    lineWidth?: number;
    opacity?: number;
    fillColor?: string;
    fillOpacity?: number;
  },
  valueRange: ValueRange
) {
  if (upperPoints.length < 2 || lowerPoints.length < 2) return;

  // Convert value to Y position using valueRange
  const height = ctx.canvas.height / (window.devicePixelRatio ?? 1);
  const getY = (value: number) => {
    return height - ((value - valueRange.min) / valueRange.range) * height;
  };

  // Draw the filled area between bands
  ctx.beginPath();
  ctx.moveTo(upperPoints[0].x, getY(upperPoints[0].y));

  // Draw upper band
  for (let i = 1; i < upperPoints.length; i++) {
    ctx.lineTo(upperPoints[i].x, getY(upperPoints[i].y));
  }

  // Draw lower band in reverse
  for (let i = lowerPoints.length - 1; i >= 0; i--) {
    ctx.lineTo(lowerPoints[i].x, getY(lowerPoints[i].y));
  }

  ctx.closePath();

  // Fill the area
  if (style.fillColor) {
    ctx.fillStyle = style.fillColor;
    ctx.globalAlpha = style.fillOpacity || 0.1;
    ctx.fill();
  }

  // Draw the band borders
  ctx.strokeStyle = style.color || "#ffffff";
  ctx.lineWidth = style.lineWidth || 1;
  ctx.globalAlpha = style.opacity || 1;
  ctx.stroke();

  ctx.globalAlpha = 1; // Reset opacity
}

export function drawHistogram(
  ctx: CanvasRenderingContext2D,
  points: Array<{
    x: number;
    y: number;
    style: { color?: string; opacity?: number };
  }>,
  valueRange: ValueRange
) {
  const dpr = window.devicePixelRatio ?? 1;
  const height = ctx.canvas.height / dpr;
  const width = ctx.canvas.width / dpr;

  // Calculate bar width based on the number of points and canvas width
  // Leave a small gap (10% of calculated width) between bars
  const barWidth = (width / points.length) * 0.9;

  // Convert value to Y position using valueRange
  const getY = (value: number) => {
    return height - ((value - valueRange.min) / valueRange.range) * height;
  };

  // Calculate zero line position using the same conversion
  const zeroY = getY(0);

  ctx.lineWidth = barWidth;

  points.forEach((point) => {
    // Use the color and opacity from the point's style
    ctx.strokeStyle = point.style.color || "#000";
    ctx.globalAlpha = point.style.opacity || 1;

    ctx.beginPath();
    ctx.moveTo(point.x, zeroY);
    ctx.lineTo(point.x, getY(point.y));
    ctx.stroke();
  });

  ctx.globalAlpha = 1; // Reset opacity
}
