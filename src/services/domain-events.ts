import { buildApiUrl } from "@/config/api";

export type DomainEvent = {
  id: number;
  event_uuid: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: number | null;
  actor_name?: string | null;
  payload?: Record<string, unknown>;
  correlation_id?: string | null;
  causation_id?: string | null;
  occurred_at: string;
  created_at: string;
};

export type DomainEventList = {
  events: DomainEvent[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function authHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não autenticado.");
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(endpoint: string) {
  const response = await fetch(buildApiUrl(`automation-events${endpoint}`), { headers: authHeaders() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar os eventos.");
  return payload as T;
}

export const domainEventsAPI = {
  list: (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
    return request<DomainEventList>(`?${query.toString()}`);
  },
  get: (id: number) => request<{ event: DomainEvent }>(`/${id}`),
};
