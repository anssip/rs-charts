// Chart API Example - Vanilla JavaScript
// This example demonstrates how to use the Chart API for external control

import { 
  initChartWithApi, 
  createChartContainer,
  getAllGranularities,
  granularityLabel 
} from '../client/lib.js';

// Firebase configuration (replace with your own)
const firebaseConfig = {
  projectId: "your-project-id",
  apiKey: "your-api-key",
  authDomain: "your-domain.firebaseapp.com",
};

async function initializeChart() {
  // Create chart container
  const chartContainer = createChartContainer();
  document.body.appendChild(chartContainer);

  // Initialize chart with API
  const { app, api } = await initChartWithApi(chartContainer, firebaseConfig, {
    symbol: "BTC-USD",
    granularity: "ONE_HOUR"
  });

  // Example: Basic symbol control
  console.log('Current symbol:', api.getSymbol());
  
  // Change symbol
  await api.setSymbol("ETH-USD");
  console.log('New symbol:', api.getSymbol());

  // Example: Granularity control
  console.log('Available granularities:', getAllGranularities());
  console.log('Current granularity:', api.getGranularity());
  
  // Change granularity
  await api.setGranularity("FIVE_MINUTE");
  console.log('New granularity:', api.getGranularity());

  // Example: Indicator control
  console.log('Visible indicators:', api.getVisibleIndicators());
  
  // Show RSI indicator
  api.showIndicator({
    id: "rsi",
    name: "RSI",
    visible: true
  });
  
  // Check if indicator is visible
  console.log('Is RSI visible?', api.isIndicatorVisible('rsi'));
  
  // Hide indicator
  api.hideIndicator('rsi');
  
  // Toggle indicator
  api.toggleIndicator('volume');

  // Example: Fullscreen control
  console.log('Is fullscreen?', api.isFullscreen());
  
  // Enter fullscreen (requires user interaction)
  document.addEventListener('click', async () => {
    if (!api.isFullscreen()) {
      try {
        await api.enterFullscreen();
        console.log('Entered fullscreen');
      } catch (error) {
        console.log('Fullscreen failed:', error.message);
      }
    }
  }, { once: true });

  // Example: Full window control
  api.toggleFullWindow();
  console.log('Is full window?', api.isFullWindow());

  // Example: Event listeners
  api.on('symbolChange', (data) => {
    console.log('Symbol changed:', data);
  });

  api.on('granularityChange', (data) => {
    console.log('Granularity changed:', data);
  });

  api.on('indicatorChange', (data) => {
    console.log('Indicator changed:', data);
  });

  api.on('fullscreenChange', (data) => {
    console.log('Fullscreen changed:', data);
  });

  // Example: Multiple operations
  setTimeout(async () => {
    console.log('Performing multiple operations...');
    
    await api.setSymbol("SOL-USD");
    await api.setGranularity("ONE_DAY");
    
    api.showIndicator({
      id: "macd",
      name: "MACD",
      visible: true
    });
    
    api.showIndicator({
      id: "bb",
      name: "Bollinger Bands", 
      visible: true
    });
    
    console.log('Operations complete');
    console.log('Current state:', {
      symbol: api.getSymbol(),
      granularity: api.getGranularity(),
      indicators: api.getVisibleIndicators().map(i => i.id),
      loading: api.isLoading()
    });
  }, 3000);

  // Example: Advanced indicator configuration
  setTimeout(() => {
    api.setIndicators([
      {
        id: "rsi",
        name: "RSI",
        visible: true
      },
      {
        id: "volume",
        name: "Volume",
        visible: true
      },
      {
        id: "sma",
        name: "SMA",
        visible: true,
        params: { period: 20 }
      }
    ]);
  }, 6000);

  // Make API globally accessible for debugging
  window.chartApi = api;
  window.chartApp = app;
  
  return { app, api };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChart);
} else {
  initializeChart();
}

// Export for use in other modules
export { initializeChart };