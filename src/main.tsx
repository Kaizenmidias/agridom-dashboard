
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

document.documentElement.classList.add('dark');

// Debug das variáveis de ambiente no início da aplicação
if (import.meta.env.DEV) {
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);
root.render(
  <App />
);
