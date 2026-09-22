import React from 'react';

export const DebugEnv: React.FC = () => {
  const envVars = {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD
  };

  const shouldShow = false;

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
      <h4>Debug - Variaveis de Ambiente</h4>
      {Object.entries(envVars).map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong> {String(value || 'undefined')}
        </div>
      ))}
      {!import.meta.env.VITE_API_BASE_URL && (
        <div style={{ color: '#ff6b6b', marginTop: '10px' }}>
          ERRO: VITE_API_BASE_URL nao configurada.
        </div>
      )}
    </div>
  );
};

export default DebugEnv;
