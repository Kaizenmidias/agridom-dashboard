// Configuração da aplicação
// Este arquivo centraliza as configurações gerais da aplicação

// Detecta automaticamente o ambiente baseado na URL atual
export const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// URLs base da aplicação
export const APP_URLS = {
  development: 'http://localhost:8080',
  production: window.location.origin
};

// Exporta a URL base da aplicação baseada no ambiente
export const APP_BASE_URL = isProduction ? APP_URLS.production : APP_URLS.development;

// Configurações adicionais da API
export const API_CONFIG = {
  timeout: 30000, // 30 segundos
  retries: 3,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Função auxiliar para construir URLs completas
export const buildApiUrl = (endpoint: string): string => {
  // Remove barras duplicadas
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Log da configuração atual (apenas em desenvolvimento)
if (!isProduction) {
  console.log('🔧 API Configuration:', {
    environment: isProduction ? 'production' : 'development',
    baseUrl: API_BASE_URL,
    hostname: window.location.hostname
  });
}