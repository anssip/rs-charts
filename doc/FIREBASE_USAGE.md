# Firebase Usage with Chart API

This document explains how to properly initialize Firebase for use with the Chart API after the recent fixes.

## Overview

The Chart API now accepts **either** a Firebase config object or an initialized Firebase app instance, providing more flexibility for different use cases.

## Usage Examples

### Option 1: Using Firebase Config Object (Recommended)

```typescript
import { initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

// Firebase configuration object
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Create chart container
const chartContainer = createChartContainer();
document.body.appendChild(chartContainer);

// Initialize chart with config object (library will initialize Firebase app)
const { app, api } = await initChartWithApi(chartContainer, firebaseConfig, {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
});
```

### Option 2: Using Pre-initialized Firebase App

```typescript
import { initializeApp } from 'firebase/app';
import { initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

// Firebase configuration object
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase app yourself
const firebaseApp = initializeApp(firebaseConfig);

// Create chart container
const chartContainer = createChartContainer();
document.body.appendChild(chartContainer);

// Initialize chart with Firebase app instance
const { app, api } = await initChartWithApi(chartContainer, firebaseApp, {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
});
```

### Option 3: React Component Example

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { initChartWithApi, createChartContainer, ChartApi, App } from '@anssipiirainen/sc-charts';

interface ChartComponentProps {
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}

export const ChartComponent: React.FC<ChartComponentProps> = ({ firebaseConfig }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartApi, setChartApi] = useState<ChartApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeChart = async () => {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        setError(null);

        // Create chart container
        const chartContainer = createChartContainer();
        containerRef.current.appendChild(chartContainer);

        // Initialize with Firebase config (library handles Firebase app initialization)
        const { app, api } = await initChartWithApi(chartContainer, firebaseConfig, {
          symbol: "BTC-USD",
          granularity: "ONE_HOUR"
        });

        setChartApi(api);
        console.log('Chart initialized successfully');

      } catch (err) {
        console.error('Failed to initialize chart:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    initializeChart();

    return () => {
      chartApi?.dispose();
    };
  }, [firebaseConfig]);

  if (loading) return <div>Loading chart...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height: '600px' }} />
      {chartApi && (
        <div>
          <button onClick={() => chartApi.setSymbol("ETH-USD")}>
            Switch to ETH-USD
          </button>
          <button onClick={() => chartApi.toggleIndicator("rsi", { name: "RSI" })}>
            Toggle RSI
          </button>
        </div>
      )}
    </div>
  );
};
```

## Error Handling

The Chart API now provides better error messages for Firebase-related issues:

```typescript
try {
  const { app, api } = await initChartWithApi(chartContainer, firebaseConfig);
  // Success
} catch (error) {
  if (error.message.includes('Firebase config')) {
    console.error('Invalid Firebase configuration:', error);
    // Handle Firebase config errors
  } else if (error.message.includes('Firestore')) {
    console.error('Firestore initialization failed:', error);
    // Handle Firestore errors
  } else {
    console.error('Unknown chart initialization error:', error);
    // Handle other errors
  }
}
```

## Common Issues and Solutions

### 1. "Firebase config or app instance is required"
**Cause**: No Firebase configuration provided
**Solution**: Pass a valid Firebase config object or initialized Firebase app

### 2. "Invalid Firebase config or app instance"
**Cause**: Invalid configuration object missing required fields
**Solution**: Ensure your config has at least `projectId` and other required fields

### 3. "Failed to initialize Firestore"
**Cause**: Firebase project doesn't have Firestore enabled or network issues
**Solution**: 
- Enable Firestore in your Firebase console
- Check network connectivity
- Verify Firebase project ID is correct

### 4. "app.container is undefined" (Legacy error)
**Cause**: This was the old error before the fix
**Solution**: Update to the latest version of the chart library

## TypeScript Support

The API now exports proper types for Firebase configuration:

```typescript
import { 
  initChartWithApi, 
  FirebaseConfigOrApp,
  ChartApi 
} from '@anssipiirainen/sc-charts';

// Type-safe Firebase config
const config: FirebaseConfigOrApp = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

const { app, api }: { app: App; api: ChartApi } = await initChartWithApi(
  chartContainer, 
  config
);
```

## Migration from Previous Versions

If you were previously getting `app.container is undefined` errors:

1. **Update the chart library** to the latest version
2. **No code changes needed** - your existing Firebase config should work
3. **Better error messages** will help diagnose any remaining issues

The API maintains backward compatibility while adding better error handling and flexibility.