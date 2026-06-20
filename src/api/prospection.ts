import { supabase } from '@/lib/supabase'
import type {
  Prospect,
  ProspectContactHistory,
  ProspectMetrics,
  ProspectSearchInput,
  ProspectStatus,
  ProspectingSettings,
  ProspectionBootstrap,
} from '@/types/database'

const isProduction =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'

const PROSPECTION_BASE_URL = isProduction
  ? 'https://agridom-dashboard.vercel.app/api/prospection'
  : 'http://localhost:3001/api/prospection'

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    throw new Error('Usuário não autenticado')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session.access_token}`,
  }
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders()
  const url = `${PROSPECTION_BASE_URL}${endpoint}`
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    })
  } catch (error: any) {
    throw error
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'Erro na API de prospecção')
  }

  return data as T
}

export const prospectionAPI = {
  bootstrap() {
    return request<ProspectionBootstrap>('/bootstrap')
  },

  search(input: ProspectSearchInput) {
    return request<{ inserted: Prospect[]; total: number; provider: string }>('/search', {
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
    return request<Prospect>(`/prospects/${id}/add-to-crm`, {
      method: 'POST',
    })
  },

  saveSettings(payload: Partial<ProspectingSettings>) {
    return request<ProspectingSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  registerWhatsApp(prospectIds: number[], template: string, defaultTemplate?: string) {
    return request<{ links: Array<{ prospect_id: number; business_name: string; url: string }> }>(
      '/whatsapp/register',
      {
        method: 'POST',
        body: JSON.stringify({
          prospect_ids: prospectIds,
          template,
          default_template: defaultTemplate,
        }),
      }
    )
  },

  sendEmail(prospectIds: number[], subject: string, bodyHtml: string) {
    return request<{ sent: Array<{ id: number; email: string; subject: string }> }>('/email/send', {
      method: 'POST',
      body: JSON.stringify({
        prospect_ids: prospectIds,
        subject,
        body_html: bodyHtml,
      }),
    })
  },
}

export type {
  Prospect,
  ProspectContactHistory,
  ProspectMetrics,
  ProspectingSettings,
  ProspectionBootstrap,
}
