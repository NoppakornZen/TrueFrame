import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import App from './App.tsx';
import TestHarness from './TestHarness.tsx';
import './index.css';

const isTest = window.location.pathname === '/test';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isTest ? <TestHarness /> : <App />}
  </React.StrictMode>,
);
