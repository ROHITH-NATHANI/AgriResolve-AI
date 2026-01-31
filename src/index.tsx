
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config'; // Initialize i18n
import { registerSW } from 'virtual:pwa-register';

// PWA (offline-first) registration
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, _registration) {
    // Intentionally silent in UI; we show an online/offline badge in the header.
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
