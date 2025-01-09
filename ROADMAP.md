# Product Roadmap

## What has been done

- [x] Basic charting tool, what you see in the website now
- [x] The website
- [x] The backend for ingesting live prices of all Coinbase Pro products
- [x] A backend for the charting tool: provides an API to fetch historical prices

## Description of the modules implemented so far

### Charting

- Implemented using Web Components and TypeScript.
- Can be embedded using one div and one script tag that loads the charting JS bundle.

### Ingestion Backednd

- Implemented in Python.
- Subscribes to the Coinbase Pro websocket API and stores the live candles in Firestore.
- Runs on Google Cloud Platform in the Cloud Run service. Requires only 2 small containers to be able to ingest all Coinbase Pro trading pairs.

### Charting Backend

- TypeScript, production runs on Bun in Google Cloud Platform.
- A simple REST API that provides the historical prices to the charting frontend.
- Live candles in all time granularities are stored in Firestore which provides a real-time subscription mechanism (using web sockets).

## The roadmap after the MVP

### Q1 2025§

- [ ] Client side scripting framework.
- [ ] Indicators for the chart. Implemented using the client side scripting framework.
- [ ] Drawing tools for technical analysis.
- [ ] Add more sources for assets (crypto, stocks, forex, etc.) We need to prioritize the most popular ones.

### Q2 2025

- [ ] User accounts and configuration dashboard for the chart.
- [ ] Asset library (for users to favorite their trading pairs)
- [ ] Make the Starter plan available to purchase

### Q3 2025

- [ ] The Chart API
- [ ] Theming and branding
- [ ] Make the Pro plan available to purchase

### Q4 2025

- [ ] AI features
- [ ] Anomaly detection
- [ ] Make the Unlimited plan available to purchase
