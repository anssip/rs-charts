// React Chart Example - Advanced Chart API Integration
// This example demonstrates how to use the Chart API in a React application

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { 
  initChartWithApi, 
  createChartContainer, 
  ChartState, 
  ChartContainer, 
  App, 
  ChartApi,
  Granularity,
  getAllGranularities,
  granularityLabel,
  ApiIndicatorConfig
} from '@anssipiirainen/sc-charts';

// Types for the chart component
interface ChartApiComponentProps {
  firebaseConfig: any;
  initialState?: Partial<ChartState>;
  className?: string;
  style?: React.CSSProperties;
  onSymbolChange?: (symbol: string) => void;
  onGranularityChange?: (granularity: Granularity) => void;
  onIndicatorChange?: (indicators: string[]) => void;
  onFullscreenChange?: (isFullscreen: boolean, type: 'fullscreen' | 'fullwindow') => void;
}

interface ChartApiComponentRef {
  api: ChartApi | null;
  app: App | null;
  setSymbol: (symbol: string) => Promise<void>;
  setGranularity: (granularity: Granularity) => Promise<void>;
  showIndicator: (config: ApiIndicatorConfig) => void;
  hideIndicator: (id: string) => void;
  toggleIndicator: (id: string, config?: Partial<ApiIndicatorConfig>) => void;
  setIndicators: (indicators: ApiIndicatorConfig[]) => void;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  enterFullWindow: () => void;
  exitFullWindow: () => void;
  toggleFullWindow: () => void;
  redraw: () => void;
  getState: () => ChartState;
  isLoading: () => boolean;
}

// Main Chart Component with API
const ChartApiComponent = forwardRef<ChartApiComponentRef, ChartApiComponentProps>(({
  firebaseConfig,
  initialState,
  className,
  style,
  onSymbolChange,
  onGranularityChange,
  onIndicatorChange,
  onFullscreenChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartContainer | null>(null);
  const appRef = useRef<App | null>(null);
  const apiRef = useRef<ChartApi | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expose API methods through ref
  useImperativeHandle(ref, () => ({
    api: apiRef.current,
    app: appRef.current,
    setSymbol: async (symbol: string) => {
      await apiRef.current?.setSymbol(symbol);
    },
    setGranularity: async (granularity: Granularity) => {
      await apiRef.current?.setGranularity(granularity);
    },
    showIndicator: (config: ApiIndicatorConfig) => {
      apiRef.current?.showIndicator(config);
    },
    hideIndicator: (id: string) => {
      apiRef.current?.hideIndicator(id);
    },
    toggleIndicator: (id: string, config?: Partial<ApiIndicatorConfig>) => {
      apiRef.current?.toggleIndicator(id, config);
    },
    setIndicators: (indicators: ApiIndicatorConfig[]) => {
      apiRef.current?.setIndicators(indicators);
    },
    enterFullscreen: async () => {
      await apiRef.current?.enterFullscreen();
    },
    exitFullscreen: async () => {
      await apiRef.current?.exitFullscreen();
    },
    toggleFullscreen: async () => {
      await apiRef.current?.toggleFullscreen();
    },
    enterFullWindow: () => {
      apiRef.current?.enterFullWindow();
    },
    exitFullWindow: () => {
      apiRef.current?.exitFullWindow();
    },
    toggleFullWindow: () => {
      apiRef.current?.toggleFullWindow();
    },
    redraw: () => {
      apiRef.current?.redraw();
    },
    getState: () => {
      return apiRef.current?.getState() || {} as ChartState;
    },
    isLoading: () => {
      return apiRef.current?.isLoading() || false;
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const initializeChart = async () => {
      try {
        setError(null);
        
        // Create and append chart container
        const chartContainer = createChartContainer();
        chartRef.current = chartContainer;
        containerRef.current.appendChild(chartContainer);

        // Initialize the chart with API
        const { app, api } = await initChartWithApi(chartContainer, firebaseConfig, initialState);
        appRef.current = app;
        apiRef.current = api;

        // Set up event listeners
        api.on('symbolChange', (data: any) => {
          onSymbolChange?.(data.newSymbol);
        });

        api.on('granularityChange', (data: any) => {
          onGranularityChange?.(data.newGranularity);
        });

        api.on('indicatorChange', (data: any) => {
          const visibleIndicators = api.getVisibleIndicators().map(i => i.id);
          onIndicatorChange?.(visibleIndicators);
        });

        api.on('fullscreenChange', (data: any) => {
          if (data.type === 'fullscreen') {
            onFullscreenChange?.(data.isFullscreen, 'fullscreen');
          } else if (data.type === 'fullwindow') {
            onFullscreenChange?.(data.isFullWindow, 'fullwindow');
          }
        });

        setIsInitialized(true);

      } catch (error) {
        console.error('Failed to initialize chart:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    initializeChart();

    return () => {
      // Cleanup on unmount
      if (appRef.current) {
        appRef.current.cleanup();
      }
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      if (chartRef.current && containerRef.current && containerRef.current.contains(chartRef.current)) {
        containerRef.current.removeChild(chartRef.current);
      }
    };
  }, [firebaseConfig, initialState, onSymbolChange, onGranularityChange, onIndicatorChange, onFullscreenChange]);

  if (error) {
    return (
      <div className={className} style={style}>
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
          Error initializing chart: {error}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={style}
      data-chart-initialized={isInitialized}
    />
  );
});

ChartApiComponent.displayName = 'ChartApiComponent';

// Example usage component
const TradingDashboard: React.FC = () => {
  const chartRef = useRef<ChartApiComponentRef>(null);
  const [currentSymbol, setCurrentSymbol] = useState('BTC-USD');
  const [currentGranularity, setCurrentGranularity] = useState<Granularity>('ONE_HOUR');
  const [visibleIndicators, setVisibleIndicators] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const firebaseConfig = {
    projectId: "your-project-id",
    apiKey: "your-api-key", 
    authDomain: "your-domain.firebaseapp.com",
  };

  const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD'];
  const granularities = getAllGranularities();
  
  const indicators = [
    { id: 'volume', name: 'Volume' },
    { id: 'rsi', name: 'RSI' },
    { id: 'macd', name: 'MACD' },
    { id: 'bb', name: 'Bollinger Bands' },
    { id: 'sma', name: 'SMA' },
    { id: 'ema', name: 'EMA' },
  ];

  const handleSymbolChange = useCallback(async (symbol: string) => {
    if (!chartRef.current) return;
    
    setIsLoading(true);
    try {
      await chartRef.current.setSymbol(symbol);
    } catch (error) {
      console.error('Failed to change symbol:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGranularityChange = useCallback(async (granularity: Granularity) => {
    if (!chartRef.current) return;
    
    setIsLoading(true);
    try {
      await chartRef.current.setGranularity(granularity);
    } catch (error) {
      console.error('Failed to change granularity:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleIndicatorToggle = useCallback((indicatorId: string, indicatorName: string) => {
    if (!chartRef.current) return;
    
    const isVisible = visibleIndicators.includes(indicatorId);
    if (isVisible) {
      chartRef.current.hideIndicator(indicatorId);
    } else {
      chartRef.current.showIndicator({
        id: indicatorId,
        name: indicatorName,
        visible: true
      });
    }
  }, [visibleIndicators]);

  const handleFullscreenToggle = useCallback(async () => {
    if (!chartRef.current) return;
    
    try {
      await chartRef.current.toggleFullscreen();
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error);
    }
  }, []);

  const handleFullWindowToggle = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.toggleFullWindow();
  }, []);

  const presetIndicatorSets = {
    'Basic': [
      { id: 'volume', name: 'Volume', visible: true }
    ],
    'Technical': [
      { id: 'volume', name: 'Volume', visible: true },
      { id: 'rsi', name: 'RSI', visible: true },
      { id: 'macd', name: 'MACD', visible: true }
    ],
    'Advanced': [
      { id: 'volume', name: 'Volume', visible: true },
      { id: 'rsi', name: 'RSI', visible: true },
      { id: 'macd', name: 'MACD', visible: true },
      { id: 'bb', name: 'Bollinger Bands', visible: true },
      { id: 'sma', name: 'SMA', visible: true }
    ]
  };

  const applyIndicatorPreset = useCallback((presetName: keyof typeof presetIndicatorSets) => {
    if (!chartRef.current) return;
    chartRef.current.setIndicators(presetIndicatorSets[presetName]);
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Advanced Trading Dashboard</h1>
      
      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
        {/* Symbol Selection */}
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Symbol:</label>
          {symbols.map(symbol => (
            <button
              key={symbol}
              onClick={() => handleSymbolChange(symbol)}
              disabled={isLoading}
              style={{
                margin: '0 5px',
                padding: '8px 12px',
                backgroundColor: currentSymbol === symbol ? '#007bff' : '#f8f9fa',
                color: currentSymbol === symbol ? 'white' : 'black',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {symbol}
            </button>
          ))}
        </div>

        {/* Granularity Selection */}
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Timeframe:</label>
          {granularities.slice(0, 5).map(granularity => (
            <button
              key={granularity}
              onClick={() => handleGranularityChange(granularity)}
              disabled={isLoading}
              style={{
                margin: '0 5px',
                padding: '8px 12px',
                backgroundColor: currentGranularity === granularity ? '#007bff' : '#f8f9fa',
                color: currentGranularity === granularity ? 'white' : 'black',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {granularityLabel(granularity)}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Indicators:</label>
          {indicators.map(indicator => (
            <button
              key={indicator.id}
              onClick={() => handleIndicatorToggle(indicator.id, indicator.name)}
              style={{
                margin: '0 5px',
                padding: '6px 10px',
                backgroundColor: visibleIndicators.includes(indicator.id) ? '#28a745' : '#f8f9fa',
                color: visibleIndicators.includes(indicator.id) ? 'white' : 'black',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {indicator.name}
            </button>
          ))}
        </div>
        
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Presets:</label>
          {Object.keys(presetIndicatorSets).map(presetName => (
            <button
              key={presetName}
              onClick={() => applyIndicatorPreset(presetName as keyof typeof presetIndicatorSets)}
              style={{
                margin: '0 5px',
                padding: '6px 10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {presetName}
            </button>
          ))}
        </div>
      </div>

      {/* Display Controls */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleFullscreenToggle}
          style={{
            margin: '0 10px 0 0',
            padding: '10px 15px',
            backgroundColor: isFullscreen ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        </button>
        
        <button
          onClick={handleFullWindowToggle}
          style={{
            margin: '0 10px 0 0',
            padding: '10px 15px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Toggle Full Window
        </button>
        
        <button
          onClick={() => chartRef.current?.redraw()}
          style={{
            padding: '10px 15px',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Force Redraw
        </button>
      </div>

      {/* Status */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <strong>Status:</strong> {currentSymbol} | {granularityLabel(currentGranularity)} | 
        Indicators: {visibleIndicators.length > 0 ? visibleIndicators.join(', ') : 'None'} |
        {isLoading ? ' Loading...' : ' Ready'}
      </div>

      {/* Chart */}
      <ChartApiComponent
        ref={chartRef}
        firebaseConfig={firebaseConfig}
        initialState={{
          symbol: currentSymbol,
          granularity: currentGranularity
        }}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: 'white'
        }}
        onSymbolChange={setCurrentSymbol}
        onGranularityChange={setCurrentGranularity}
        onIndicatorChange={setVisibleIndicators}
        onFullscreenChange={(fullscreen, type) => {
          if (type === 'fullscreen') {
            setIsFullscreen(fullscreen);
          }
        }}
      />

      {/* Debug Info */}
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <details>
          <summary>Debug Information</summary>
          <pre style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            {JSON.stringify({
              currentSymbol,
              currentGranularity,
              visibleIndicators,
              isFullscreen,
              isLoading,
              chartInitialized: !!chartRef.current?.api
            }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default TradingDashboard;
export { ChartApiComponent, type ChartApiComponentRef, type ChartApiComponentProps };