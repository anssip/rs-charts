import { ChartState } from "../../..";
import { getLogger, LogLevel } from "../../../util/logger";
import {
  OrderRequestData,
  PriceHoverEvent,
  ClickToTradeConfig,
} from "../../../types/trading-overlays";

const logger = getLogger("ClickToTradeController");
logger.setLoggerLevel("ClickToTradeController", LogLevel.INFO);

interface ClickToTradeControllerOptions {
  container: HTMLElement;
  state: ChartState;
  config: ClickToTradeConfig;
  onOrderRequest: (data: OrderRequestData) => void;
  onPriceHover: (data: PriceHoverEvent) => void;
}

export class ClickToTradeController {
  private readonly options: ClickToTradeControllerOptions;
  private readonly container: HTMLElement;
  private enabled = false;

  // Click detection state
  private mouseDownX = 0;
  private mouseDownY = 0;
  private mouseDownTime = 0;
  private readonly dragThreshold = 5; // pixels - same as ChartInteractionController
  private readonly doubleClickDelay = 300; // milliseconds
  private lastClickTime = 0;
  private clickCount = 0;

  // Hover state
  private lastHoverPrice: number | null = null;
  private lastHoverTimestamp: number | null = null;
  private hoverThrottleTimeout: number | null = null;
  private readonly hoverThrottleMs = 50; // Throttle hover events

  constructor(options: ClickToTradeControllerOptions) {
    this.options = options;
    this.container = options.container;
  }

  /**
   * Enable click-to-trade mode and attach event listeners
   */
  enable(): void {
    if (this.enabled) return;

    logger.info("Enabling click-to-trade mode");
    this.enabled = true;

    // Attach event listeners
    this.container.addEventListener("mousedown", this.handleMouseDown);
    this.container.addEventListener("mouseup", this.handleMouseUp);
    this.container.addEventListener("mousemove", this.handleMouseMove);
    this.container.addEventListener("mouseleave", this.handleMouseLeave);

    // Visual feedback: Add a CSS class to the container
    this.container.classList.add("click-to-trade-enabled");
  }

  /**
   * Disable click-to-trade mode and detach event listeners
   */
  disable(): void {
    if (!this.enabled) return;

    logger.info("Disabling click-to-trade mode");
    this.enabled = false;

    // Detach event listeners
    this.container.removeEventListener("mousedown", this.handleMouseDown);
    this.container.removeEventListener("mouseup", this.handleMouseUp);
    this.container.removeEventListener("mousemove", this.handleMouseMove);
    this.container.removeEventListener("mouseleave", this.handleMouseLeave);

    // Remove visual feedback
    this.container.classList.remove("click-to-trade-enabled");

    // Clear any pending throttle
    if (this.hoverThrottleTimeout) {
      clearTimeout(this.hoverThrottleTimeout);
      this.hoverThrottleTimeout = null;
    }
  }

  /**
   * Check if click-to-trade is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Update the configuration
   */
  updateConfig(config: ClickToTradeConfig): void {
    this.options.config = config;

    // If config is disabled, disable the controller
    if (!config.enabled && this.enabled) {
      this.disable();
    }
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.enabled) return;

    // Store the mouse down position and time for click detection
    this.mouseDownX = e.clientX;
    this.mouseDownY = e.clientY;
    this.mouseDownTime = Date.now();
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.enabled) return;

    const config = this.options.config;

    // Calculate movement since mouse down
    const deltaX = e.clientX - this.mouseDownX;
    const deltaY = e.clientY - this.mouseDownY;
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check if this was a click (not a drag)
    if (totalMovement > this.dragThreshold) {
      logger.debug("Movement exceeded drag threshold, ignoring click");
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    // Handle click behavior based on config
    const clickBehavior = config.clickBehavior || "single";

    if (clickBehavior === "double") {
      // Double-click required
      if (timeSinceLastClick < this.doubleClickDelay) {
        // This is the second click
        this.clickCount = 0;
        this.lastClickTime = 0;
        this.emitOrderRequest(e);
      } else {
        // This is the first click
        this.clickCount = 1;
        this.lastClickTime = now;
      }
    } else if (clickBehavior === "hold") {
      // Hold behavior - check if mouse was held down long enough
      const holdDuration = now - this.mouseDownTime;
      const requiredHoldTime = 500; // milliseconds

      if (holdDuration >= requiredHoldTime) {
        this.emitOrderRequest(e);
      } else {
        logger.debug(
          `Hold duration ${holdDuration}ms < required ${requiredHoldTime}ms`,
        );
      }
    } else {
      // Single click (default)
      this.emitOrderRequest(e);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return;

    const config = this.options.config;
    if (config.showPriceLabel === false && config.showOrderPreview === false) {
      // No need to track hover if we're not showing anything
      return;
    }

    // Throttle hover events to avoid too many updates
    if (this.hoverThrottleTimeout) {
      return;
    }

    this.hoverThrottleTimeout = setTimeout(() => {
      this.hoverThrottleTimeout = null;
    }, this.hoverThrottleMs) as unknown as number;

    // Convert mouse position to price/timestamp
    const coordinates = this.mouseToChartCoordinates(e);
    if (!coordinates) return;

    const { price, timestamp } = coordinates;

    // Only emit if price or timestamp changed significantly
    const priceChanged =
      !this.lastHoverPrice ||
      Math.abs(price - this.lastHoverPrice) > price * 0.0001;
    const timestampChanged =
      !this.lastHoverTimestamp ||
      Math.abs(timestamp - this.lastHoverTimestamp) > 1000;

    if (priceChanged || timestampChanged) {
      this.lastHoverPrice = price;
      this.lastHoverTimestamp = timestamp;

      // Emit price-hover event
      const hoverData: PriceHoverEvent = { price, timestamp };
      this.options.onPriceHover(hoverData);

      // Also dispatch as CustomEvent for other listeners
      this.container.dispatchEvent(
        new CustomEvent("price-hover", {
          detail: hoverData,
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private handleMouseLeave = (): void => {
    if (!this.enabled) return;

    // Reset hover state
    this.lastHoverPrice = null;
    this.lastHoverTimestamp = null;

    // Clear throttle timeout
    if (this.hoverThrottleTimeout) {
      clearTimeout(this.hoverThrottleTimeout);
      this.hoverThrottleTimeout = null;
    }
  };

  /**
   * Emit an order request event based on the mouse click
   */
  private emitOrderRequest(e: MouseEvent): void {
    const coordinates = this.mouseToChartCoordinates(e);
    if (!coordinates) {
      logger.error("Failed to convert mouse position to chart coordinates");
      return;
    }

    const { price, timestamp } = coordinates;
    const config = this.options.config;

    // Determine order side based on default + modifier keys
    const defaultSide = config.defaultSide || "buy";
    const allowSideToggle = config.allowSideToggle !== false; // default true

    let side: "buy" | "sell" = defaultSide;

    // Toggle side if Shift is pressed and toggle is allowed
    if (allowSideToggle && e.shiftKey) {
      side = defaultSide === "buy" ? "sell" : "buy";
    }

    // Create order request data
    const orderData: OrderRequestData = {
      price,
      timestamp,
      side,
      modifiers: {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey, // Support Cmd on Mac
        alt: e.altKey,
      },
    };

    logger.info("Order request:", orderData);

    // Call the callback
    this.options.onOrderRequest(orderData);

    // Also dispatch as CustomEvent for other listeners
    this.container.dispatchEvent(
      new CustomEvent("order-request", {
        detail: orderData,
        bubbles: true,
        composed: true,
      }),
    );

    // Call the optional onOrderRequest callback in config
    if (config.onOrderRequest) {
      config.onOrderRequest(orderData);
    }
  }

  /**
   * Convert mouse event coordinates to chart price/timestamp
   */
  private mouseToChartCoordinates(
    e: MouseEvent,
  ): { price: number; timestamp: number } | null {
    const state = this.options.state;
    const rect = this.container.getBoundingClientRect();

    // Calculate relative position within container
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert X to timestamp
    const timeRange = state.timeRange.end - state.timeRange.start;
    const timestamp = state.timeRange.start + (x / rect.width) * timeRange;

    // Convert Y to price
    // Note: Y coordinates are inverted (0 = top = high price)
    const priceRange = state.priceRange.max - state.priceRange.min;
    const price = state.priceRange.max - (y / rect.height) * priceRange;

    return { price, timestamp };
  }
}
