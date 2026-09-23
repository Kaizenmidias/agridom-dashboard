import { buildApiUrl } from "@/config/api";
import type { LeadLabel } from "@/types/lead";

export type PipelineDefinition = { id: number; name: string; description?: string | null; is_default: number };
export type PipelineStage = { id: number; pipeline_id: number; name: string; color?: string | null; sort_order: number };
export type PipelinePosition = { id: number; prospect_id: number; pipeline_id: number; stage_id: number; sort_order: number };
export type UserOption = { id: number; name: string; email: string };
export type LeadActivityRecord = {
  id: number;
  prospect_id: number;
  type: "task" | "call" | "follow_up" | "activity";
  title: string;
  description?: string | null;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
  due_at?: string | null;
  status: "pending" | "completed" | "cancelled";
  completed_at?: string | null;
  created_at: string;
};

function headers() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não autenticado");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(`commercial${endpoint}`), { ...init, headers: { ...headers(), ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Não foi possível concluir a operação.");
  return payload as T;
}

export const commercialEntitiesAPI = {
  getPipelines: () => request<{ pipelines: PipelineDefinition[]; stages: PipelineStage[]; positions: PipelinePosition[] }>("/pipelines"),
  createPipeline: (name: string) => request<PipelineDefinition>("/pipelines", { method: "POST", body: JSON.stringify({ name }) }),
  createStage: (pipelineId: number, name: string) => request<PipelineStage>(`/pipelines/${pipelineId}/stages`, { method: "POST", body: JSON.stringify({ name }) }),
  updateStage: (stageId: number, values: Partial<PipelineStage>) => request<PipelineStage>(`/pipeline-stages/${stageId}`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteStage: (stageId: number) => request<{ success: true }>(`/pipeline-stages/${stageId}`, { method: "DELETE" }),
  moveLead: (pipelineId: number, prospectId: string, stageId: number, sortOrder = 0) => request<PipelinePosition>(`/pipelines/${pipelineId}/positions/${prospectId}`, { method: "PUT", body: JSON.stringify({ stage_id: stageId, sort_order: sortOrder }) }),
  importLocalPipeline: (pipelineId: number, items: Array<{ prospect_id: string; stage_id: number; sort_order: number }>) => request<{ imported: number }>(`/pipelines/${pipelineId}/import-local`, { method: "POST", body: JSON.stringify({ items }) }),
  getLabels: () => request<{ labels: Array<{ id: number; name: string; color: string }> }>("/labels"),
  createLabel: (name: string, color: string) => request<{ id: number; name: string; color: string }>("/labels", { method: "POST", body: JSON.stringify({ name, color }) }),
  updateLabel: (id: string, values: Partial<LeadLabel>) => request<{ id: number; name: string; color: string }>(`/labels/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
  deleteLabel: (id: string) => request<{ success: true }>(`/labels/${id}`, { method: "DELETE" }),
  setLeadLabels: (prospectId: string, labelIds: string[]) => request<{ label_ids: number[] }>(`/prospects/${prospectId}/labels`, { method: "PUT", body: JSON.stringify({ label_ids: labelIds }) }),
  getUsers: () => request<{ users: UserOption[] }>("/users/options"),
  getActivities: (prospectId: string) => request<{ activities: LeadActivityRecord[] }>(`/prospects/${prospectId}/activities`),
  createActivity: (prospectId: string, values: Partial<LeadActivityRecord>) => request<LeadActivityRecord>(`/prospects/${prospectId}/activities`, { method: "POST", body: JSON.stringify(values) }),
  updateActivity: (activityId: number, values: Partial<LeadActivityRecord>) => request<LeadActivityRecord>(`/activities/${activityId}`, { method: "PATCH", body: JSON.stringify(values) }),
};
