import { CandleRenderer } from "./candle-renderer";
import { getLogger } from "../../util/logger";

const logger = getLogger("CandlePool");

/**
 * Object pool for CandleRenderer instances to avoid garbage collection pressure
 * during frequent redraws.
 */
export class CandlePool {
  private readonly pool: CandleRenderer[] = [];
  private readonly activeCandles = new Map<number, CandleRenderer>();
  private readonly MAX_POOL_SIZE = 500; // Maximum pool size to prevent memory leaks

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
