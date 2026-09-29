import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './i18n';
import { useUiStore } from './store/uiStore';

window.addEventListener('online', () => useUiStore.getState().setOnline(true));
window.addEventListener('offline', () => useUiStore.getState().setOnline(false));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
