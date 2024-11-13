import "./components/chart/chart-container";
import "./components/chart/chart";
import "./components/chart/timeline";
import { App } from "./app";
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  projectId: "spotcanvas-prod",
  apiKey: "AIzaSyB6H5Fy06K_iiOjpJdU9xaR57Kia31ribM",
  authDomain: "spotcanvas-prod.firebaseapp.com",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

window.addEventListener("DOMContentLoaded", () => {
  const app = new App(firestore);

  window.addEventListener('unload', () => {
    app.cleanup();
  });
});
