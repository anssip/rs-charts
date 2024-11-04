import "./components/chart/chart-container";
import "./components/chart/candlestick-chart";
import "./components/chart/timeline";
import { App } from "./app";

// Make sure this exists and runs
window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.initialize();
});
