# Scripts Directory

This directory contains utility scripts for the rs-charts project.

## Available Scripts

### add-indicators-to-firestore.ts

Adds the built-in indicators from `client/config.ts` to Firestore in the `indicators` collection using the client SDK.

**Usage:**

```bash
bun run add-indicators
```

**Requirements:**

- Firebase service account credentials (see setup below)

## Setup Instructions

### Using Admin SDK (Recommended for production)

1. **Get Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `serviceAccountKey.json` in the project root

2. **Option A: Using Service Account File**

   ```bash
   # Place serviceAccountKey.json in project root
   bun run add-indicators:admin
   ```

3. **Option B: Using Environment Variables**

   ```bash
   export FIREBASE_PROJECT_ID="spotcanvas-prod"
   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@spotcanvas-prod.iam.gserviceaccount.com"

   bun run add-indicators:admin
   ```

## What the Scripts Do

Both scripts add indicators to the Firestore `indicators` collection with the following structure:

```typescript
{
  id: string;              // Unique identifier (e.g., "volume", "rsi", "macd")
  name: string;            // Display name (e.g., "RSI", "Moving Averages")
  display: string;         // Display type (e.g., "Bottom", "Overlay", "StackBottom")
  visible: boolean;        // Default visibility (set to false)
  className: string;       // Component class name (e.g., "VolumeChart", "MarketIndicator")
  params?: object;         // Indicator parameters (e.g., { period: 14 })
  scale?: string;          // Scale type (e.g., "Price", "Percentage", "Value")
  gridStyle?: string;      // Grid style (e.g., "PercentageOscillator", "MACD")
  oscillatorConfig?: {     // Oscillator configuration for indicators like RSI
    levels: number[];
    thresholds: number[];
    format: string;
  };
  skipFetch?: boolean;     // Whether to skip data fetching
}
```

## Current Indicators Added

- **Volume** - Trading volume display
- **Moving Averages** - Price trend indicators (period: 200)
- **Bollinger Bands** - Volatility bands (period: 20, stdDev: 2)
- **RSI** - Relative Strength Index (period: 14)
- **MACD** - Moving Average Convergence Divergence
- **Stochastic** - Momentum oscillator (period: 14)
- **ATR** - Average True Range (period: 14)

## Security Notes

- **Client SDK**: Requires Firestore security rules to allow writes
- **Admin SDK**: Bypasses security rules but requires service account credentials
- For production, use Admin SDK with proper credential management
- Never commit service account keys to version control
- Use environment variables for credentials in CI/CD environments

## Troubleshooting

### Permission Denied Error

```
7 PERMISSION_DENIED: Missing or insufficient permissions
```

**Solution**: Use the Admin SDK version or update Firestore security rules

### Service Account Key Not Found

```
Firebase credentials not found
```

**Solution**: Place `serviceAccountKey.json` in project root or set environment variables

### Firebase App Already Exists

If you get initialization errors, restart the script or check for multiple Firebase app instances.

## Notes

- Both scripts are safe to run multiple times (they overwrite existing indicators)
- The indicators data is extracted from the actual configuration in `client/config.ts`
- Scripts will create the `indicators` collection if it doesn't exist
