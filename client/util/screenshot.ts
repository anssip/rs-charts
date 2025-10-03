import html2canvas from "html2canvas";
import { ChartContainer } from "../components/chart/chart-container";
import { getLogger } from "./logger";

const logger = getLogger("Screenshot");

/**
 * Helper function to manually draw a live price label element
 */
function drawLivePriceLabel(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  wrapperRect: DOMRect,
  scale: number
): void {
  const elementRect = element.getBoundingClientRect();
  const x = Math.round((elementRect.left - wrapperRect.left) * scale);
  const y = Math.round((elementRect.top - wrapperRect.top) * scale);
  const width = Math.round(elementRect.width * scale * 0.95);
  const height = Math.round(elementRect.height * scale);

  logger.info(`Drawing live price label at (${x}, ${y}) size ${width}x${height}`);

  // Get computed styles
  const styles = window.getComputedStyle(element);
  const borderColor = styles.borderColor;

  ctx.save();

  // Draw opaque black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, width, height);

  // Draw border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(x, y, width, height);

  ctx.restore();

  // Extract text from child elements
  const priceEl = element.querySelector('.price') as HTMLElement;
  const timeEl = element.querySelector('.time') as HTMLElement;

  if (priceEl && timeEl) {
    const priceText = priceEl.textContent || '';
    const timeText = timeEl.textContent || '';
    const priceColor = window.getComputedStyle(priceEl).color;
    const timeColor = window.getComputedStyle(timeEl).color;

    // Enable better text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.textAlign = 'center';

    // Draw price text (centered, top half)
    ctx.fillStyle = priceColor;
    ctx.font = `bold ${10 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, x + width / 2, y + height * 0.4);

    // Draw time text (centered, below price)
    ctx.fillStyle = timeColor;
    ctx.font = `${8 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillText(timeText, x + width / 2, y + height * 0.7);

    ctx.textAlign = 'left'; // Reset
  }
}

/**
 * Helper function to manually draw a live candle display element
 */
function drawLiveCandleDisplay(
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  wrapperRect: DOMRect,
  scale: number
): void {
  const elementRect = element.getBoundingClientRect();
  const x = Math.round((elementRect.left - wrapperRect.left) * scale);
  const y = Math.round((elementRect.top - wrapperRect.top) * scale);
  // Make it wider and taller to fit all content properly
  const width = Math.round(elementRect.width * scale * 1.15);
  const height = Math.round(elementRect.height * scale * 1.15);

  logger.info(`Drawing live candle display at (${x}, ${y}) size ${width}x${height}`);

  // Draw semi-transparent black background with rounded corners effect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(x, y, width, height);

  // Extract rows with labels and values
  const rows = element.querySelectorAll('.display-row');
  const changeIndicator = element.querySelector('.change-indicator');

  logger.info(`Found ${rows.length} display rows`);

  let offsetY = 16 * scale;
  const lineHeight = 24 * scale;
  const fontSize = 12 * scale;
  const padding = 14 * scale;
  const labelX = x + padding;
  const valueX = x + width - padding;

  // Set font properties
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';

  // Draw each OHLC row
  rows.forEach((row, index) => {
    const labelEl = row.querySelector('.display-label') as HTMLElement;
    const valueEl = row.querySelector('.display-value') as HTMLElement;

    if (labelEl && valueEl) {
      const labelText = labelEl.textContent?.trim() || '';
      const valueText = valueEl.textContent?.trim() || '';
      const valueColor = window.getComputedStyle(valueEl).color;

      logger.info(`Row ${index}: "${labelText}" = "${valueText}" at y=${y + offsetY}`);

      // Draw label (left-aligned, gray)
      ctx.fillStyle = '#999999';
      ctx.textAlign = 'left';
      ctx.fillText(labelText, labelX, y + offsetY);

      // Draw value (right-aligned, colored)
      ctx.fillStyle = valueColor;
      ctx.textAlign = 'right';
      ctx.fillText(valueText, valueX, y + offsetY);

      offsetY += lineHeight;
    }
  });

  // Draw change indicator if present
  if (changeIndicator) {
    offsetY += 4 * scale; // Reduced spacing before change indicator

    const changeValue = changeIndicator.querySelector('.change-value') as HTMLElement;
    if (changeValue) {
      const changeText = changeValue.textContent?.trim() || '';
      const changeColor = window.getComputedStyle(changeValue).color;

      // Draw separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + padding, y + offsetY);
      ctx.lineTo(x + width - padding, y + offsetY);
      ctx.stroke();

      offsetY += 14 * scale;

      // Extract arrow and text separately
      const arrow = changeValue.querySelector('.arrow');
      const arrowText = arrow ? arrow.textContent?.trim() || '' : '';
      // Remove arrow from change text if it exists
      const textWithoutArrow = changeText.replace(arrowText, '').trim();

      // Draw arrow
      ctx.fillStyle = changeColor;
      ctx.textAlign = 'left';
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillText(arrowText, labelX, y + offsetY);

      // Measure arrow width to position the value text
      const arrowWidth = ctx.measureText(arrowText).width;

      // Draw change value next to arrow
      ctx.fillText(textWithoutArrow, labelX + arrowWidth + 4 * scale, y + offsetY);

      logger.info(`Drew change indicator at y=${y + offsetY}, text="${changeText}"`);
    }
  }

  ctx.textAlign = 'left'; // Reset
}

/**
 * Options for taking a screenshot of the chart
 */
export interface ScreenshotOptions {
  /** Image format: 'png' (default), 'jpeg', or 'webp' */
  format?: "png" | "jpeg" | "webp";
  /** Quality for JPEG/WebP (0.0 to 1.0, default: 0.95) */
  quality?: number;
  /** Scaling factor (default: device pixel ratio) */
  scale?: number;
  /** Background color (default: transparent for PNG, white for JPEG) */
  backgroundColor?: string;
  /** Exclude crosshairs from screenshot (default: true) */
  excludeCrosshairs?: boolean;
  /** Exclude context menu from screenshot (default: true) */
  excludeContextMenu?: boolean;
  /** Optional fixed width in pixels */
  width?: number;
  /** Optional fixed height in pixels */
  height?: number;
}

/**
 * Capture a screenshot of the chart container
 * @param container The ChartContainer element to capture
 * @param options Screenshot options
 * @returns Promise that resolves to a data URL
 */
export async function captureChartScreenshot(
  container: ChartContainer,
  options?: ScreenshotOptions,
): Promise<string> {
  const opts: Required<
    Omit<ScreenshotOptions, "width" | "height" | "backgroundColor">
  > & {
    backgroundColor: string | null;
    width?: number;
    height?: number;
  } = {
    format: "png",
    quality: 0.95,
    scale: window.devicePixelRatio || 1,
    backgroundColor: null,
    excludeCrosshairs: true,
    excludeContextMenu: true,
    ...options,
  };

  // Use white background for JPEG by default (JPEG doesn't support transparency)
  if (opts.format === "jpeg" && opts.backgroundColor === null) {
    opts.backgroundColor = "#FFFFFF";
  }

  logger.info(`Capturing screenshot with format: ${opts.format}`);

  // Use the container element itself instead of drilling into shadow DOM
  // This avoids shadow DOM rendering issues with html2canvas
  const targetElement = container as unknown as HTMLElement;

  if (!targetElement) {
    throw new Error("Chart container not found");
  }

  // Get the chart wrapper element from the shadow DOM for hiding elements
  const chartWrapper = container.renderRoot.querySelector(
    ".chart-wrapper",
  ) as HTMLElement;

  // Get elements to potentially hide
  const crosshairs = container.renderRoot.querySelector(
    "chart-crosshairs",
  ) as HTMLElement;
  const contextMenu = container.renderRoot.querySelector(
    "chart-context-menu",
  ) as HTMLElement;

  // Store original display values
  const originalCrosshairsDisplay = crosshairs?.style.display;
  const originalContextMenuDisplay = contextMenu?.style.display;

  // Temporarily hide excluded elements
  if (opts.excludeCrosshairs && crosshairs) {
    crosshairs.style.display = "none";
  }
  if (opts.excludeContextMenu && contextMenu) {
    contextMenu.style.display = "none";
  }

  try {
    // Get the actual dimensions of the target element
    const rect = targetElement.getBoundingClientRect();
    const actualWidth = opts.width || rect.width;
    const actualHeight = opts.height || rect.height;

    logger.debug(
      `Chart container dimensions: ${actualWidth}x${actualHeight}`,
    );

    // Get the chart-wrapper element which contains everything
    if (!chartWrapper) {
      throw new Error("Chart wrapper not found");
    }

    // The chart-wrapper is the actual container that holds all visual elements
    // Use its bounding rect as the reference for positioning all elements
    const wrapperRect = chartWrapper.getBoundingClientRect();
    logger.info(`Chart wrapper rect: ${wrapperRect.width}x${wrapperRect.height} at (${wrapperRect.left}, ${wrapperRect.top})`);

    // Manual canvas composition approach for better Shadow DOM support
    // Find all canvases including those in nested shadow DOMs
    const canvases: HTMLCanvasElement[] = [];

    // Helper function to recursively find canvases in shadow DOM
    const findCanvases = (root: Document | ShadowRoot | Element | DocumentFragment) => {
      const foundCanvases = Array.from(root.querySelectorAll('canvas'));
      canvases.push(...foundCanvases);

      // Check for nested shadow roots
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) {
          findCanvases(el.shadowRoot);
        }
      });
    };

    // Start from the container's shadow root (can be ShadowRoot or DocumentFragment)
    findCanvases(container.renderRoot);

    logger.debug(`Found ${canvases.length} canvas elements (including nested)`);

    // Create composite canvas with exact wrapper dimensions
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = wrapperRect.width * opts.scale;
    compositeCanvas.height = wrapperRect.height * opts.scale;
    const ctx = compositeCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set background
    if (opts.backgroundColor) {
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
    }

    // Sort canvases by z-index and position to draw in correct order
    const canvasesWithInfo = canvases.map(sourceCanvas => {
      const canvasRect = sourceCanvas.getBoundingClientRect();
      const x = Math.round((canvasRect.left - wrapperRect.left) * opts.scale);
      const y = Math.round((canvasRect.top - wrapperRect.top) * opts.scale);
      const width = Math.round(canvasRect.width * opts.scale);
      const height = Math.round(canvasRect.height * opts.scale);

      return { sourceCanvas, canvasRect, x, y, width, height };
    }).filter(info => {
      // Only include canvases that are within the wrapper bounds
      const withinBounds =
        info.x < compositeCanvas.width &&
        info.y < compositeCanvas.height &&
        info.x + info.width > 0 &&
        info.y + info.height > 0;

      if (!withinBounds) {
        logger.debug(`Skipping canvas outside bounds: pos=(${info.x}, ${info.y})`);
      }
      return withinBounds;
    });

    logger.debug(`Drawing ${canvasesWithInfo.length} canvases within bounds`);

    // Draw each canvas onto the composite
    for (const { sourceCanvas, x, y, width, height } of canvasesWithInfo) {
      // Get parent element to identify canvas type
      const parentElement = sourceCanvas.closest('price-axis, timeline, candlestick-chart, volume-chart, chart-canvas');
      const canvasType = parentElement ? parentElement.tagName.toLowerCase() : 'unknown';

      logger.debug(
        `Drawing canvas: pos=(${x}, ${y}) size=${width}x${height} source=${sourceCanvas.width}x${sourceCanvas.height} type=${canvasType}`
      );

      try {
        ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, x, y, width, height);
      } catch (err) {
        logger.warn(`Failed to draw canvas:`, err);
      }
    }

    logger.info('Starting HTML overlay rendering...');

    // Manually render live price indicator and live candle display
    // These are HTML elements that html2canvas struggles with in shadow DOM

    // 1. Render live price indicator from price-axis
    // price-axis is nested inside the chart component
    const chartElement = container.renderRoot.querySelector('candlestick-chart');
    logger.info(`Found chart element: ${!!chartElement}`);
    let priceAxis = null;
    if (chartElement && (chartElement as any).shadowRoot) {
      priceAxis = (chartElement as any).shadowRoot.querySelector('price-axis');
    }
    logger.info(`Found price-axis: ${!!priceAxis}`);
    if (priceAxis) {
      logger.info(`price-axis has shadowRoot: ${!!(priceAxis as any).shadowRoot}`);
      if ((priceAxis as any).shadowRoot) {
        const livePriceLabel = (priceAxis as any).shadowRoot.querySelector('.live-price-label');
        logger.info(`Found live-price-label: ${!!livePriceLabel}`);
        if (livePriceLabel) {
          const rect = (livePriceLabel as HTMLElement).getBoundingClientRect();
          logger.info(`live-price-label rect: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top})`);
          const style = window.getComputedStyle(livePriceLabel as HTMLElement);
          logger.info(`live-price-label display: ${style.display}, visibility: ${style.visibility}`);
          try {
            drawLivePriceLabel(ctx, livePriceLabel as HTMLElement, wrapperRect, opts.scale);
            logger.info('Drew live price indicator');
          } catch (err) {
            logger.warn('Failed to draw live price indicator:', err);
          }
        }
      }
    }

    // 2. Render live candle display
    const liveCandleDisplay = container.renderRoot.querySelector('live-candle-display');
    logger.info(`Found live-candle-display: ${!!liveCandleDisplay}`);
    if (liveCandleDisplay) {
      logger.info(`live-candle-display has shadowRoot: ${!!(liveCandleDisplay as any).shadowRoot}`);
      if ((liveCandleDisplay as any).shadowRoot) {
        const displayContainer = (liveCandleDisplay as any).shadowRoot.querySelector('.display-container');
        logger.info(`Found display-container: ${!!displayContainer}`);
        if (displayContainer) {
          const rect = (displayContainer as HTMLElement).getBoundingClientRect();
          logger.info(`display-container rect: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top})`);
          const style = window.getComputedStyle(displayContainer as HTMLElement);
          logger.info(`display-container display: ${style.display}, visibility: ${style.visibility}`);
          try {
            drawLiveCandleDisplay(ctx, displayContainer as HTMLElement, wrapperRect, opts.scale);
            logger.info('Drew live candle display');
          } catch (err) {
            logger.warn('Failed to draw live candle display:', err);
          }
        }
      }
    }

    // 3. Render trend lines and pattern labels using html2canvas
    const svgOverlays = ['trend-line-layer', 'pattern-labels-layer'];
    for (const selector of svgOverlays) {
      const overlayElements = container.renderRoot.querySelectorAll(selector);

      for (const overlay of Array.from(overlayElements)) {
        try {
          const overlayRect = overlay.getBoundingClientRect();

          if (overlayRect.width === 0 || overlayRect.height === 0) {
            continue;
          }

          const overlayX = Math.round((overlayRect.left - wrapperRect.left) * opts.scale);
          const overlayY = Math.round((overlayRect.top - wrapperRect.top) * opts.scale);

          const overlayCanvas = await html2canvas(overlay as HTMLElement, {
            scale: opts.scale,
            backgroundColor: null,
            logging: false,
            width: overlayRect.width,
            height: overlayRect.height,
          });

          ctx.drawImage(overlayCanvas, overlayX, overlayY);
          logger.debug(`Drew ${selector}`);
        } catch (err) {
          logger.warn(`Failed to render ${selector}:`, err);
        }
      }
    }

    const canvas = compositeCanvas;

    // Convert to desired format
    const mimeType =
      opts.format === "jpeg"
        ? "image/jpeg"
        : opts.format === "webp"
          ? "image/webp"
          : "image/png";

    const dataUrl = canvas.toDataURL(mimeType, opts.quality);
    logger.info(`Screenshot captured successfully (${canvas.width}x${canvas.height})`);

    return dataUrl;
  } catch (error) {
    logger.error("Failed to capture screenshot", error);
    throw new Error(
      `Screenshot capture failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    // Restore hidden elements
    if (opts.excludeCrosshairs && crosshairs) {
      crosshairs.style.display = originalCrosshairsDisplay || "";
    }
    if (opts.excludeContextMenu && contextMenu) {
      contextMenu.style.display = originalContextMenuDisplay || "";
    }
  }
}

/**
 * Convert a data URL to a Blob
 * @param dataUrl The data URL to convert
 * @returns Blob containing the image data
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error("Invalid data URL format");
  }

  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}

/**
 * Download a screenshot data URL as a file
 * @param dataUrl The screenshot data URL
 * @param filename The filename to save as
 * @param format The image format (for extension)
 */
export async function downloadScreenshot(
  dataUrl: string,
  filename?: string,
  format?: string,
): Promise<void> {
  const link = document.createElement("a");
  const extension = format || "png";
  link.download = filename || `chart-${Date.now()}.${extension}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  logger.info(`Screenshot downloaded as ${link.download}`);
}
