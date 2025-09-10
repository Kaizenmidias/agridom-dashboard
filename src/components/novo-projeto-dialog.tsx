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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, Plus } from "lucide-react"
import { format } from "date-fns"
import { pt } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createProject, updateProject, Project } from "@/api/crud"
import { useAuth } from "@/contexts/AuthContext"

interface NovoProjetoDialogProps {
  children: React.ReactNode;
  projeto?: Project;
  onProjectChange?: () => void;
}

export function NovoProjetoDialog({ children, projeto, onProjectChange }: NovoProjetoDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const isEditing = !!projeto
  
  // Função para formatar número para moeda
  const formatCurrency = (value: number | null | undefined) => {
    if (!value || typeof value !== 'number') return "";
    return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const [projetoForm, setProjetoForm] = useState({
    name: projeto?.name || "",
    client: projeto?.client || "",
    project_type: projeto?.project_type || "",
    status: projeto?.status || "active",
    description: projeto?.description || "",
    project_value: formatCurrency(projeto?.project_value),
    paid_value: formatCurrency(projeto?.paid_value),
    delivery_date: projeto?.delivery_date || ""
  })

  const resetForm = () => {
    if (!isEditing) {
      setProjetoForm({
        name: "",
        client: "",
        project_type: "",
        status: "active",
        description: "",
        project_value: "",
        paid_value: "",
        delivery_date: ""
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!projetoForm.name) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    
    try {
      // Função para converter valor com máscara para número
        const convertCurrencyToNumber = (value: string) => {
          if (!value) return null;
          return parseFloat(value.replace(/[R$\s\.]/g, '').replace(',', '.'));
        };

        if (!user) {
          toast({
            title: "Erro",
            description: "Usuário não autenticado.",
            variant: "destructive",
          })
          return
        }

        const projectData = {
          name: projetoForm.name,
          client: projetoForm.client,
          project_type: projetoForm.project_type,
          status: projetoForm.status,
          description: projetoForm.description,
          project_value: convertCurrencyToNumber(projetoForm.project_value),
          paid_value: convertCurrencyToNumber(projetoForm.paid_value),
          delivery_date: projetoForm.delivery_date || null,
          user_id: user.id, // ID do usuário autenticado
          completion_date: null
        }

      if (isEditing && projeto) {
        // Editar projeto existente
        await updateProject(projeto.id, projectData)
        toast({
          title: "Projeto atualizado",
          description: `O projeto "${projetoForm.name}" foi atualizado com sucesso.`,
        })
      } else {
        // Criar novo projeto
        await createProject(projectData)
        toast({
          title: "Projeto criado",
          description: `O projeto "${projetoForm.name}" foi criado com sucesso.`,
        })
      }

      setOpen(false)
      resetForm()
      
      // Notificar o componente pai para recarregar os dados
      if (onProjectChange) {
        onProjectChange()
      }
    } catch (error) {
      console.error('Erro ao salvar projeto:', error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o projeto. Tente novamente.",
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
          <DialogTitle>{isEditing ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edite as informações do projeto abaixo.' : 'Preencha as informações do novo projeto abaixo.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Projeto *</Label>
              <Input
                id="name"
                value={projetoForm.name}
                onChange={(e) => setProjetoForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Digite o nome do projeto"
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Input
                id="client"
                value={projetoForm.client}
                onChange={(e) => setProjetoForm(prev => ({ ...prev, client: e.target.value }))}
                placeholder="Nome do cliente"
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_type">Tipo de Projeto</Label>
              <Select 
                value={projetoForm.project_type} 
                onValueChange={(value) => setProjetoForm(prev => ({ ...prev, project_type: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Site institucional</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={projetoForm.status} 
                onValueChange={(value) => setProjetoForm(prev => ({ ...prev, status: value as 'paused' | 'active' | 'completed' | 'cancelled' }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={projetoForm.description}
              onChange={(e) => setProjetoForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o projeto..."
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="project_value">Valor do Projeto</Label>
               <Input
                 id="project_value"
                 value={projetoForm.project_value}
                 onChange={(e) => {
                   let value = e.target.value.replace(/\D/g, '');
                   if (value) {
                     value = (parseInt(value) / 100).toFixed(2);
                     value = value.replace('.', ',');
                     value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                     value = 'R$ ' + value;
                   }
                   setProjetoForm(prev => ({ ...prev, project_value: value }));
                 }}
                 placeholder="R$ 0,00"
                 disabled={loading}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="paid_value">Valor Pago</Label>
               <Input
                 id="paid_value"
                 value={projetoForm.paid_value}
                 onChange={(e) => {
                   let value = e.target.value.replace(/\D/g, '');
                   if (value) {
                     value = (parseInt(value) / 100).toFixed(2);
                     value = value.replace('.', ',');
                     value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                     value = 'R$ ' + value;
                   }
                   setProjetoForm(prev => ({ ...prev, paid_value: value }));
                 }}
                 placeholder="R$ 0,00"
                 disabled={loading}
               />
             </div>
           </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_date">Data de Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !projetoForm.delivery_date && "text-muted-foreground"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {projetoForm.delivery_date ? format(new Date(projetoForm.delivery_date), "dd/MM/yyyy", { locale: pt }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={projetoForm.delivery_date ? new Date(projetoForm.delivery_date + 'T00:00:00.000Z') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      // Usar UTC para evitar problemas de fuso horário
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      setProjetoForm(prev => ({ ...prev, delivery_date: `${year}-${month}-${day}` }));
                    }
                  }}
                  initialFocus
                  locale={pt}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvando...' : (isEditing ? 'Atualizar Projeto' : 'Criar Projeto')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}