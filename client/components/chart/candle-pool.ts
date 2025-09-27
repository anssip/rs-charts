import { CandleRenderer } from "./candle-renderer";
import { getLogger } from "../../util/logger";

const logger = getLogger("CandlePool");

/**
 * Object pool for CandleRenderer instances to avoid garbage collection pressure
 * during animation and frequent redraws.
 */
export class CandlePool {
  private readonly pool: CandleRenderer[] = [];
  private readonly activeCandles = new Map<number, CandleRenderer>();
  private readonly MAX_POOL_SIZE = 500; // Maximum pool size to prevent memory leaks

  // Shared pulse phase for synchronized animation when many candles are highlighted
  private sharedPulsePhase: number = 0;
  private readonly SHARED_PULSE_SPEED = 0.0035; // Same speed as individual pulses
  private highlightCount: number = 0;

  constructor() {
    // Pre-populate pool with some renderers
    for (let i = 0; i < 50; i++) {
      this.pool.push(new CandleRenderer());
    }
    logger.debug(`Initialized candle pool with ${this.pool.length} renderers`);
  }

  /**
   * Get or create a CandleRenderer for the given timestamp
   */
  getCandle(timestamp: number): CandleRenderer {
    // Check if we already have an active renderer for this timestamp
    let renderer = this.activeCandles.get(timestamp);

    if (!renderer) {
      // Try to get one from the pool, or create new if pool is empty
      renderer = this.pool.pop();

      if (!renderer) {
        renderer = new CandleRenderer();
      }

      this.activeCandles.set(timestamp, renderer);
    }

    return renderer;
  }

  /**
   * Set the number of highlighted candles for performance optimization
   */
  setHighlightCount(count: number) {
    this.highlightCount = count;
  }

  /**
   * Get the current shared pulse value for synchronized animation
   */
  getSharedPulse(): number {
    // Calculate pulse value from phase (0.2 to 1.0 range for dramatic effect)
    return 0.2 + 0.8 * Math.sin(this.sharedPulsePhase);
  }

  /**
   * Update all active candle renderers
   * Returns true if any renderer had significant changes
   */
  updateAll(deltaTime: number): boolean {
    let hasChanges = false;

    // Update shared pulse phase once for all highlighted candles
    if (this.highlightCount > 10) {
      const oldPhase = this.sharedPulsePhase;
      this.sharedPulsePhase += deltaTime * this.SHARED_PULSE_SPEED;

      // Keep phase in 0-2π range
      if (this.sharedPulsePhase > Math.PI * 2) {
        this.sharedPulsePhase -= Math.PI * 2;
      }

      // Check if shared pulse changed significantly
      if (
        Math.abs(Math.sin(oldPhase) - Math.sin(this.sharedPulsePhase)) > 0.02
      ) {
        hasChanges = true;
      }

      // When using shared pulse, skip individual updates for highlighted candles
      this.activeCandles.forEach((renderer) => {
        if (!renderer.highlightPattern) {
          // Only update non-highlighted candles individually
          if (renderer.update(deltaTime)) {
            hasChanges = true;
          }
        }
      });
    } else {
      // Normal update for small number of highlights
      this.activeCandles.forEach((renderer) => {
        if (renderer.update(deltaTime)) {
          hasChanges = true;
        }
      });
    }

    return hasChanges;
  }

  /**
   * Reset the pool - return inactive candles to the pool
   * Called at the start of each frame to prepare for new drawing
   * MUST preserve highlight state for highlighted candles
   */
  reset() {
    // More efficient reset - only return truly unused renderers
    const toReturn: CandleRenderer[] = [];
    const currentFrame = new Set<number>();

    // Track which timestamps are needed for this frame
    this.activeCandles.forEach((renderer, timestamp) => {
      currentFrame.add(timestamp);
    });

    // Only reset and return renderers that:
    // 1. Are not highlighted
    // 2. Are not going to be used in current frame
    this.activeCandles.forEach((renderer, timestamp) => {
      if (!renderer.highlightPattern && !currentFrame.has(timestamp)) {
        renderer.reset();
        if (this.pool.length < this.MAX_POOL_SIZE) {
          toReturn.push(renderer);
          this.activeCandles.delete(timestamp);
        }
      }
    });

    // Add returned renderers to pool
    toReturn.forEach((renderer) => this.pool.push(renderer));
  }

  /**
   * Get the number of active candles (for debugging)
   */
  getActiveCount(): number {
    return this.activeCandles.size;
  }

  /**
   * Get the pool size (for debugging)
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Clear the pool completely (for cleanup)
   */
  dispose() {
    this.activeCandles.clear();
    this.pool.length = 0;
    logger.debug("Candle pool disposed");
  }
}
