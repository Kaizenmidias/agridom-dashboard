
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Debug das variáveis de ambiente no início da aplicação
console.log('🚀 MAIN.TSX - Iniciando aplicação');
console.log('📊 Environment Mode:', import.meta.env.MODE);
console.log('🔑 VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('🔑 VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? `${import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'UNDEFINED');
console.log('📋 Todas as variáveis VITE_:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);
root.render(
  <App />
);
