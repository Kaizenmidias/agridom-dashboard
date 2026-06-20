import React, { useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, Loader2, Mail, MapPin, MessageCircle, Move, Phone, Target, Users } from 'lucide-react'

import { prospectionAPI } from '@/api/prospection'
import type { Prospect, ProspectStatus, ProspectionBootstrap } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const crmColumns: ProspectStatus[] = [
  'Interessado',
  'Reuniao Agendada',
  'Proposta Enviada',
  'Fechado',
  'Perdido',
]

function getStatusColor(status: ProspectStatus) {
  switch (status) {
    case 'Interessado':
      return 'bg-violet-100 text-violet-800'
    case 'Reuniao Agendada':
      return 'bg-indigo-100 text-indigo-800'
    case 'Proposta Enviada':
      return 'bg-amber-100 text-amber-800'
    case 'Fechado':
      return 'bg-emerald-100 text-emerald-800'
    case 'Perdido':
      return 'bg-rose-100 text-rose-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

function getFolderName(prospect: Prospect) {
  return prospect.analysis_report?.folderName || 'Sem pasta'
}

function isLeadInCRM(prospect: Prospect) {
  return Boolean(prospect.analysis_report?.crmSent)
}

const CRMPage = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [bootstrap, setBootstrap] = useState<ProspectionBootstrap | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [selectedLead, setSelectedLead] = useState<Prospect | null>(null)

  const loadCRM = async () => {
    try {
      setLoading(true)
      const data = await prospectionAPI.bootstrap()
      setBootstrap(data)
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar CRM',
        description: error.message || 'Não foi possível carregar os leads enviados ao CRM.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCRM()
  }, [])

  const crmLeads = useMemo(
    () => (bootstrap?.prospects || []).filter((prospect) => isLeadInCRM(prospect)),
    [bootstrap]
  )

  const groupedLeads = useMemo(
    () =>
      crmColumns.map((status) => ({
        status,
        leads: crmLeads.filter((prospect) => prospect.status === status),
      })),
    [crmLeads]
  )

  const conversionRate = bootstrap?.metrics.leadsFound
    ? Math.round((bootstrap.metrics.clientsClosed / bootstrap.metrics.leadsFound) * 100)
    : 0

  const handleDrop = async (status: ProspectStatus) => {
    if (!draggedId) return

    const prospect = crmLeads.find((item) => item.id === draggedId)
    if (!prospect || prospect.status === status) {
      setDraggedId(null)
      return
    }

    try {
      await prospectionAPI.updateProspect(prospect.id, { status })
      await loadCRM()
    } catch (error: any) {
      toast({
        title: 'Erro ao mover card',
        description: error.message || 'Não foi possível atualizar o status do lead.',
        variant: 'destructive',
      })
    } finally {
      setDraggedId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground">Kanban operacional dos leads que já foram enviados da Prospecção para o CRM.</p>
        </div>
        <Button variant="outline" onClick={() => void loadCRM()}>
          <Move className="mr-2 h-4 w-4" />
          Atualizar Kanban
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads no CRM</p>
                <p className="text-2xl font-bold">{crmLeads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2">
                <Target className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interessados</p>
                <p className="text-2xl font-bold">{crmLeads.filter((lead) => lead.status === 'Interessado').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Building2 className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Propostas</p>
                <p className="text-2xl font-bold">{crmLeads.filter((lead) => lead.status === 'Proposta Enviada').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversão</p>
                <p className="text-2xl font-bold">{conversionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {crmLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">Nenhum lead enviado ao CRM ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o botão "Enviar para o CRM" na aba de Prospecção para popular este Kanban.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          {groupedLeads.map((column) => (
            <Card
              key={column.status}
              className="min-h-[520px]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void handleDrop(column.status)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className={getStatusColor(column.status)}>{column.status}</Badge>
                  <span className="text-sm text-muted-foreground">{column.leads.length}</span>
                </div>
                <CardDescription>Arraste os cards para atualizar o estágio comercial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {column.leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedId(lead.id)}
                    onClick={() => setSelectedLead(lead)}
                    className="w-full rounded-xl border bg-background p-4 text-left shadow-sm transition hover:border-primary hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{lead.business_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[lead.city, lead.state].filter(Boolean).join(' / ')}
                        </p>
                      </div>
                      <Badge variant="outline">{lead.lead_score}</Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <p>Pasta: {getFolderName(lead)}</p>
                      <p>Telefone: {lead.phone || 'Sem telefone'}</p>
                      <p>Último contato: {lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString('pt-BR') : 'Nunca'}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-3xl">
          {selectedLead ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedLead.business_name}</DialogTitle>
                <DialogDescription>
                  Lead já enviado ao CRM. Arraste o card no Kanban para mudar o status comercial.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contato</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {selectedLead.phone || 'Sem telefone'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {selectedLead.email || 'Sem e-mail'}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {selectedLead.address || [selectedLead.city, selectedLead.state].filter(Boolean).join(' / ')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Badge className={getStatusColor(selectedLead.status)}>{selectedLead.status}</Badge>
                      <Badge variant="outline">Score {selectedLead.lead_score}</Badge>
                      <Badge variant="outline">{getFolderName(selectedLead)}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Diagnóstico</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>{selectedLead.diagnostic_summary || 'Resumo não disponível.'}</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedLead.problems_found || []).map((problem) => (
                        <Badge key={problem} variant="outline">
                          {problem}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ações rápidas</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => selectedLead.website && window.open(selectedLead.website, '_blank')}
                    disabled={!selectedLead.website}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver Site
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectedLead.google_maps_url && window.open(selectedLead.google_maps_url, '_blank')}
                    disabled={!selectedLead.google_maps_url}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Google Maps
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectedLead.phone && window.open(`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`, '_blank')}
                    disabled={!selectedLead.phone}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectedLead.email && window.open(`mailto:${selectedLead.email}`, '_blank')}
                    disabled={!selectedLead.email}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    E-mail
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CRMPage
