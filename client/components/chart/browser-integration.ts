import { getLogger } from "../../util/logger";

const logger = getLogger("BrowserIntegration");

/**
 * BrowserIntegration handles platform-specific concerns for the chart component:
 * - Zoom prevention (keyboard and wheel)
 * - Focus handling
 * - Mobile detection
 */
export class BrowserIntegration {
  private handlers: {
    keydown?: (e: KeyboardEvent) => void;
    wheel?: (e: WheelEvent) => boolean | undefined;
    documentKeydown?: (e: KeyboardEvent) => void;
    focus?: () => void;
  } = {};

  private mobileMediaQuery: MediaQueryList;
  private mobileChangeHandler?: () => void;

  constructor(
    private element: HTMLElement,
    private shadowRoot: ShadowRoot,
  ) {
    // Initialize mobile media query
    this.mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  }

  /**
   * Setup keyboard and wheel zoom prevention
   */
  setupZoomPrevention(): void {
    // Prevent keyboard zoom shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd) {
        // Prevent Ctrl/Cmd + Plus/Minus/0 (zoom controls)
        if (
          e.key === "+" ||
          e.key === "-" ||
          e.key === "=" || // Plus key without shift
          e.key === "0" ||
          e.keyCode === 187 || // Plus/Equals key
          e.keyCode === 189 || // Minus key
          e.keyCode === 48 // Zero key
        ) {
          e.preventDefault();
          logger.debug("Prevented browser zoom keyboard shortcut");
          return false;
        }
      }
    };

    // Prevent wheel zoom with Ctrl/Cmd
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        logger.debug("Prevented browser zoom wheel event");
        return false;
      }
    };

    // Add listeners to the component and its shadow root
    this.element.addEventListener("keydown", handleKeydown);
    this.element.addEventListener("wheel", handleWheel, { passive: false });

    // Also add to the document when this element has focus
    const documentKeydownHandler = (e: KeyboardEvent) => {
      // Only prevent if the chart container or its children have focus
      if (
        this.element.contains(document.activeElement) ||
        this.shadowRoot?.contains(document.activeElement as Element)
      ) {
        handleKeydown(e);
      }
    };

    document.addEventListener("keydown", documentKeydownHandler);

    // Store handlers for cleanup
    this.handlers.keydown = handleKeydown;
    this.handlers.wheel = handleWheel;
    this.handlers.documentKeydown = documentKeydownHandler;
  }

  /**
   * Setup focus handler to redraw chart when window gains focus
   */
  setupFocusHandler(onFocus: () => void): void {
    const handleFocus = () => {
      onFocus();
    };

    window.addEventListener("focus", handleFocus);
    this.handlers.focus = handleFocus;
  }

  /**
   * Setup mobile detection with callback for changes
   * @returns MediaQueryList for external access if needed
   */
  setupMobileDetection(onChange: (isMobile: boolean) => void): MediaQueryList {
    // Call immediately with current state
    onChange(this.mobileMediaQuery.matches);

    // Setup change handler
    this.mobileChangeHandler = () => {
      onChange(this.mobileMediaQuery.matches);
    };

    this.mobileMediaQuery.addEventListener("change", this.mobileChangeHandler);

    return this.mobileMediaQuery;
  }

  /**
   * Check if device is touch-only (no mouse/trackpad)
   */
  isTouchOnlyDevice(): boolean {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }

  /**
   * Cleanup all event listeners
   */
  cleanup(): void {
    // Remove zoom prevention handlers
    if (this.handlers.keydown) {
      this.element.removeEventListener("keydown", this.handlers.keydown);
    }
    if (this.handlers.wheel) {
      this.element.removeEventListener("wheel", this.handlers.wheel);
    }
    if (this.handlers.documentKeydown) {
      document.removeEventListener("keydown", this.handlers.documentKeydown);
    }

    // Remove focus handler
    if (this.handlers.focus) {
      window.removeEventListener("focus", this.handlers.focus);
    }

    // Remove mobile detection handler
    if (this.mobileChangeHandler) {
      this.mobileMediaQuery.removeEventListener("change", this.mobileChangeHandler);
    }

    // Clear handlers
    this.handlers = {};
    this.mobileChangeHandler = undefined;
  }
}
