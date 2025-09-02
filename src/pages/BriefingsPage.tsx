import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Calendar, User, FileText, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Briefing {
  id: string
  title: string
  client: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  deadline: string
  created_at: string
  updated_at: string
}

const mockBriefings: Briefing[] = [
  {
    id: '1',
    title: 'Campanha de Marketing Digital',
    client: 'Empresa ABC',
    description: 'Desenvolvimento de estratégia de marketing digital para lançamento de produto',
    status: 'in_progress',
    priority: 'high',
    deadline: '2024-02-15',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z'
  },
  {
    id: '2',
    title: 'Redesign do Website',
    client: 'Startup XYZ',
    description: 'Reformulação completa da interface e experiência do usuário',
    status: 'pending',
    priority: 'medium',
    deadline: '2024-03-01',
    created_at: '2024-01-12T09:15:00Z',
    updated_at: '2024-01-12T09:15:00Z'
  },
  {
    id: '3',
    title: 'Consultoria em Processos',
    client: 'Indústria 123',
    description: 'Análise e otimização de processos internos da empresa',
    status: 'completed',
    priority: 'low',
    deadline: '2024-01-30',
    created_at: '2024-01-05T16:20:00Z',
    updated_at: '2024-01-28T11:45:00Z'
  }
]

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
}

const statusLabels = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado'
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800 border-gray-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-red-100 text-red-800 border-red-200'
}

const priorityLabels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta'
}

export default function BriefingsPage() {
  const { toast } = useToast()
  const [briefings, setBriefings] = useState<Briefing[]>(mockBriefings)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const filteredBriefings = briefings.filter(briefing => {
    const matchesSearch = briefing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         briefing.client.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || briefing.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || briefing.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleCreateBriefing = () => {
    toast({
      title: "Em desenvolvimento",
      description: "Funcionalidade de criação de briefings será implementada em breve."
    })
  }

  const handleEditBriefing = (id: string) => {
    toast({
      title: "Em desenvolvimento",
      description: "Funcionalidade de edição de briefings será implementada em breve."
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Briefings</h1>
          <p className="text-muted-foreground">
            Gerencie seus briefings e solicitações de projetos
          </p>
        </div>
        <Button onClick={handleCreateBriefing} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Briefing
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar briefings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">Todos os Status</option>
                <option value="pending">Pendente</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">Todas as Prioridades</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Briefings Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBriefings.map((briefing) => (
          <Card key={briefing.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleEditBriefing(briefing.id)}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{briefing.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {briefing.client}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1">
                  <Badge className={`text-xs ${statusColors[briefing.status]}`}>
                    {statusLabels[briefing.status]}
                  </Badge>
                  <Badge className={`text-xs ${priorityColors[briefing.priority]}`}>
                    {priorityLabels[briefing.priority]}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {briefing.description}
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Prazo: {format(new Date(briefing.deadline), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Criado: {format(new Date(briefing.created_at), 'dd/MM', { locale: ptBR })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBriefings.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum briefing encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece criando seu primeiro briefing'}
              </p>
              {!searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
                <Button onClick={handleCreateBriefing}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Briefing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}