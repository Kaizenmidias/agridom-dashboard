import React from 'react';

// Componente para debug das variáveis de ambiente
// Remover após confirmar que está funcionando em produção
export const DebugEnv: React.FC = () => {
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Definida (oculta)' : 'Não definida',
    NODE_ENV: import.meta.env.NODE_ENV,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD
  };

  // Desabilitado temporariamente para teste de inputs
  const shouldShow = false; // import.meta.env.DEV || !import.meta.env.VITE_SUPABASE_URL;

  if (!shouldShow) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      background: '#000',
      color: '#fff',
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px',
      borderLeft: '3px solid #ff0000'
    }}>
      <h4>🔍 Debug - Variáveis de Ambiente</h4>
      {Object.entries(envVars).map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong> {value || 'undefined'}
        </div>
      ))}
      {!import.meta.env.VITE_SUPABASE_URL && (
        <div style={{ color: '#ff6b6b', marginTop: '10px' }}>
          ⚠️ ERRO: Variáveis VITE_ não configuradas na Vercel!
        </div>
      )}
    </div>
  );
};

export default DebugEnv;
