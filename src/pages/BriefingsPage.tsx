import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Calendar, User, MoreVertical, GripVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getBriefings, updateBriefing, Briefing } from "@/api/crud"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const KANBAN_COLUMNS = [
  { id: 'pending', title: 'Pendentes', color: 'bg-yellow-500' },
  { id: 'in_progress', title: 'Em Andamento', color: 'bg-blue-500' },
  { id: 'completed', title: 'Concluídos', color: 'bg-green-500' },
  { id: 'cancelled', title: 'Cancelados', color: 'bg-red-500' }
]

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
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBriefings()
  }, [])

  const loadBriefings = async () => {
    try {
      setLoading(true)
      const data = await getBriefings()
      setBriefings(data)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os briefings.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMoveBriefing = async (id: string, newStatus: Briefing['status']) => {
    try {
      const updated = await updateBriefing(id, { status: newStatus })
      setBriefings(prev => prev.map(b => b.id === id ? updated : b))
      toast({
        title: "Status atualizado",
        description: `Briefing movido para ${newStatus}.`
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive"
      })
    }
  }

  const filteredBriefings = briefings.filter(briefing =>
    briefing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (briefing.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (briefing.client || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getBriefingsByStatus = (status: string) => {
    return filteredBriefings.filter(b => b.status === status)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden bg-muted/20">
      {/* Sub-header fixo */}
      <div className="p-6 pb-2 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Briefings</h1>
            <p className="text-muted-foreground text-sm">Quadro estilo Kanban para gestão de projetos</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Briefing
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar briefings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto p-6 pt-2">
        <div className="flex gap-6 h-full min-w-max pb-4">
          {KANBAN_COLUMNS.map((column) => (
            <div key={column.id} className="w-80 flex flex-col bg-muted/50 rounded-lg border border-border/50">
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${column.color}`}></div>
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    {column.title}
                  </h3>
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-bold">
                    {getBriefingsByStatus(column.id).length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 transition-colors">
                {getBriefingsByStatus(column.id).map((briefing) => (
                  <Card key={briefing.id} className="group hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing bg-white shadow-sm hover:shadow-md">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex justify-between items-start">
                        <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[briefing.priority || 'medium']}`}>
                          {priorityLabels[briefing.priority || 'medium']}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {KANBAN_COLUMNS.filter(c => c.id !== column.id).map(c => (
                              <DropdownMenuItem 
                                key={c.id} 
                                onClick={() => handleMoveBriefing(briefing.id, c.id as Briefing['status'])}
                              >
                                Mover para {c.title}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-medium text-sm leading-tight line-clamp-2">{briefing.title}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">{briefing.client || briefing.client_name || 'Sem cliente'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <Calendar className="h-3 w-3" />
                          {briefing.deadline ? format(new Date(briefing.deadline), 'dd MMM', { locale: ptBR }) : 'S/ prazo'}
                        </div>
                        {briefing.budget && (
                          <div className="text-[10px] font-bold text-green-600">
                            R$ {Number(briefing.budget).toLocaleString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* Empty State in Column */}
                {getBriefingsByStatus(column.id).length === 0 && (
                  <div className="h-24 border-2 border-dashed border-muted-foreground/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/50 italic">Vazio</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
