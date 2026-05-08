import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Calendar, User, MoreVertical, GripVertical, Edit, Trash2, Mail, MessageSquare, Paperclip, Share2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, isPast } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getBriefings, updateBriefing, deleteBriefing, Briefing } from "@/api/crud"
import { NovoBriefingDialog } from "@/components/novo-briefing-dialog"
import { EmailToBoardDialog } from "@/components/email-to-board-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const KANBAN_COLUMNS = [
  { id: 'new', title: 'Novos projetos', color: 'bg-blue-400' },
  { id: 'developing', title: 'Desenvolvendo', color: 'bg-purple-500' },
  { id: 'changes', title: 'Alterações', color: 'bg-orange-500' },
  { id: 'completed', title: 'Concluído', color: 'bg-green-500' },
  { id: 'standby', title: 'Stand By', color: 'bg-gray-500' }
]

const priorityColors = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500'
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
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive"
      })
    }
  }

  const handleDeleteBriefing = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este briefing?')) {
      try {
        await deleteBriefing(id)
        setBriefings(prev => prev.filter(b => b.id !== id))
        toast({
          title: "Briefing excluído",
          description: "O briefing foi removido com sucesso."
        })
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o briefing.",
          variant: "destructive"
        })
      }
    }
  }

  const filteredBriefings = briefings.filter(briefing =>
    briefing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (briefing.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (briefing.client || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getBriefingsByStatus = (status: string) => {
    // Mapear status antigos para novos se necessário para visualização
    const mappedStatus = status === 'pending' ? 'new' : 
                         status === 'in_progress' ? 'developing' :
                         status === 'cancelled' ? 'standby' : status;
    
    return filteredBriefings.filter(b => {
      const bStatus = b.status === 'pending' ? 'new' : 
                      b.status === 'in_progress' ? 'developing' :
                      b.status === 'cancelled' ? 'standby' : b.status;
      return bStatus === status;
    })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh] bg-[#0d1117]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden bg-[#0d1117] text-gray-200">
      {/* Sub-header */}
      <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Projetos Web</h1>
          <div className="p-1 hover:bg-white/10 rounded cursor-pointer transition-colors">
            <Share2 className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              placeholder="Buscar no quadro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#161b22] border-none text-gray-200 placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-gray-700 h-9"
            />
          </div>
          <NovoBriefingDialog onBriefingChange={loadBriefings}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="h-4 w-4" />
              Novo Briefing
            </Button>
          </NovoBriefingDialog>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 h-full min-w-max">
          {KANBAN_COLUMNS.map((column) => (
            <div key={column.id} className="w-[280px] flex flex-col bg-[#161b22] rounded-xl h-full max-h-full">
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between group">
                <h3 className="font-semibold text-sm px-2 text-gray-300 truncate">
                  {column.title}
                </h3>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium text-gray-500 mr-1">
                    {getBriefingsByStatus(column.id).length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:bg-white/10 hover:text-gray-300">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Logo Placeholder (Similar to the image) */}
              <div className="px-3 mb-2">
                <div className="aspect-video bg-[#0d1117] rounded-lg flex items-center justify-center border border-white/5 overflow-hidden group relative">
                  <div className="text-4xl font-bold bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">K.</div>
                  <div className="absolute bottom-2 left-3 right-3 text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate">
                    {column.title}
                  </div>
                </div>
              </div>

              {/* Column Content */}
              <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 transition-colors">
                {getBriefingsByStatus(column.id).map((briefing) => (
                  <Card key={briefing.id} className="bg-[#21262d] border-none shadow-sm hover:ring-1 hover:ring-blue-500/50 transition-all cursor-pointer group">
                    <CardContent className="p-3 space-y-3">
                      {/* Priority Tag */}
                      <div className={`w-8 h-1 rounded-full ${priorityColors[briefing.priority || 'medium']}`} />
                      
                      <div className="space-y-1.5">
                        <h4 className="text-[13px] font-medium text-gray-200 leading-snug line-clamp-3">
                          {briefing.title}
                        </h4>
                        
                        <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                          <span className="truncate">{briefing.client || briefing.client_name || 'Sem cliente'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          {briefing.deadline && (
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${isPast(new Date(briefing.deadline)) ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400'}`}>
                              <Calendar className="h-3 w-3" />
                              {format(new Date(briefing.deadline), 'd MMM', { locale: ptBR })}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-gray-500">
                             <Mail className="h-3 w-3" />
                             <MessageSquare className="h-3 w-3" />
                             <Paperclip className="h-3 w-3" />
                          </div>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <NovoBriefingDialog briefing={briefing} onBriefingChange={loadBriefings}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white hover:bg-white/10">
                              <Edit className="h-3 w-3" />
                            </Button>
                          </NovoBriefingDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white hover:bg-white/10">
                                <GripVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#161b22] border-gray-800 text-gray-300">
                              {KANBAN_COLUMNS.filter(c => c.id !== column.id).map(c => (
                                <DropdownMenuItem 
                                  key={c.id} 
                                  onClick={() => handleMoveBriefing(briefing.id, c.id as Briefing['status'])}
                                  className="hover:bg-white/5 focus:bg-white/5"
                                >
                                  Mover para {c.title}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem 
                                className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
                                onClick={() => handleDeleteBriefing(briefing.id)}
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Column Footer */}
              <div className="p-2 mt-auto">
                <NovoBriefingDialog onBriefingChange={loadBriefings}>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-gray-400 hover:bg-white/5 hover:text-gray-200 text-[13px] font-normal gap-2 h-9 px-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar um cartão
                  </Button>
                </NovoBriefingDialog>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Navigation (Like in the image) */}
      <div className="h-12 border-t border-white/5 bg-[#0d1117] flex items-center justify-center px-6 gap-8">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer hover:text-gray-300">
          <Mail className="h-3.5 w-3.5" />
          Caixa de entrada
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer hover:text-gray-300">
          <Calendar className="h-3.5 w-3.5" />
          Planejador
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-500 border-b-2 border-blue-500 h-full px-2">
          <GripVertical className="h-3.5 w-3.5" />
          Quadro
        </div>
        <EmailToBoardDialog>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer hover:text-gray-300">
            <Mail className="h-3.5 w-3.5" />
            E-mail para quadro
          </div>
        </EmailToBoardDialog>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer hover:text-gray-300">
          <Share2 className="h-3.5 w-3.5" />
          Mudar de quadros
        </div>
      </div>
    </div>
  )
}
