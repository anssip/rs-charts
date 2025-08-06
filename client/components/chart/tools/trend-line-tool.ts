import { TrendLine, TrendLinePoint } from "../../../types/trend-line";
import { ChartState } from "../../..";

export class TrendLineTool {
  private isActive = false;
  private firstPoint: TrendLinePoint | null = null;
  private container: HTMLElement;
  private previewLine: SVGLineElement | null = null;
  private previewSvg: SVGSVGElement | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private moveHandler: ((event: MouseEvent) => void) | null = null;
  private escapeHandler: ((event: KeyboardEvent) => void) | null = null;
  private getState: () => ChartState;
  private priceAxisWidth: number;
  private getChartCanvas: () => HTMLCanvasElement | null;
  
  constructor(container: HTMLElement, getState: () => ChartState, priceAxisWidth: number = 70, getChartCanvas?: () => HTMLCanvasElement | null) {
    this.container = container;
    this.getState = getState;
    this.priceAxisWidth = priceAxisWidth;
    this.getChartCanvas = getChartCanvas || (() => null);
  }

  activate(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.firstPoint = null;
    this.createPreviewElements();
    
    // Add event listeners
    this.clickHandler = this.handleClick.bind(this);
    this.moveHandler = this.handleMouseMove.bind(this);
    this.escapeHandler = this.handleEscape.bind(this);
    
    this.container.addEventListener('click', this.clickHandler);
    this.container.addEventListener('mousemove', this.moveHandler);
    document.addEventListener('keydown', this.escapeHandler);
    
    // Change cursor
    this.container.style.cursor = 'crosshair';
    
    // Dispatch activation event
    this.container.dispatchEvent(new CustomEvent('trend-line-tool-activated', {
      bubbles: true,
      composed: true
    }));
  }

  deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.firstPoint = null;
    this.removePreviewElements();
    
    // Remove event listeners
    if (this.clickHandler) {
      this.container.removeEventListener('click', this.clickHandler);
    }
    if (this.moveHandler) {
      this.container.removeEventListener('mousemove', this.moveHandler);
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }
    
    // Reset cursor
    this.container.style.cursor = '';
    
    // Dispatch deactivation event
    this.container.dispatchEvent(new CustomEvent('trend-line-tool-deactivated', {
      bubbles: true,
      composed: true
    }));
  }

  isToolActive(): boolean {
    return this.isActive;
  }

  private handleClick(event: MouseEvent): void {
    if (!this.isActive) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const point = this.getPointFromEvent(event);
    
    if (!this.firstPoint) {
      // First click - set start point
      this.firstPoint = point;
      this.showPreview(event);
    } else {
      // Second click - create trend line
      const trendLine = this.createTrendLine(this.firstPoint, point);
      
      // Dispatch event to add the trend line
      this.container.dispatchEvent(new CustomEvent('trend-line-created', {
        detail: { trendLine },
        bubbles: true,
        composed: true
      }));
      
      // Reset for next line
      this.firstPoint = null;
      this.hidePreview();
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isActive || !this.firstPoint) return;
    
    this.updatePreview(event);
  }

  private handleEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isActive) {
      if (this.firstPoint) {
        // Cancel current drawing
        this.firstPoint = null;
        this.hidePreview();
      } else {
        // Deactivate tool
        this.deactivate();
      }
    }
  }

  private getPointFromEvent(event: MouseEvent): TrendLinePoint {
    const rect = this.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Get the chart state using the provided function
    const chartState = this.getState();
    if (!chartState || !chartState.timeRange || !chartState.priceRange) {
      throw new Error('Chart state not available');
    }
    
    // The actual chart drawing area width excludes the price axis
    const chartWidth = rect.width - this.priceAxisWidth;
    
    // Use the actual canvas height if available, otherwise fall back to container height
    const canvas = this.getChartCanvas();
    const chartHeight = canvas ? canvas.height / (window.devicePixelRatio || 1) : rect.height;
    
    const timestamp = this.xToTime(x, chartWidth, chartState.timeRange);
    const price = this.yToPrice(y, chartHeight, chartState.priceRange);
    
    return { timestamp, price };
  }

  private xToTime(x: number, width: number, timeRange: { start: number; end: number }): number {
    const range = timeRange.end - timeRange.start;
    return timeRange.start + (x / width) * range;
  }

  private yToPrice(y: number, height: number, priceRange: { min: number; max: number }): number {
    const range = priceRange.max - priceRange.min;
    return priceRange.min + ((height - y) / height) * range;
  }

  private timeToX(timestamp: number, width: number, timeRange: { start: number; end: number }): number {
    const range = timeRange.end - timeRange.start;
    return ((timestamp - timeRange.start) / range) * width;
  }

  private priceToY(price: number, height: number, priceRange: { min: number; max: number }): number {
    const range = priceRange.max - priceRange.min;
    return height - ((price - priceRange.min) / range) * height;
  }

  private createPreviewElements(): void {
    if (this.previewSvg) return;
    
    this.previewSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.previewSvg.style.position = 'absolute';
    this.previewSvg.style.top = '0';
    this.previewSvg.style.left = '0';
    this.previewSvg.style.width = `calc(100% - ${this.priceAxisWidth}px)`;
    this.previewSvg.style.height = '100%';
    this.previewSvg.style.pointerEvents = 'none';
    this.previewSvg.style.zIndex = '1000';
    
    this.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.previewLine.setAttribute('stroke', '#2962ff');
    this.previewLine.setAttribute('stroke-width', '2');
    this.previewLine.setAttribute('stroke-dasharray', '5,5');
    this.previewLine.style.display = 'none';
    
    this.previewSvg.appendChild(this.previewLine);
    this.container.appendChild(this.previewSvg);
  }

  private removePreviewElements(): void {
    if (this.previewSvg) {
      this.previewSvg.remove();
      this.previewSvg = null;
      this.previewLine = null;
    }
  }

  private showPreview(event: MouseEvent): void {
    if (!this.previewLine || !this.firstPoint) return;
    
    const rect = this.container.getBoundingClientRect();
    const chartState = this.getState();
    if (!chartState || !chartState.timeRange || !chartState.priceRange) return;
    
    // Use the chart width (excluding price axis) for X coordinate calculation
    const chartWidth = rect.width - this.priceAxisWidth;
    
    // Use the actual canvas height if available
    const canvas = this.getChartCanvas();
    const chartHeight = canvas ? canvas.height / (window.devicePixelRatio || 1) : rect.height;
    
    const x1 = this.timeToX(this.firstPoint.timestamp, chartWidth, chartState.timeRange);
    const y1 = this.priceToY(this.firstPoint.price, chartHeight, chartState.priceRange);
    
    this.previewLine.setAttribute('x1', x1.toString());
    this.previewLine.setAttribute('y1', y1.toString());
    this.previewLine.style.display = 'block';
    
    this.updatePreview(event);
  }

  private updatePreview(event: MouseEvent): void {
    if (!this.previewLine || !this.firstPoint) return;
    
    const rect = this.container.getBoundingClientRect();
    const x2 = event.clientX - rect.left;
    const y2 = event.clientY - rect.top;
    
    this.previewLine.setAttribute('x2', x2.toString());
    this.previewLine.setAttribute('y2', y2.toString());
  }

  private hidePreview(): void {
    if (this.previewLine) {
      this.previewLine.style.display = 'none';
    }
  }

  private createTrendLine(startPoint: TrendLinePoint, endPoint: TrendLinePoint): Omit<TrendLine, 'id'> {
    return {
      startPoint,
      endPoint,
      extendLeft: false,
      extendRight: false,
      color: '#2962ff',
      lineWidth: 2,
      style: 'solid'
    };
  }
}