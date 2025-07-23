#!/usr/bin/env bun

import { initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// You'll need to set this environment variable or provide the path to your service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "./serviceAccountKey.json";

interface IndicatorData {
  id: string;
  name: string;
  display: string;
  visible: boolean;
  params?: Record<string, any>;
  scale?: string;
  gridStyle?: string;
  oscillatorConfig?: {
    levels: number[];
    thresholds: number[];
    format: string;
  };
  skipFetch?: boolean;
  className: string;
}

// Define the indicators data directly (extracted from config.ts)
const indicatorsData: IndicatorData[] = [
  {
    id: "volume",
    name: "Volume",
    display: "Bottom",
    visible: false,
    skipFetch: true,
    className: "VolumeChart",
  },
  {
    id: "moving-averages",
    name: "Moving Averages",
    display: "Overlay",
    visible: false,
    params: { period: 200 },
    scale: "Price",
    className: "MarketIndicator",
  },
  {
    id: "bollinger-bands",
    name: "Bollinger Bands",
    display: "Overlay",
    visible: false,
    params: { period: 20, stdDev: 2 },
    scale: "Price",
    className: "MarketIndicator",
  },
  {
    id: "rsi",
    name: "RSI",
    display: "StackBottom",
    visible: false,
    params: { period: 14 },
    scale: "Percentage",
    gridStyle: "PercentageOscillator",
    oscillatorConfig: {
      levels: [0, 30, 50, 70, 100],
      thresholds: [30, 70],
      format: "%d%%",
    },
    className: "MarketIndicator",
  },
  {
    id: "macd",
    name: "MACD",
    display: "StackBottom",
    visible: false,
    params: {
      period: 12,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
    gridStyle: "MACD",
    className: "MarketIndicator",
  },
  {
    id: "stochastic",
    name: "Stochastic",
    display: "StackBottom",
    visible: false,
    params: { period: 14, smoothK: 1, smoothD: 3 },
    scale: "Percentage",
    gridStyle: "PercentageOscillator",
    oscillatorConfig: {
      levels: [0, 20, 50, 80, 100],
      thresholds: [20, 80],
      format: "%d%%",
    },
    className: "MarketIndicator",
  },
  {
    id: "atr",
    name: "ATR 14 RMA",
    display: "StackBottom",
    visible: false,
    params: { period: 14 },
    scale: "Value",
    gridStyle: "Value",
    className: "MarketIndicator",
  },
];

async function addIndicatorsToFirestore() {
  console.log("🚀 Starting to add indicators to Firestore using Admin SDK...");

  try {
    let app: App;

    try {
      // Try to initialize with service account key file
      app = initializeApp({
        credential: cert(serviceAccountPath),
        projectId: "spotcanvas-prod",
      });
    } catch (error) {
      console.log("📝 Service account key file not found, trying environment variables...");

      // Try to initialize with environment variables
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || "spotcanvas-prod",
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };

      if (!serviceAccount.privateKey || !serviceAccount.clientEmail) {
        throw new Error(
          "Firebase credentials not found. Please either:\n" +
          "1. Place your serviceAccountKey.json in the project root, or\n" +
          "2. Set environment variables: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID"
        );
      }

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      });
    }

    const db = getFirestore(app);

    console.log(`📊 Found ${indicatorsData.length} indicators to add`);

    // Add each indicator to Firestore
    for (const indicatorData of indicatorsData) {
      try {
        // Add to Firestore using Admin SDK
        await db.collection("indicators").doc(indicatorData.id).set(indicatorData);

        console.log(
          `✅ Added indicator: ${indicatorData.name} (${indicatorData.id})`,
        );
      } catch (error) {
        console.error(
          `❌ Error adding indicator ${indicatorData.name}:`,
          error,
        );
      }
    }

    console.log("🎉 Successfully added all indicators to Firestore!");
  } catch (error) {
    console.error("💥 Error adding indicators to Firestore:", error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  addIndicatorsToFirestore();
}
