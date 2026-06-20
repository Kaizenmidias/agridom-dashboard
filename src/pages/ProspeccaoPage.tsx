import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  ExternalLink,
  FolderPlus,
  Info,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Radar,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react'

import { prospectionAPI } from '@/api/prospection'
import type {
  Prospect,
  ProspectContactHistory,
  ProspectMetrics,
  ProspectSearchInput,
  ProspectStatus,
  ProspectingSettings,
  ProspectionBootstrap,
} from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

type StateOption = { id: number; sigla: string; nome: string }
type CityOption = { id: number; nome: string }

const statusOptions: ProspectStatus[] = [
  'Novo',
  'Contato Enviado',
  'Respondeu',
  'Interessado',
  'Reuniao Agendada',
  'Proposta Enviada',
  'Fechado',
  'Perdido',
]

const initialSearch: ProspectSearchInput = {
  niche: 'Dentistas',
  city: '',
  state: 'SP',
  quantity: 10,
}

function getTemperature(score: number) {
  if (score >= 90) return { label: 'Muito Quente', className: 'bg-red-100 text-red-800' }
  if (score >= 70) return { label: 'Quente', className: 'bg-orange-100 text-orange-800' }
  if (score >= 50) return { label: 'Morno', className: 'bg-yellow-100 text-yellow-800' }
  return { label: 'Frio', className: 'bg-slate-100 text-slate-800' }
}

function getStatusClassName(status: ProspectStatus) {
  switch (status) {
    case 'Novo':
      return 'bg-slate-100 text-slate-800'
    case 'Contato Enviado':
      return 'bg-blue-100 text-blue-800'
    case 'Respondeu':
      return 'bg-cyan-100 text-cyan-800'
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

function formatChannel(channel: ProspectContactHistory['channel']) {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp'
    case 'email':
      return 'E-mail'
    case 'crm':
      return 'CRM'
    default:
      return 'Sistema'
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Nunca'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getFolderName(prospect: Prospect) {
  return prospect.analysis_report?.folderName || 'Sem pasta'
}

function isLeadInCRM(prospect: Prospect) {
  return Boolean(prospect.analysis_report?.crmSent)
}

function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const exec = (command: string) => {
    document.execCommand(command)
    onChange(editorRef.current?.innerHTML || '')
  }

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex flex-wrap gap-2 border-b p-2">
        <Button type="button" variant="outline" size="sm" onClick={() => exec('bold')}>
          Negrito
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec('italic')}>
          Itálico
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec('insertUnorderedList')}>
          Lista
        </Button>
      </div>
      <div
        ref={editorRef}
        className="min-h-[220px] p-4 text-sm outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
      />
    </div>
  )
}

const ProspeccaoPage = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [bootstrap, setBootstrap] = useState<ProspectionBootstrap | null>(null)
  const [searchForm, setSearchForm] = useState<ProspectSearchInput>(initialSearch)
  const [states, setStates] = useState<StateOption[]>([])
  const [cities, setCities] = useState<CityOption[]>([])
  const [leadQuery, setLeadQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProspectStatus>('all')
  const [folderFilter, setFolderFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [settingsDraft, setSettingsDraft] = useState<Partial<ProspectingSettings>>({})
  const [newFolderName, setNewFolderName] = useState('')
  const [folderDestination, setFolderDestination] = useState('')
  const [extraFolders, setExtraFolders] = useState<string[]>([])
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null)
  const pageSize = 10

  const loadBootstrap = async () => {
    try {
      setLoading(true)
      const data = await prospectionAPI.bootstrap()
      setBootstrap(data)
      setSettingsDraft({
        whatsapp_template: data.settings.whatsapp_template,
        email_subject: data.settings.email_subject,
        email_body_html: data.settings.email_body_html,
        sender_name: data.settings.sender_name,
      })
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar módulo',
        description: error.message || 'Não foi possível carregar a prospecção.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBootstrap()
  }, [])

  useEffect(() => {
    const loadStates = async () => {
      try {
        setLoadingStates(true)
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
        const data = await response.json()
        setStates(Array.isArray(data) ? data : [])
      } catch {
        toast({
          title: 'Erro ao carregar estados',
          description: 'Não foi possível carregar a lista de estados.',
          variant: 'destructive',
        })
      } finally {
        setLoadingStates(false)
      }
    }

    void loadStates()
  }, [toast])

  useEffect(() => {
    const currentState = searchForm.state
    if (!currentState) {
      setCities([])
      return
    }

    const loadCities = async () => {
      try {
        setLoadingCities(true)
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${currentState}/municipios`
        )
        const data = await response.json()
        const sortedCities = (Array.isArray(data) ? data : []).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
        )
        setCities(sortedCities)

        setSearchForm((current) => {
          if (current.city && sortedCities.some((city) => city.nome === current.city)) {
            return current
          }

          if (current.state === 'SP') {
            const saoPaulo = sortedCities.find((city) => city.nome === 'São Paulo')
            if (saoPaulo) {
              return { ...current, city: saoPaulo.nome }
            }
          }

          return { ...current, city: '' }
        })
      } catch {
        toast({
          title: 'Erro ao carregar cidades',
          description: 'Não foi possível carregar as cidades do estado selecionado.',
          variant: 'destructive',
        })
      } finally {
        setLoadingCities(false)
      }
    }

    void loadCities()
  }, [searchForm.state, toast])

  const prospects = bootstrap?.prospects || []
  const settings = bootstrap?.settings
  const metrics: ProspectMetrics = bootstrap?.metrics || {
    leadsFound: 0,
    hotLeads: 0,
    noWebsite: 0,
    whatsappSent: 0,
    emailsSent: 0,
    responseRate: 0,
    meetingsScheduled: 0,
    clientsClosed: 0,
  }
  const history = bootstrap?.history || []

  const availableFolders = useMemo(() => {
    const folders = new Set(extraFolders)
    prospects.forEach((prospect) => {
      const folderName = getFolderName(prospect)
      if (folderName !== 'Sem pasta') {
        folders.add(folderName)
      }
    })
    return Array.from(folders).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [extraFolders, prospects])

  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect) => {
      const matchesStatus = statusFilter === 'all' || prospect.status === statusFilter
      const matchesFolder =
        folderFilter === 'all' ||
        (folderFilter === '__none__' ? getFolderName(prospect) === 'Sem pasta' : getFolderName(prospect) === folderFilter)

      const haystack = [
        prospect.business_name,
        prospect.category,
        prospect.city,
        prospect.phone,
        prospect.email,
        prospect.website,
        getFolderName(prospect),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return matchesStatus && matchesFolder && haystack.includes(leadQuery.toLowerCase())
    })
  }, [folderFilter, leadQuery, prospects, statusFilter])

  const paginatedProspects = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProspects.slice(start, start + pageSize)
  }, [filteredProspects, page])

  const selectedProspects = useMemo(
    () => prospects.filter((prospect) => selectedIds.includes(prospect.id)),
    [prospects, selectedIds]
  )

  const totalPages = Math.max(1, Math.ceil(filteredProspects.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [leadQuery, statusFilter, folderFilter])

  const groupedByStatus = useMemo(
    () =>
      statusOptions.map((status) => ({
        status,
        leads: prospects.filter((prospect) => prospect.status === status),
      })),
    [prospects]
  )

  const handleSearch = async () => {
    if (!searchForm.state || !searchForm.city) {
      toast({
        title: 'Selecione estado e cidade',
        description: 'Escolha um estado e uma cidade antes de buscar leads.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSearching(true)
      const result = await prospectionAPI.search(searchForm)
      toast({
        title: result.total > 0 ? 'Busca concluída' : 'Nenhum novo lead encontrado',
        description: result.message
          ? `${result.message} Fonte usada: ${result.provider}.`
          : result.total > 0
            ? `${result.total} lead(s) novo(s) inserido(s) com sucesso pela fonte ${result.provider}.`
            : 'Os primeiros resultados já haviam sido prospectados. O sistema tentou avançar para os próximos disponíveis.',
      })
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Falha na busca',
        description: error.message || 'Não foi possível buscar os leads.',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setSyncing(true)
      await prospectionAPI.saveSettings(settingsDraft)
      toast({
        title: 'Configurações salvas',
        description: 'Templates e preferências atualizados com sucesso.',
      })
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleStatusChange = async (prospect: Prospect, status: ProspectStatus) => {
    try {
      await prospectionAPI.updateProspect(prospect.id, { status })
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleAddToCRM = async (prospect: Prospect) => {
    if (isLeadInCRM(prospect)) {
      toast({
        title: 'Lead já enviado para o CRM',
        description: 'Esse lead já está salvo no CRM e não pode ser enviado novamente.',
      })
      return
    }

    try {
      await prospectionAPI.addToCRM(prospect.id)
      toast({
        title: 'Lead enviado para o CRM',
        description: `${prospect.business_name} agora está salvo no CRM.`,
      })
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar para o CRM',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleAddSelectedToCRM = async () => {
    const eligibleProspects = selectedProspects.filter((prospect) => !isLeadInCRM(prospect))

    if (eligibleProspects.length === 0) {
      toast({
        title: 'Nenhum lead elegível',
        description: 'Selecione leads que ainda não foram enviados para o CRM.',
      })
      return
    }

    try {
      await Promise.all(eligibleProspects.map((prospect) => prospectionAPI.addToCRM(prospect.id)))
      toast({
        title: 'Leads enviados para o CRM',
        description: `${eligibleProspects.length} lead(s) enviado(s) em massa para o CRM.`,
      })
      setSelectedIds([])
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro no envio em massa para o CRM',
        description: error.message || 'Não foi possível enviar os leads selecionados.',
        variant: 'destructive',
      })
    }
  }

  const handleWhatsApp = async (prospectIds: number[]) => {
    try {
      const result = await prospectionAPI.registerWhatsApp(
        prospectIds,
        settingsDraft.whatsapp_template || settings?.whatsapp_template || '',
        settings?.whatsapp_template || ''
      )

      result.links.forEach((link) => window.open(link.url, '_blank'))

      toast({
        title: 'WhatsApp preparado',
        description: `${result.links.length} conversa(s) registrada(s) e aberta(s) no WhatsApp.`,
      })
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro no WhatsApp',
        description: error.message || 'Não foi possível preparar o envio.',
        variant: 'destructive',
      })
    }
  }

  const handleEmail = async (prospectIds: number[]) => {
    try {
      const result = await prospectionAPI.sendEmail(
        prospectIds,
        settingsDraft.email_subject || settings?.email_subject || '',
        settingsDraft.email_body_html || settings?.email_body_html || ''
      )

      toast({
        title: 'E-mails enviados',
        description: `${result.sent.length} e-mail(s) enviados com sucesso.`,
      })
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro no envio de e-mail',
        description: error.message || 'Verifique a configuração SMTP.',
        variant: 'destructive',
      })
    }
  }

  const handleCreateFolder = () => {
    const normalized = newFolderName.trim()
    if (!normalized) return
    if (!availableFolders.includes(normalized)) {
      setExtraFolders((current) => [...current, normalized])
    }
    setFolderDestination(normalized)
    setNewFolderName('')
    toast({
      title: 'Pasta criada',
      description: `A pasta "${normalized}" está disponível para organização.`,
    })
  }

  const handleMoveSelectedToFolder = async () => {
    if (!folderDestination || selectedIds.length === 0) return

    try {
      await Promise.all(
        selectedIds.map((id) =>
          prospectionAPI.updateProspect(id, {
            folder_name: folderDestination === '__none__' ? null : folderDestination,
          })
        )
      )

      toast({
        title: 'Leads organizados',
        description: `${selectedIds.length} lead(s) movido(s) com sucesso.`,
      })
      setSelectedIds([])
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro ao mover leads',
        description: error.message || 'Não foi possível atualizar as pastas.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return

    try {
      await Promise.all(selectedIds.map((id) => prospectionAPI.deleteProspect(id)))
      toast({
        title: 'Leads excluídos',
        description: `${selectedIds.length} lead(s) excluído(s) com sucesso.`,
      })
      setSelectedIds([])
      setDetailProspect(null)
      await loadBootstrap()
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir leads',
        description: error.message || 'Não foi possível excluir os leads selecionados.',
        variant: 'destructive',
      })
    }
  }

  const toggleSelection = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Prospecção</h1>
          </div>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Produto interno da Kaizen para geração de leads, priorização comercial, organização em pastas e envio para CRM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadBootstrap()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={() => void handleAddSelectedToCRM()} disabled={selectedIds.length === 0}>
            <Users className="mr-2 h-4 w-4" />
            CRM em Massa
          </Button>
          <Button onClick={() => void handleWhatsApp(selectedIds)} disabled={selectedIds.length === 0}>
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp em Massa
          </Button>
          <Button onClick={() => void handleEmail(selectedIds)} disabled={selectedIds.length === 0}>
            <Send className="mr-2 h-4 w-4" />
            E-mail em Massa
          </Button>
          <Button variant="destructive" onClick={() => void handleDeleteSelected()} disabled={selectedIds.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir Selecionados
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Buscar Leads</CardTitle>
            <CardDescription>
              Escolha nicho, estado e cidade. Ao buscar novamente o mesmo mercado, o sistema tenta avançar para outros leads ainda não prospectados.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input
                id="niche"
                value={searchForm.niche}
                onChange={(event) => setSearchForm((current) => ({ ...current, niche: event.target.value }))}
                placeholder="Dentistas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Select
                value={searchForm.state || ''}
                onValueChange={(value) =>
                  setSearchForm((current) => ({
                    ...current,
                    state: value,
                    city: '',
                  }))
                }
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder={loadingStates ? 'Carregando estados...' : 'Selecione o estado'} />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.sigla}>
                      {state.nome} ({state.sigla})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Select
                value={searchForm.city}
                onValueChange={(value) => setSearchForm((current) => ({ ...current, city: value }))}
                disabled={!searchForm.state || loadingCities}
              >
                <SelectTrigger id="city">
                  <SelectValue
                    placeholder={
                      loadingCities
                        ? 'Carregando cidades...'
                        : searchForm.state
                          ? 'Selecione a cidade'
                          : 'Escolha um estado'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.nome}>
                      {city.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade de leads</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={50}
                value={searchForm.quantity}
                onChange={(event) =>
                  setSearchForm((current) => ({
                    ...current,
                    quantity: Number(event.target.value || 1),
                  }))
                }
              />
            </div>
            <div className="md:col-span-4">
              <Button className="w-full md:w-auto" onClick={() => void handleSearch()} disabled={searching}>
                {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar Leads
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>Prospects</CardTitle>
                <CardDescription>
                  Organize leads em pastas, envie para o CRM uma única vez e filtre rapidamente por status, pasta e busca.
                </CardDescription>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  value={leadQuery}
                  onChange={(event) => setLeadQuery(event.target.value)}
                  placeholder="Buscar por empresa, cidade, site ou pasta"
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ProspectStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={folderFilter} onValueChange={setFolderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as pastas</SelectItem>
                    <SelectItem value="__none__">Sem pasta</SelectItem>
                    {availableFolders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    const pageIds = paginatedProspects.map((prospect) => prospect.id)
                    if (pageIds.every((id) => selectedIds.includes(id))) {
                      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)))
                      return
                    }

                    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])))
                  }}
                >
                  {paginatedProspects.every((prospect) => selectedIds.includes(prospect.id))
                    ? 'Limpar página'
                    : 'Selecionar página'}
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                <div className="flex gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    placeholder="Criar nova pasta"
                  />
                  <Button type="button" variant="outline" onClick={handleCreateFolder}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Criar
                  </Button>
                </div>
                <Select value={folderDestination} onValueChange={setFolderDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mover para pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem pasta</SelectItem>
                    {availableFolders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleMoveSelectedToFolder()} disabled={!folderDestination || selectedIds.length === 0}>
                  Mover Selecionados
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:hidden">
                {paginatedProspects.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                    Nenhum lead encontrado com os filtros atuais.
                  </div>
                ) : (
                  paginatedProspects.map((prospect) => {
                    const temperature = getTemperature(prospect.lead_score || 0)
                    const inCRM = isLeadInCRM(prospect)

                    return (
                      <Card
                        key={prospect.id}
                        className="cursor-pointer overflow-hidden transition-colors hover:bg-muted/30"
                        onClick={() => setDetailProspect(prospect)}
                      >
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedIds.includes(prospect.id)}
                                  onClick={(event) => event.stopPropagation()}
                                  onCheckedChange={() => toggleSelection(prospect.id)}
                                />
                                <p className="font-semibold">{prospect.business_name}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {[prospect.city, prospect.state].filter(Boolean).join(' / ') || 'Não informado'}
                              </p>
                            </div>
                            <Badge className={temperature.className}>{prospect.lead_score}</Badge>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className={temperature.className}>{temperature.label}</Badge>
                            <Badge className={inCRM ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}>
                              {inCRM ? 'No CRM' : 'Não enviado'}
                            </Badge>
                            <Badge variant="outline">{getFolderName(prospect)}</Badge>
                          </div>

                          <Select
                            value={prospect.status}
                            onClick={(event) => event.stopPropagation()}
                            onValueChange={(value) => void handleStatusChange(prospect, value as ProspectStatus)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                prospect.website && window.open(prospect.website, '_blank')
                              }}
                              disabled={!prospect.website}
                            >
                              Ver Site
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleWhatsApp([prospect.id])
                              }}
                              disabled={!prospect.phone}
                            >
                              WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleEmail([prospect.id])
                              }}
                              disabled={!prospect.email}
                            >
                              E-mail
                            </Button>
                            <Button
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleAddToCRM(prospect)
                              }}
                              disabled={inCRM}
                            >
                              CRM
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                setDetailProspect(prospect)
                              }}
                            >
                              <Info className="mr-2 h-4 w-4" />
                              Detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>

              <div className="hidden rounded-lg border overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={paginatedProspects.length > 0 && paginatedProspects.every((prospect) => selectedIds.includes(prospect.id))}
                          onCheckedChange={() => {
                            const pageIds = paginatedProspects.map((prospect) => prospect.id)
                            if (pageIds.every((id) => selectedIds.includes(id))) {
                              setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)))
                              return
                            }

                            setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])))
                          }}
                        />
                      </TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="hidden xl:table-cell">Local</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="hidden xl:table-cell">Pasta</TableHead>
                      <TableHead className="hidden xl:table-cell">CRM</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[260px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProspects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          Nenhum lead encontrado com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProspects.map((prospect) => {
                        const temperature = getTemperature(prospect.lead_score || 0)
                        const inCRM = isLeadInCRM(prospect)
                        return (
                          <TableRow
                            key={prospect.id}
                            className="cursor-pointer"
                            onClick={() => setDetailProspect(prospect)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(prospect.id)}
                                onClick={(event) => event.stopPropagation()}
                                onCheckedChange={() => toggleSelection(prospect.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{prospect.business_name}</p>
                                <div className="flex flex-wrap gap-2">
                                  <Badge className={temperature.className}>{temperature.label}</Badge>
                                  {prospect.google_rating ? (
                                    <Badge variant="outline">
                                      <Star className="mr-1 h-3 w-3" />
                                      {prospect.google_rating} ({prospect.google_reviews || 0})
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">{[prospect.city, prospect.state].filter(Boolean).join(' / ') || 'Não informado'}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-semibold text-primary">{prospect.lead_score}</p>
                                <p className="text-xs text-muted-foreground">{prospect.website_quality || 'Sem análise'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">{getFolderName(prospect)}</TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <Badge className={inCRM ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}>
                                {inCRM ? 'No CRM' : 'Não enviado'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={prospect.status}
                                onClick={(event) => event.stopPropagation()}
                                onValueChange={(value) => void handleStatusChange(prospect, value as ProspectStatus)}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    prospect.website && window.open(prospect.website, '_blank')
                                  }}
                                  disabled={!prospect.website}
                                >
                                  Ver Site
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleWhatsApp([prospect.id])
                                  }}
                                  disabled={!prospect.phone}
                                >
                                  WhatsApp
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleEmail([prospect.id])
                                  }}
                                  disabled={!prospect.email}
                                >
                                  E-mail
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleAddToCRM(prospect)
                                  }}
                                  disabled={inCRM}
                                >
                                  Enviar para o CRM
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setDetailProspect(prospect)
                                  }}
                                >
                                  <Info className="mr-2 h-4 w-4" />
                                  Detalhes
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Exibindo {paginatedProspects.length} de {filteredProspects.length} lead(s) | selecionados: {selectedIds.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de Prospecção</CardTitle>
              <CardDescription>Visualize a evolução dos leads em colunas de status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-8">
                {groupedByStatus.map((column) => (
                  <div key={column.status} className="min-h-[300px] rounded-xl border bg-muted/30 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge className={getStatusClassName(column.status)}>{column.status}</Badge>
                      <span className="text-xs text-muted-foreground">{column.leads.length}</span>
                    </div>
                    <div className="space-y-3">
                      {column.leads.map((prospect) => (
                        <div key={prospect.id} className="rounded-lg border bg-background p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{prospect.business_name}</p>
                            {isLeadInCRM(prospect) ? <Badge variant="outline">CRM</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[prospect.city, prospect.state].filter(Boolean).join(' / ')}
                          </p>
                          <div className="mt-3 flex items-center justify-between">
                            <Badge className={getTemperature(prospect.lead_score).className}>{prospect.lead_score}</Badge>
                            <span className="text-xs text-muted-foreground">{getFolderName(prospect)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mensagens" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de WhatsApp</CardTitle>
                <CardDescription>Template para envios individuais e em massa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  rows={10}
                  value={settingsDraft.whatsapp_template || ''}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      whatsapp_template: event.target.value,
                    }))
                  }
                />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{'{{nome}}'}</Badge>
                  <Badge variant="outline">{'{{empresa}}'}</Badge>
                  <Badge variant="outline">{'{{cidade}}'}</Badge>
                  <Badge variant="outline">{'{{problema}}'}</Badge>
                  <Badge variant="outline">{'{{score}}'}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações de E-mail</CardTitle>
                <CardDescription>Assunto e editor rich text para prospecção.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-subject">Assunto</Label>
                  <Input
                    id="email-subject"
                    value={settingsDraft.email_subject || ''}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        email_subject: event.target.value,
                      }))
                    }
                  />
                </div>
                <RichTextEditor
                  value={settingsDraft.email_body_html || ''}
                  onChange={(value) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      email_body_html: value,
                    }))
                  }
                />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{'{{nome}}'}</Badge>
                  <Badge variant="outline">{'{{empresa}}'}</Badge>
                  <Badge variant="outline">{'{{cidade}}'}</Badge>
                  <Badge variant="outline">{'{{problema}}'}</Badge>
                  <Badge variant="outline">{'{{score}}'}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Contatos</CardTitle>
              <CardDescription>Registro centralizado dos envios e ações do CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center">
                  <p className="font-medium">Nenhum envio registrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">Assim que houver contatos, o histórico aparecerá aqui.</p>
                </div>
              ) : (
                history.slice(0, 50).map((item) => (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{formatChannel(item.channel)}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium">{item.recipient || 'Destinatário não informado'}</p>
                      </div>
                      <Badge variant="secondary">{item.delivery_status || 'registrado'}</Badge>
                    </div>
                    {item.subject ? <p className="mt-3 text-sm font-medium">Assunto: {item.subject}</p> : null}
                    <div className="mt-2 max-h-24 overflow-hidden text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: item.message }} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>Ajuste templates, remetente e preferências do módulo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sender-name">Nome do remetente</Label>
                    <Input
                      id="sender-name"
                      value={settingsDraft.sender_name || ''}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          sender_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default-city">Cidade padrão</Label>
                    <Input id="default-city" value={searchForm.city} readOnly />
                  </div>
                </div>
                <Button onClick={() => void handleSaveSettings()} disabled={syncing}>
                  {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notas Operacionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-foreground">Busca progressiva</p>
                  <p className="mt-1">Ao repetir uma busca, o backend consulta mais resultados e ignora os já prospectados para chegar aos próximos disponíveis.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-foreground">Pastas sem schema novo</p>
                  <p className="mt-1">A organização em pastas fica persistida no JSON de análise do próprio lead, sem depender de migração extra no banco.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-foreground">CRM único</p>
                  <p className="mt-1">Quando um lead entra no CRM, o botão fica bloqueado e o histórico impede novo envio duplicado.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {bootstrap && !bootstrap.integrations.apifyConfigured ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-medium">Apify ainda não configurado</p>
              <p className="text-sm">A busca continua funcional com fallback, mas a extração principal fica mais rica quando o token `APIFY_TOKEN` está ativo.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(detailProspect)} onOpenChange={(open) => !open && setDetailProspect(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {detailProspect ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailProspect.business_name}</DialogTitle>
                <DialogDescription>
                  {[detailProspect.city, detailProspect.state].filter(Boolean).join(' / ') || 'Local não informado'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getTemperature(detailProspect.lead_score || 0).className}>
                        {getTemperature(detailProspect.lead_score || 0).label}
                      </Badge>
                      <Badge className={getStatusClassName(detailProspect.status)}>{detailProspect.status}</Badge>
                      <Badge variant="outline">{getFolderName(detailProspect)}</Badge>
                    </div>
                    <p><span className="font-medium">Score:</span> {detailProspect.lead_score || 0}</p>
                    <p><span className="font-medium">Qualidade do site:</span> {detailProspect.website_quality || 'Sem análise'}</p>
                    <p><span className="font-medium">CRM:</span> {isLeadInCRM(detailProspect) ? 'Enviado' : 'Não enviado'}</p>
                    <p><span className="font-medium">Último contato:</span> {formatDateTime(detailProspect.last_contact_date)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contato e Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p><span className="font-medium">Telefone:</span> {detailProspect.phone || 'Sem telefone'}</p>
                    <p><span className="font-medium">E-mail:</span> {detailProspect.email || 'Sem e-mail'}</p>
                    <p><span className="font-medium">Endereço:</span> {detailProspect.address || 'Não informado'}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => detailProspect.website && window.open(detailProspect.website, '_blank')}
                        disabled={!detailProspect.website}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver Site
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => detailProspect.google_maps_url && window.open(detailProspect.google_maps_url, '_blank')}
                        disabled={!detailProspect.google_maps_url}
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Google Maps
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Problemas Identificados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(detailProspect.problems_found || []).length > 0 ? (
                      detailProspect.problems_found.map((problem) => (
                        <Badge key={problem} variant="outline">
                          {problem}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">Nenhum problema listado</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Diagnóstico</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {detailProspect.diagnostic_summary || 'Diagnóstico não disponível.'}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Abordagem Comercial</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {detailProspect.approach_suggestion || 'Abordagem não disponível.'}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProspeccaoPage
