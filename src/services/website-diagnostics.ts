import { buildApiUrl } from "@/config/api";
import type { WebsiteDiagnostic } from "@/types/website-diagnostic";
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` });
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(buildApiUrl(`website-diagnostics${path}`), { ...init, headers: { ...headers(), ...(init?.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar o diagnóstico."); return payload as T; }
export const websiteDiagnosticsApi = { list: () => request<{ diagnostics: WebsiteDiagnostic[] }>(""), get: (id: string) => request<{ diagnostic: WebsiteDiagnostic }>(`/${id}`), create: (url: string) => request<{ id: number; status: string }>("", { method: "POST", body: JSON.stringify({ url }) }) };
