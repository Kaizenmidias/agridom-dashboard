import { buildApiUrl } from "@/config/api";
export type LeadFolder = {
  id: number;
  name: string;
  description?: string | null;
  icon?: string;
  total: number;
  with_phone: number;
  prospect_ids?: number[];
};
async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(buildApiUrl(`prospection${path}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem("token")
        ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
        : {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload?.error || "Não foi possível processar a pasta.");
  return payload as T;
}
export const leadFoldersAPI = {
  list: () => request<{ folders: LeadFolder[] }>("/folders"),
  create: (body: {
    name: string;
    description?: string | null;
    icon?: string;
  }) =>
    request<{ folder: LeadFolder }>("/folders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addMembers: (folderId: number, prospectIds: string[]) =>
    request<{ added: number; missing: number }>(
      `/folders/${folderId}/members`,
      {
        method: "POST",
        body: JSON.stringify({ prospect_ids: prospectIds.map(Number) }),
      },
    ),
  remove: (folderId: number) =>
    request<{ success: boolean }>(`/folders/${folderId}`, { method: "DELETE" }),
};
