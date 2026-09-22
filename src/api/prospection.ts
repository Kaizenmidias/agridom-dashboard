import { buildApiUrl } from '@/config/api'
import type {
  Prospect,
  ProspectContactHistory,
  ProspectionBootstrap,
  ProspectionIntegrationProvider,
  ProspectionIntegrationSettings,
  ProspectionIntegrationTestResult,
  ProspectionIntegrationUpdatePayload,
  ProspectMetrics,
  ProspectSearchInput,
  ProspectStatus,
  ProspectingSettings,
} from '@/types/database'

const PROSPECTION_BASE_URL = buildApiUrl('prospection')

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  if (!token) throw new Error('Usuario nao autenticado')

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PROSPECTION_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  })

  const rawText = await response.text()
  const data = rawText ? JSON.parse(rawText) : null

  if (!response.ok) {
    throw new Error(data?.error || data?.message || rawText || `Erro na API de prospeccao (${response.status})`)
  }

  return (data ?? {}) as T
}

export const prospectionAPI = {
  bootstrap() {
    return request<ProspectionBootstrap>('/bootstrap')
  },

  search(input: ProspectSearchInput) {
    return request<{ inserted: Prospect[]; total: number; provider: string; message?: string }>('/search', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  updateProspect(id: number, payload: Partial<{
    status: ProspectStatus
    last_contact_date: string | null
    approach_suggestion: string
    diagnostic_summary: string
    problems_found: string[]
    folder_name: string | null
  }>) {
    return request<Prospect>(`/prospects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  addToCRM(id: number) {
    return request<Prospect>(`/prospects/${id}/add-to-crm`, { method: 'POST' })
  },

  deleteProspect(id: number) {
    return request<{ success: boolean; id: number }>(`/prospects/${id}`, { method: 'DELETE' })
  },

  saveSettings(payload: Partial<ProspectingSettings>) {
    return request<ProspectingSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  getIntegrationSettings() {
    return request<ProspectionIntegrationSettings>('/integrations')
  },

  saveIntegrationSettings(payload: ProspectionIntegrationUpdatePayload) {
    return request<ProspectionIntegrationSettings>('/integrations', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  testIntegration(provider: ProspectionIntegrationProvider) {
    return request<ProspectionIntegrationTestResult>(`/integrations/${provider}/test`, { method: 'POST' })
  },

  registerWhatsApp(prospectIds: number[], template: string, defaultTemplate?: string) {
    return request<{ links: Array<{ prospect_id: number; business_name: string; url: string }> }>('/whatsapp/register', {
      method: 'POST',
      body: JSON.stringify({ prospect_ids: prospectIds, template, default_template: defaultTemplate }),
    })
  },

  sendEmail(prospectIds: number[], subject: string, bodyHtml: string) {
    return request<{ sent: Array<{ id: number; email: string; subject: string }> }>('/email/send', {
      method: 'POST',
      body: JSON.stringify({ prospect_ids: prospectIds, subject, body_html: bodyHtml }),
    })
  },
}

export type {
  Prospect,
  ProspectContactHistory,
  ProspectMetrics,
  ProspectionBootstrap,
  ProspectionIntegrationProvider,
  ProspectionIntegrationSettings,
  ProspectionIntegrationTestResult,
  ProspectionIntegrationUpdatePayload,
  ProspectingSettings,
}
