// Centralized API configuration used by browser clients.

export const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveBackendBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }

  return `${normalizeBaseUrl(window.location.origin)}/api`;
};

export const API_BASE_URL = resolveBackendBaseUrl();

export const API_CONFIG = {
  timeout: 30000,
  retries: 3,
  headers: {
    'Content-Type': 'application/json',
  },
};

export const buildApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

