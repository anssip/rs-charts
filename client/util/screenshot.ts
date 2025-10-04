import html2canvas from "html2canvas";
import { ChartContainer } from "../components/chart/chart-container";
import { getLogger } from "./logger";

const logger = getLogger("Screenshot");

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

    logger.debug(`Chart container dimensions: ${actualWidth}x${actualHeight}`);

    // Get the chart-wrapper element which contains everything
    if (!chartWrapper) {
      throw new Error("Chart wrapper not found");
    }

    // The chart-wrapper is the actual container that holds all visual elements
    // Use its bounding rect as the reference for positioning all elements
    const wrapperRect = chartWrapper.getBoundingClientRect();
    logger.info(
      `Chart wrapper rect: ${wrapperRect.width}x${wrapperRect.height} at (${wrapperRect.left}, ${wrapperRect.top})`,
    );

    // Manual canvas composition approach for better Shadow DOM support
    // Find all canvases including those in nested shadow DOMs
    const canvases: HTMLCanvasElement[] = [];

    // Helper function to recursively find canvases in shadow DOM
    const findCanvases = (
      root: Document | ShadowRoot | Element | DocumentFragment,
    ) => {
      const foundCanvases = Array.from(root.querySelectorAll("canvas"));
      canvases.push(...foundCanvases);

      // Check for nested shadow roots
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) {
          findCanvases(el.shadowRoot);
        }
      });
    };

    // Start from the container's shadow root (can be ShadowRoot or DocumentFragment)
    findCanvases(container.renderRoot);

    logger.debug(`Found ${canvases.length} canvas elements (including nested)`);

    // Create composite canvas with exact wrapper dimensions
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = wrapperRect.width * opts.scale;
    compositeCanvas.height = wrapperRect.height * opts.scale;
    const ctx = compositeCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Set background
    if (opts.backgroundColor) {
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
    }

    // Sort canvases by z-index and position to draw in correct order
    const canvasesWithInfo = canvases
      .map((sourceCanvas) => {
        const canvasRect = sourceCanvas.getBoundingClientRect();
        const x = Math.round((canvasRect.left - wrapperRect.left) * opts.scale);
        const y = Math.round((canvasRect.top - wrapperRect.top) * opts.scale);
        const width = Math.round(canvasRect.width * opts.scale);
        const height = Math.round(canvasRect.height * opts.scale);

        return { sourceCanvas, canvasRect, x, y, width, height };
      })
      .filter((info) => {
        // Only include canvases that are within the wrapper bounds
        const withinBounds =
          info.x < compositeCanvas.width &&
          info.y < compositeCanvas.height &&
          info.x + info.width > 0 &&
          info.y + info.height > 0;

        if (!withinBounds) {
          logger.debug(
            `Skipping canvas outside bounds: pos=(${info.x}, ${info.y})`,
          );
        }
        return withinBounds;
      });

    logger.debug(`Drawing ${canvasesWithInfo.length} canvases within bounds`);

    // Draw each canvas onto the composite
    for (const { sourceCanvas, x, y, width, height } of canvasesWithInfo) {
      // Get parent element to identify canvas type
      const parentElement = sourceCanvas.closest(
        "price-axis, timeline, candlestick-chart, volume-chart, chart-canvas",
      );
      const canvasType = parentElement
        ? parentElement.tagName.toLowerCase()
        : "unknown";

      logger.debug(
        `Drawing canvas: pos=(${x}, ${y}) size=${width}x${height} source=${sourceCanvas.width}x${sourceCanvas.height} type=${canvasType}`,
      );

      try {
        ctx.drawImage(
          sourceCanvas,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
          x,
          y,
          width,
          height,
        );
      } catch (err) {
        logger.warn(`Failed to draw canvas:`, err);
      }
    }

    logger.info("Starting HTML overlay rendering...");

    // Render HTML overlays using html2canvas
    // SVG-based overlays can be rendered directly
    const svgOverlays = ["trend-line-layer", "pattern-labels-layer"];

    for (const selector of svgOverlays) {
      const overlayElements = container.renderRoot.querySelectorAll(selector);

      for (const overlay of Array.from(overlayElements)) {
        try {
          const overlayRect = overlay.getBoundingClientRect();

          if (overlayRect.width === 0 || overlayRect.height === 0) {
            logger.debug(`Skipping ${selector} (zero size)`);
            continue;
          }

          const overlayX = Math.round(
            (overlayRect.left - wrapperRect.left) * opts.scale,
          );
          const overlayY = Math.round(
            (overlayRect.top - wrapperRect.top) * opts.scale,
          );

          const overlayCanvas = await html2canvas(overlay as HTMLElement, {
            scale: opts.scale,
            backgroundColor: null,
            logging: false,
            width: overlayRect.width,
            height: overlayRect.height,
          });

          ctx.drawImage(overlayCanvas, overlayX, overlayY);
          logger.debug(`Drew ${selector} at (${overlayX}, ${overlayY})`);
        } catch (err) {
          logger.warn(`Failed to render ${selector}:`, err);
        }
      }
    }

    // Render shadow DOM components by accessing their internal content
    const shadowDomComponents = [
      { selector: "live-candle-display", innerSelector: ".display-container" },
      { selector: "live-price-label", innerSelector: ".live-price-label" },
    ];

    for (const { selector, innerSelector } of shadowDomComponents) {
      const components = container.renderRoot.querySelectorAll(selector);

      for (const component of Array.from(components)) {
        try {
          const shadowRoot = (component as any).shadowRoot;
          if (!shadowRoot) {
            logger.debug(`No shadow root for ${selector}`);
            continue;
          }

          const innerElement = shadowRoot.querySelector(innerSelector);
          if (!innerElement) {
            logger.debug(`No inner element ${innerSelector} in ${selector}`);
            continue;
          }

          const overlayRect = (
            innerElement as HTMLElement
          ).getBoundingClientRect();

          if (overlayRect.width === 0 || overlayRect.height === 0) {
            logger.debug(`Skipping ${selector} (zero size)`);
            continue;
          }

          const overlayX = Math.round(
            (overlayRect.left - wrapperRect.left) * opts.scale,
          );
          const overlayY = Math.round(
            (overlayRect.top - wrapperRect.top) * opts.scale,
          );

          const overlayCanvas = await html2canvas(innerElement as HTMLElement, {
            scale: opts.scale,
            backgroundColor: null,
            logging: false,
            width: overlayRect.width,
            height: overlayRect.height,
          });

          ctx.drawImage(overlayCanvas, overlayX, overlayY);
          logger.debug(`Drew ${selector} at (${overlayX}, ${overlayY})`);
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
    logger.info(
      `Screenshot captured successfully (${canvas.width}x${canvas.height})`,
    );

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
