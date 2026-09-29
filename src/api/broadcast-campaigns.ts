import { buildApiUrl } from "@/config/api";

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(buildApiUrl(`broadcast-campaigns${path}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem("token")
        ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
        : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload?.error || "Não foi possível concluir a operação.");
  return payload as T;
}
export type Campaign = {
  id: number;
  name: string;
  status: string;
  scheduled_at?: string | null;
  account_name?: string;
  account_phone?: string;
  total?: number;
  pending?: number;
  processing?: number;
  sent?: number;
  delivered?: number;
  read_count?: number;
  failed?: number;
  skipped?: number;
  cancelled?: number;
  content_type?: string;
  text_content?: string;
};
export type Audience = {
  total: number;
  with_phone: number;
  without_phone: number;
  potentially_duplicate: number;
  prospects: Array<{
    id: number;
    business_name: string;
    phone?: string;
    normalized_phone?: string;
    email?: string;
    status?: string;
    city?: string;
    state?: string;
  }>;
};
export const broadcastAPI = {
  list: () => request<{ campaigns: Campaign[] }>("/"),
  get: (id: number) =>
    request<{
      campaign: Campaign;
      account?: { name: string; phone_number?: string };
      recipient_summary: { total: number; by_status: Record<string, number> };
    }>(`/${id}`),
  create: (body: unknown) =>
    request<{ campaign: Campaign }>("/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: unknown) =>
    request<{ campaign: Campaign }>(`/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  content: (id: number, text_content: string) =>
    request<{ campaign: Campaign }>(`/${id}/content`, {
      method: "PUT",
      body: JSON.stringify({ content_type: "text", text_content }),
    }),
  audience: (params: Record<string, string>) =>
    request<Audience>(`/audience/preview?${new URLSearchParams(params)}`),
  folders: () =>
    request<{
      manual_folders: Array<{
        id: number;
        name: string;
        total: number;
        with_phone: number;
      }>;
    }>("/audience/folders"),
  addAudience: (id: number, filters: Record<string, string>) =>
    request<{ added: number; duplicates: number; missing_phone: number }>(
      `/${id}/recipients`,
      { method: "POST", body: JSON.stringify({ filters }) },
    ),
  addFolder: (id: number, folder_id: number) =>
    request<{ added: number; missing_phone: number }>(
      `/${id}/recipients/folder`,
      { method: "POST", body: JSON.stringify({ folder_id }) },
    ),
  audienceFolders: (id: number, folder_ids: number[]) =>
    request<{ eligible: number; missing_phone: number }>(`/${id}/audience`, {
      method: "PUT",
      body: JSON.stringify({ folder_ids }),
    }),
  remove: (id: number) =>
    request<{ success: boolean }>(`/${id}`, { method: "DELETE" }),
  recipients: (id: number, status = "") =>
    request<{ recipients: Array<Record<string, unknown>> }>(
      `/${id}/recipients?${new URLSearchParams(status ? { status } : {})}`,
    ),
  removeRecipient: (id: number, recipientId: number) =>
    request(`/${id}/recipients/${recipientId}`, { method: "DELETE" }),
  review: (id: number) => request<Record<string, any>>(`/${id}/review`),
  start: (id: number) =>
    request<{ status: string }>(`/${id}/start`, { method: "POST" }),
  progress: (id: number) =>
    request<{
      status: string;
      total: number;
      pending: number;
      processing: number;
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      skipped: number;
      cancelled: number;
    }>(`/${id}/progress`),
  action: (id: number, action: "pause" | "resume" | "cancel") =>
    request(`/${id}/${action}`, { method: "POST" }),
};
