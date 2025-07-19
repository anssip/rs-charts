// test-setup.ts
// Mock DOM globals for Bun test environment

// Basic DOM globals that web components need
globalThis.HTMLElement = class HTMLElement {
  constructor() {
    this.children = [];
    this.childNodes = [];
    this.parentElement = null;
    this.parentNode = null;
    this.nextSibling = null;
    this.previousSibling = null;
    this.firstChild = null;
    this.lastChild = null;
    this.classList = {
      contains: () => false,
      add: () => {},
      remove: () => {},
      toggle: () => false,
    };
    this.style = {};
    this.attributes = {};
    this.dataset = {};
  }

  appendChild(child: any) {
    this.children.push(child);
    return child;
  }

  removeChild(child: any) {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
    }
    return child;
  }

  setAttribute(name: string, value: string) {
    this[name] = value;
  }

  getAttribute(name: string) {
    return this[name];
  }

  removeAttribute(name: string) {
    delete this[name];
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }

  querySelector() { return null; }
  querySelectorAll() { return []; }
  
  closest(selector: string) { return null; }
  matches(selector: string) { return false; }
  
  insertBefore(newNode: any, referenceNode: any) {
    return newNode;
  }
  
  replaceChild(newChild: any, oldChild: any) {
    return oldChild;
  }
  
  cloneNode(deep?: boolean) {
    return new HTMLElement();
  }
  
  hasAttribute(name: string) {
    return name in this.attributes;
  }
  
  get textContent() { return ''; }
  set textContent(value: string) {}
  
  get innerHTML() { return ''; }
  set innerHTML(value: string) {}
  
  get outerHTML() { return ''; }
  set outerHTML(value: string) {}

  requestFullscreen() {
    return Promise.resolve();
  }
};

globalThis.Element = HTMLElement;

globalThis.customElements = {
  define: () => {},
  get: () => undefined,
  whenDefined: () => Promise.resolve(),
  upgrade: () => {},
};

// Mock ShadowRoot for web components
globalThis.ShadowRoot = class ShadowRoot extends HTMLElement {
  constructor() {
    super();
    this.mode = 'open';
    this.host = null;
  }
};

// Mock Event classes
globalThis.Event = class Event {
  constructor(type: string, options?: any) {
    this.type = type;
    this.bubbles = options?.bubbles || false;
    this.cancelable = options?.cancelable || false;
    this.composed = options?.composed || false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this.defaultPrevented = false;
  }
  
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
  stopImmediatePropagation() {}
};

globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type: string, options?: any) {
    super(type, options);
    this.detail = options?.detail || null;
  }
};

globalThis.document = {
  createElement: (tagName: string) => {
    const element = new HTMLElement();
    element.tagName = tagName.toUpperCase();
    return element;
  },
  
  head: {
    append: () => {},
    appendChild: () => {},
  },
  
  body: {
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  
  fullscreenElement: null,
  exitFullscreen: () => Promise.resolve(),
  
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  
  createEvent: () => ({
    initEvent: () => {},
    preventDefault: () => {},
    stopPropagation: () => {},
  }),
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  requestAnimationFrame: (callback: Function) => {
    setTimeout(callback, 16);
    return 1;
  },
  cancelAnimationFrame: () => {},
  devicePixelRatio: 1,
  innerWidth: 1024,
  innerHeight: 768,
  location: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
};

// Mock Canvas API for chart drawing tests
const createCanvasContext = () => ({
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  arc: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  setTransform: () => {},
  drawImage: () => {},
  measureText: () => ({ width: 50 }),
  createLinearGradient: () => ({
    addColorStop: () => {},
  }),
  createRadialGradient: () => ({
    addColorStop: () => {},
  }),
  getImageData: () => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  }),
  putImageData: () => {},
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
});

globalThis.HTMLCanvasElement = class HTMLCanvasElement extends HTMLElement {
  constructor() {
    super();
    this.width = 300;
    this.height = 150;
  }

  getContext(contextType: string) {
    if (contextType === '2d') {
      return createCanvasContext();
    }
    return null;
  }

  toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  }

  toBlob(callback: Function) {
    setTimeout(() => callback(new Blob([''], { type: 'image/png' })), 0);
  }
};

// Mock ResizeObserver for responsive components
globalThis.ResizeObserver = class ResizeObserver {
  constructor(callback: Function) {
    this.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver for visibility detection
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor(callback: Function, options?: any) {
    this.callback = callback;
    this.options = options;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock MutationObserver for DOM change detection
globalThis.MutationObserver = class MutationObserver {
  constructor(callback: Function) {
    this.callback = callback;
  }

  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Mock CSS-related globals
globalThis.CSSStyleDeclaration = class CSSStyleDeclaration {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        return target[prop] || '';
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    });
  }
};

// Mock performance API
globalThis.performance = {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {},
  getEntriesByType: () => [],
  getEntriesByName: () => [],
};

// Mock URL and URLSearchParams
globalThis.URL = class URL {
  constructor(url: string, base?: string) {
    this.href = url;
    this.origin = 'http://localhost:3000';
    this.protocol = 'http:';
    this.host = 'localhost:3000';
    this.hostname = 'localhost';
    this.port = '3000';
    this.pathname = '/';
    this.search = '';
    this.hash = '';
  }
};

globalThis.URLSearchParams = class URLSearchParams {
  constructor(init?: string) {
    this.params = new Map();
  }

  get(name: string) { return this.params.get(name); }
  set(name: string, value: string) { this.params.set(name, value); }
  has(name: string) { return this.params.has(name); }
  delete(name: string) { this.params.delete(name); }
  toString() { return ''; }
};

// Mock fetch for API calls in tests
globalThis.fetch = async (url: string, options?: any) => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    text: async () => '',
    blob: async () => new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    headers: {
      get: () => null,
      has: () => false,
    },
  };
};

// Mock WebSocket for real-time data
globalThis.WebSocket = class WebSocket {
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
  }

  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
};

// Mock localStorage and sessionStorage
const createStorage = () => {
  const storage = new Map();
  return {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    length: 0,
    key: () => null,
  };
};

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();

// Mock console if needed
if (!globalThis.console) {
  globalThis.console = {
    log: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    group: () => {},
    groupEnd: () => {},
    time: () => {},
    timeEnd: () => {},
    assert: () => {},
    table: () => {},
    clear: () => {},
    count: () => {},
    countReset: () => {},
    dir: () => {},
    dirxml: () => {},
    profile: () => {},
    profileEnd: () => {},
  };
}

// Suppress common warnings in test environment
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args[0]?.toString?.() || '';
  
  // Suppress web component related warnings during tests
  if (
    message.includes('customElements') ||
    message.includes('HTMLElement') ||
    message.includes('custom element') ||
    message.includes('shadow DOM')
  ) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};

export {};