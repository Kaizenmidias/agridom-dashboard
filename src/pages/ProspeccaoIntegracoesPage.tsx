import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, Mail, PlugZap, RefreshCw, Search, Sparkles } from 'lucide-react'

import {
  prospectionAPI,
  type ProspectionIntegrationProvider,
  type ProspectionIntegrationSettings,
  type ProspectionIntegrationUpdatePayload,
} from '@/api/prospection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type IntegrationCardConfig = {
  key: ProspectionIntegrationProvider
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

type DraftState = {
  apifyToken: string
  apifyActorId: string
  googlePlacesApiKey: string
  googlePageSpeedApiKey: string
  openaiApiKey: string
  openaiModel: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
}

const integrationCards: IntegrationCardConfig[] = [
  {
    key: 'apify',
    title: 'Apify',
    description: 'Fonte principal para prospecção e coleta de leads por nicho e cidade.',
    icon: Search,
  },
  {
    key: 'google',
    title: 'Google APIs',
    description: 'Places para fallback de busca e PageSpeed para análise de performance do site.',
    icon: KeyRound,
  },
  {
    key: 'openai',
    title: 'OpenAI',
    description: 'Diagnóstico comercial e abordagem automática personalizada por lead.',
    icon: Sparkles,
  },
  {
    key: 'smtp',
    title: 'SMTP',
    description: 'Envio real de e-mails individuais e em massa a partir do módulo de prospecção.',
    icon: Mail,
  },
]

function buildDraft(config: ProspectionIntegrationSettings): DraftState {
  return {
    apifyToken: '',
    apifyActorId: config.apify.actorId || 'datamech/apify-google-maps-scraper',
    googlePlacesApiKey: '',
    googlePageSpeedApiKey: '',
    openaiApiKey: '',
    openaiModel: config.openai.model || 'gpt-4o-mini',
    smtpHost: config.smtp.host || '',
    smtpPort: config.smtp.port || '587',
    smtpUser: config.smtp.user || '',
    smtpPass: '',
    smtpFrom: config.smtp.from || '',
  }
}

function getStatusBadge(configured: boolean) {
  return configured
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-amber-100 text-amber-800'
}

function buildPayloadForIntegration(
  provider: ProspectionIntegrationProvider,
  draft: DraftState
): ProspectionIntegrationUpdatePayload {
  if (provider === 'apify') {
    return {
      apify: {
        token: draft.apifyToken,
        actorId: draft.apifyActorId,
      },
    }
  }

  if (provider === 'google') {
    return {
      google: {
        placesApiKey: draft.googlePlacesApiKey,
        pageSpeedApiKey: draft.googlePageSpeedApiKey,
      },
    }
  }

  if (provider === 'openai') {
    return {
      openai: {
        apiKey: draft.openaiApiKey,
        model: draft.openaiModel,
      },
    }
  }

  return {
    smtp: {
      host: draft.smtpHost,
      port: draft.smtpPort,
      user: draft.smtpUser,
      pass: draft.smtpPass,
      from: draft.smtpFrom,
    },
  }
}

const ProspeccaoIntegracoesPage = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<ProspectionIntegrationProvider | null>(null)
  const [activeIntegration, setActiveIntegration] = useState<ProspectionIntegrationProvider | null>(null)
  const [config, setConfig] = useState<ProspectionIntegrationSettings | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await prospectionAPI.getIntegrationSettings()
      setConfig(data)
      setDraft(buildDraft(data))
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar integrações',
        description: error.message || 'Não foi possível carregar as integrações.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  const activeCard = useMemo(
    () => integrationCards.find((card) => card.key === activeIntegration) || null,
    [activeIntegration]
  )

  const saveIntegration = async (
    provider: ProspectionIntegrationProvider,
    currentDraft: DraftState,
    options?: {
      closeOnSuccess?: boolean
      showToast?: boolean
    }
  ) => {
    try {
      setSaving(true)
      const updated = await prospectionAPI.saveIntegrationSettings(
        buildPayloadForIntegration(provider, currentDraft)
      )
      setConfig(updated)
      setDraft(buildDraft(updated))
      if (options?.showToast !== false) {
        toast({
          title: 'Integração salva',
          description: 'As credenciais foram persistidas no backend e aplicadas ao runtime.',
        })
      }
      if (options?.closeOnSuccess !== false) {
        setActiveIntegration(null)
      }
      return updated
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar integração',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!activeIntegration || !draft) return
    await saveIntegration(activeIntegration, draft)
  }

  const handleTest = async (
    provider: ProspectionIntegrationProvider,
    options?: { persistDraft?: boolean }
  ) => {
    try {
      if (options?.persistDraft && activeIntegration === provider && draft) {
        await saveIntegration(provider, draft, {
          closeOnSuccess: false,
          showToast: false,
        })
      }

      setTesting(provider)
      const result = await prospectionAPI.testIntegration(provider)
      toast({
        title: 'Teste concluído',
        description: result.message,
      })
    } catch (error: any) {
      toast({
        title: 'Falha no teste',
        description: error.message || 'Não foi possível validar a integração.',
        variant: 'destructive',
      })
    } finally {
      setTesting(null)
    }
  }

  if (loading || !config || !draft) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PlugZap className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Integrações e API</h1>
          </div>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Configure e teste as integrações reais da prospecção. Ao salvar aqui, o backend passa a usar as credenciais imediatamente.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadSettings()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {integrationCards.map((card) => {
          const state =
            card.key === 'apify'
              ? config.apify.configured
              : card.key === 'google'
                ? config.google.configured
                : card.key === 'openai'
                  ? config.openai.configured
                  : config.smtp.configured

          const Icon = card.icon

          return (
            <Card key={card.key} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge className={getStatusBadge(state)}>{state ? 'Configurado' : 'Pendente'}</Badge>
                </div>
                <CardTitle className="text-xl">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="space-y-2 text-sm text-muted-foreground">
                  {card.key === 'apify' ? <p>Token: {config.apify.tokenMasked || 'Não configurado'}</p> : null}
                  {card.key === 'apify' ? <p>Actor: {config.apify.actorId}</p> : null}
                  {card.key === 'google' ? <p>Places: {config.google.placesApiKeyMasked || 'Não configurado'}</p> : null}
                  {card.key === 'google' ? <p>PageSpeed: {config.google.pageSpeedApiKeyMasked || 'Não configurado'}</p> : null}
                  {card.key === 'openai' ? <p>Chave: {config.openai.apiKeyMasked || 'Não configurado'}</p> : null}
                  {card.key === 'openai' ? <p>Modelo: {config.openai.model}</p> : null}
                  {card.key === 'smtp' ? <p>Host: {config.smtp.host || 'Não configurado'}</p> : null}
                  {card.key === 'smtp' ? <p>Usuário: {config.smtp.user || 'Não configurado'}</p> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setActiveIntegration(card.key)}>Configurar</Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleTest(card.key)}
                    disabled={testing === card.key}
                  >
                    {testing === card.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Testar integração
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={Boolean(activeCard)} onOpenChange={(open) => !open && setActiveIntegration(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          {activeCard ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeCard.title}</DialogTitle>
                <DialogDescription>
                  Preencha os dados da integração. Os valores são persistidos no backend e passam a ser usados pelo módulo de prospecção.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                {activeCard.key === 'apify' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="apify-token">Token do Apify</Label>
                      <Input
                        id="apify-token"
                        type="password"
                        placeholder={config.apify.tokenMasked || 'Cole o token do Apify'}
                        value={draft.apifyToken}
                        onChange={(event) => setDraft((current) => current ? { ...current, apifyToken: event.target.value } : current)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apify-actor">Actor</Label>
                      <Input
                        id="apify-actor"
                        value={draft.apifyActorId}
                        onChange={(event) => setDraft((current) => current ? { ...current, apifyActorId: event.target.value } : current)}
                      />
                    </div>
                  </>
                ) : null}

                {activeCard.key === 'google' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="google-places">Google Places API Key</Label>
                      <Input
                        id="google-places"
                        type="password"
                        placeholder={config.google.placesApiKeyMasked || 'Cole a chave do Google Places'}
                        value={draft.googlePlacesApiKey}
                        onChange={(event) => setDraft((current) => current ? { ...current, googlePlacesApiKey: event.target.value } : current)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="google-pagespeed">Google PageSpeed API Key</Label>
                      <Input
                        id="google-pagespeed"
                        type="password"
                        placeholder={config.google.pageSpeedApiKeyMasked || 'Cole a chave do Google PageSpeed'}
                        value={draft.googlePageSpeedApiKey}
                        onChange={(event) => setDraft((current) => current ? { ...current, googlePageSpeedApiKey: event.target.value } : current)}
                      />
                    </div>
                  </>
                ) : null}

                {activeCard.key === 'openai' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="openai-key">OpenAI API Key</Label>
                      <Input
                        id="openai-key"
                        type="password"
                        placeholder={config.openai.apiKeyMasked || 'Cole a chave da OpenAI'}
                        value={draft.openaiApiKey}
                        onChange={(event) => setDraft((current) => current ? { ...current, openaiApiKey: event.target.value } : current)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openai-model">Modelo</Label>
                      <Input
                        id="openai-model"
                        value={draft.openaiModel}
                        onChange={(event) => setDraft((current) => current ? { ...current, openaiModel: event.target.value } : current)}
                      />
                    </div>
                  </>
                ) : null}

                {activeCard.key === 'smtp' ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">Servidor SMTP</Label>
                        <Input
                          id="smtp-host"
                          value={draft.smtpHost}
                          onChange={(event) => setDraft((current) => current ? { ...current, smtpHost: event.target.value } : current)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">Porta</Label>
                        <Input
                          id="smtp-port"
                          value={draft.smtpPort}
                          onChange={(event) => setDraft((current) => current ? { ...current, smtpPort: event.target.value } : current)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-user">Usuário</Label>
                        <Input
                          id="smtp-user"
                          value={draft.smtpUser}
                          onChange={(event) => setDraft((current) => current ? { ...current, smtpUser: event.target.value } : current)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-from">Remetente</Label>
                        <Input
                          id="smtp-from"
                          value={draft.smtpFrom}
                          onChange={(event) => setDraft((current) => current ? { ...current, smtpFrom: event.target.value } : current)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-pass">Senha</Label>
                      <Input
                        id="smtp-pass"
                        type="password"
                        placeholder={config.smtp.passMasked || 'Digite a senha SMTP'}
                        value={draft.smtpPass}
                        onChange={(event) => setDraft((current) => current ? { ...current, smtpPass: event.target.value } : current)}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    activeIntegration &&
                    void handleTest(activeIntegration, { persistDraft: true })
                  }
                  disabled={testing === activeIntegration || saving}
                >
                  {testing === activeIntegration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Testar integração
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProspeccaoIntegracoesPage
