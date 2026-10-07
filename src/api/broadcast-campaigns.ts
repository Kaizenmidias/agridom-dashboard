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
  cadence_seconds?: number;
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
  channels?: Array<"whatsapp" | "email">;
  channel?: "whatsapp" | "email" | "both";
  email_provider_id?: number | null;
  email_subject?: string | null;
  email_body_text?: string | null;
  idempotency_key?: string | null;
};
export type EmailAttachment = {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at?: string;
};
export type Audience = {
  total: number;
  with_phone: number;
  without_phone: number;
  potentially_duplicate: number;
  totalLeads?: number;
  withWhatsApp?: number;
  withEmail?: number;
  withBoth?: number;
  withoutAnyContact?: number;
  prospects: Array<{
    id: number;
    business_name: string;
    phone?: string;
    normalized_phone?: string;
    email?: string;
    whatsappEligible?: boolean;
    emailEligible?: boolean;
    status?: string;
    city?: string;
    state?: string;
  }>;
};
export const broadcastAPI = {
  emailProviders: () => request<{ providers: Array<{ id: number; name?: string; from_email?: string; status: string }> }>("/email-providers"),
  signature: () => request<{ signature: { id: number; html_content: string; text_content: string } | null }>("/email-signature"),
  saveSignature: (html_content: string) => request<{ signature: { id: number; html_content: string; text_content: string } }>("/email-signature", { method: "PUT", body: JSON.stringify({ html_content }) }),
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
  content: (id: number, content: string | Record<string, unknown>) =>
    request<{ campaign: Campaign }>(`/${id}/content`, {
      method: "PUT",
      body: JSON.stringify(typeof content === "string" ? { content_type: "text", text_content: content } : content),
    }),
  uploadMedia: async (
    id: number,
    file: File,
    content_type: "image" | "video" | "document" | "audio",
    text_content: string,
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("content_type", content_type);
    form.append("text_content", text_content);
    const token = localStorage.getItem("token");
    const response = await fetch(
      buildApiUrl(`broadcast-campaigns/${id}/content/media`),
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload?.error || "Não foi possível anexar o arquivo.");
    return payload as {
      campaign: Campaign;
      media: {
        content_type: string;
        mime_type: string;
        original_filename: string;
        size: number;
      };
    };
  },
  emailAttachments: (id: number) => request<{ attachments: EmailAttachment[] }>(`/${id}/email-attachments`),
  uploadEmailAttachment: async (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("token");
    const response = await fetch(buildApiUrl(`broadcast-campaigns/${id}/email-attachments`), { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Nao foi possivel anexar o arquivo.");
    return payload as { attachment: EmailAttachment };
  },
  removeEmailAttachment: (id: number, attachmentId: number) => request<{ success: true }>(`/${id}/email-attachments/${attachmentId}`, { method: "DELETE" }),
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
