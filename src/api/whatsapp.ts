export type WhatsAppAccount = {
  id: number;
  name: string;
  externalInstanceId: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  status: "pending" | "qr_required" | "connecting" | "connected" | "disconnected" | "error" | "archived";
  autoCreateLeads: boolean;
};

type WhatsAppConfig = { status: string; configured: boolean; metadata: { baseUrl: string; timeout: number; apiKeyMasked?: string }; lastError?: string | null };
const origin = () => import.meta.env.PROD ? (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/api\/?$/, '').replace(/\/+$/, '') : 'http://localhost:3001';
const request = async <T>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`${origin()}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}), ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Erro HTTP ${response.status}`);
  return payload as T;
};

export const whatsappAPI = {
  getConfig: () => request<WhatsAppConfig>('/api/integrations/whatsapp/config'),
  saveConfig: (body: { baseUrl: string; apiKey?: string; timeout?: number }) => request<WhatsAppConfig>('/api/integrations/whatsapp/config', { method: 'PUT', body: JSON.stringify(body) }),
  testConnection: () => request<{ message: string }>('/api/integrations/whatsapp/config/test-connection', { method: 'POST' }),
  listAccounts: () => request<{ accounts: WhatsAppAccount[] }>('/api/integrations/whatsapp/accounts'),
  createAccount: (body: { name: string; instanceName?: string; autoCreateLeads?: boolean }) => request<{ account: WhatsAppAccount }>('/api/integrations/whatsapp/accounts', { method: 'POST', body: JSON.stringify(body) }),
  getQr: (id: number) => request<{ status: string; qrCode?: string | null; pairingCode?: string | null }>(`/api/integrations/whatsapp/accounts/${id}/qr`),
  getStatus: (id: number) => request<{ status: WhatsAppAccount["status"] }>(`/api/integrations/whatsapp/accounts/${id}/status`),
  syncWebhook: (id: number) => request<{ success: boolean }>(`/api/integrations/whatsapp/accounts/${id}/webhook/sync`, { method: 'POST' }),
  disconnect: (id: number) => request<{ status: string }>(`/api/integrations/whatsapp/accounts/${id}/disconnect`, { method: 'POST' }),
  archive: (id: number) => request<{ success: boolean }>(`/api/integrations/whatsapp/accounts/${id}`, { method: 'DELETE' }),
};
