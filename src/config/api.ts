// Configuração da API
// Este arquivo centraliza as configurações de URL da API para facilitar
// a mudança entre ambientes de desenvolvimento e produção

// Detecta automaticamente o ambiente baseado na URL atual
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// URLs da API para diferentes ambientes
const API_URLS = {
  development: 'https://agridom-dashboard.vercel.app/api',
  production: '/api' // API routes da Vercel no mesmo projeto
};

// URLs específicas para autenticação
const AUTH_API_URLS = {
  development: 'https://agridom-dashboard.vercel.app/api',
  production: '/api' // API routes da Vercel no mesmo projeto
};

// Exporta a URL base da API baseada no ambiente
export const API_BASE_URL = isProduction ? API_URLS.production : API_URLS.development;
export const AUTH_API_BASE_URL = isProduction ? AUTH_API_URLS.production : AUTH_API_URLS.development;

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