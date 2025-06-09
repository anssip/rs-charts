import { xin, observe } from "xinjs";

/**
 * Gets the local chart ID for a component by traversing up the DOM tree
 * to find its chart container parent, handling shadow DOM boundaries
 */
export function getLocalChartId(element: Element): string {
  let current: Element | null = element;
  let depth = 0;
  const maxDepth = 20;
  
  while (current && depth < maxDepth) {
    // Look for data-chart-id attribute on any element
    const chartId = current.getAttribute('data-chart-id');
    if (chartId) {
      return chartId;
    }
    
    // Also check for _chartId property on CHART-CONTAINER elements
    if (current.tagName === 'CHART-CONTAINER') {
      const propertyChartId = (current as any)._chartId;
      if (propertyChartId) {
        return propertyChartId;
      }
    }
    
    // Move to next parent element
    if (current.parentElement) {
      current = current.parentElement;
    } else if (current.parentNode) {
      // Check if this is a shadow root
      if (current.parentNode.nodeType === 11) {
        const shadowRoot = current.parentNode as ShadowRoot;
        if (shadowRoot.host) {
          current = shadowRoot.host;
        } else {
          break;
        }
      } else if ((current.parentNode as any).host) {
        // Fallback check for host property
        const host: Element = (current.parentNode as any).host;
        current = host;
      } else {
        break;
      }
    } else {
      // No more parents to check
      break;
    }
    depth++;
  }
  
  // Fallback to global state if no chart container found
  return 'state';
}

/**
 * Gets the local state for a component
 */
export function getLocalState(element: Element): any {
  const chartId = getLocalChartId(element);
  return xin[chartId];
}

/**
 * Creates an observer for local state
 */
export function observeLocal(element: Element, path: string, callback: (path: string) => void): void {
  const chartId = getLocalChartId(element);
  const fullPath = path.replace('state', chartId);
  observe(fullPath, callback);
}