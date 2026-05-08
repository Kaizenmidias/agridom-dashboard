import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createBriefing, updateBriefing, Briefing } from "@/api/crud"
import { useAuth } from "@/contexts/AuthContext"

interface NovoBriefingDialogProps {
  children: React.ReactNode;
  briefing?: Briefing;
  onBriefingChange?: () => void;
}

export function NovoBriefingDialog({ children, briefing, onBriefingChange }: NovoBriefingDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const isEditing = !!briefing

  const [form, setForm] = useState({
    title: briefing?.title || "",
    client_name: briefing?.client_name || briefing?.client || "",
    content: briefing?.content || "",
    budget: briefing?.budget?.toString() || "",
    deadline: briefing?.deadline || "",
    status: briefing?.status || "new",
    priority: briefing?.priority || "medium"
  })

  const resetForm = () => {
    if (!isEditing) {
      setForm({
        title: "",
        client_name: "",
        content: "",
        budget: "",
        deadline: "",
        status: "new",
        priority: "medium"
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.title || !form.content) {
      toast({
        title: "Erro",
        description: "Título e Conteúdo são obrigatórios.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    
    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado.",
          variant: "destructive",
        })
        return
      }

      const briefingData = {
        ...form,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        user_id: user.id
      }

      if (isEditing && briefing) {
        await updateBriefing(briefing.id, briefingData)
        toast({
          title: "Briefing atualizado",
          description: `O briefing "${form.title}" foi atualizado com sucesso.`,
        })
      } else {
        await createBriefing(briefingData as any)
        toast({
          title: "Briefing criado",
          description: `O briefing "${form.title}" foi criado com sucesso.`,
        })
      }

      setOpen(false)
      resetForm()
      
      if (onBriefingChange) {
        onBriefingChange()
      }
    } catch (error) {
      console.error('Erro ao salvar briefing:', error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o briefing. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Briefing' : 'Novo Briefing'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edite as informações do briefing abaixo.' : 'Preencha as informações do novo briefing abaixo.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do Briefing *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Novo Site E-commerce"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_name">Cliente</Label>
            <Input
              id="client_name"
              value={form.client_name}
              onChange={(e) => setForm(prev => ({ ...prev, client_name: e.target.value }))}
              placeholder="Nome do cliente"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select 
                value={form.priority} 
                onValueChange={(value) => setForm(prev => ({ ...prev, priority: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={form.status} 
                onValueChange={(value) => setForm(prev => ({ ...prev, status: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Novos projetos</SelectItem>
                  <SelectItem value="developing">Desenvolvendo</SelectItem>
                  <SelectItem value="changes">Alterações</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="standby">Stand By</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Orçamento (R$)</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                value={form.budget}
                onChange={(e) => setForm(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm(prev => ({ ...prev, deadline: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo / Descrição *</Label>
            <Textarea
              id="content"
              value={form.content}
              onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Descreva os detalhes do briefing..."
              className="min-h-[150px]"
              disabled={loading}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="px-8">
              {loading ? 'Salvando...' : 'Salvar Briefing'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
