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
import { formatCurrencyMask, parseCurrencyValue } from "@/utils/currency-mask"

interface Projeto {
  id: number;
  nome: string;
  cliente: string;
  status: string;
  prazo: string;
  valor: string;
  valorNumerico: number;
  valorPago: number;
  progresso: number;
  tipo: string;
}

interface NovoProjetoDialogProps {
  children: React.ReactNode;
  projeto?: Projeto;
  setProjetos?: React.Dispatch<React.SetStateAction<Projeto[]>>;
  projetos?: Projeto[];
}

export function NovoProjetoDialog({ children, projeto, setProjetos, projetos }: NovoProjetoDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const isEditing = !!projeto
  
  const [projetoForm, setProjetoForm] = useState({
    nome: projeto?.nome || "",
    cliente: projeto?.cliente || "",
    tipo: projeto?.tipo || "",
    descricao: "",
    valor: projeto?.valorNumerico ? formatCurrencyMask((projeto.valorNumerico * 100).toString()) : "",
    valorPago: projeto?.valorPago ? formatCurrencyMask((projeto.valorPago * 100).toString()) : "",
    dataEntrega: projeto?.prazo ? new Date(projeto.prazo) : undefined as Date | undefined,
    status: projeto?.status || "Em Andamento"
  })

  const resetForm = () => {
    if (!isEditing) {
      setProjetoForm({
        nome: "",
        cliente: "",
        tipo: "",
        descricao: "",
        valor: "",
        valorPago: "",
        dataEntrega: undefined,
        status: "Em Andamento"
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!projetoForm.nome || !projetoForm.cliente || !projetoForm.tipo || !projetoForm.valor || !projetoForm.dataEntrega) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      })
      return
    }

    const valorNumerico = parseCurrencyValue(projetoForm.valor)
    const valorPagoNumerico = parseCurrencyValue(projetoForm.valorPago)

    if (isEditing && setProjetos && projetos) {
      // Editar projeto existente
      const projetosAtualizados = projetos.map(p => 
        p.id === projeto.id 
          ? {
              ...p,
              nome: projetoForm.nome,
              cliente: projetoForm.cliente,
              tipo: projetoForm.tipo,
              valor: valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
              valorNumerico,
              valorPago: valorPagoNumerico,
              prazo: projetoForm.dataEntrega!.toISOString().split('T')[0],
              status: projetoForm.status
            }
          : p
      )
      setProjetos(projetosAtualizados)
      
      toast({
        title: "Projeto atualizado",
        description: `O projeto "${projetoForm.nome}" foi atualizado com sucesso.`,
      })
    } else {
      // Criar novo projeto
      toast({
        title: "Projeto criado",
        description: `O projeto "${projetoForm.nome}" foi criado com sucesso.`,
      })
    }

    setOpen(false)
    resetForm()
  }

  const handleValueChange = (field: 'valor' | 'valorPago', value: string) => {
    const formatted = formatCurrencyMask(value)
    setProjetoForm(prev => ({ ...prev, [field]: formatted }))
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
              <Label htmlFor="nome">Nome do Projeto *</Label>
              <Input
                id="nome"
                value={projetoForm.nome}
                onChange={(e) => setProjetoForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome do projeto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente *</Label>
              <Input
                id="cliente"
                value={projetoForm.cliente}
                onChange={(e) => setProjetoForm(prev => ({ ...prev, cliente: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Projeto *</Label>
              <Select 
                value={projetoForm.tipo} 
                onValueChange={(value) => setProjetoForm(prev => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Website Institucional">Website Institucional</SelectItem>
                  <SelectItem value="E-commerce">E-commerce</SelectItem>
                  <SelectItem value="Landing Page">Landing Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={projetoForm.status} 
                onValueChange={(value) => setProjetoForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={projetoForm.descricao}
              onChange={(e) => setProjetoForm(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva o projeto..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor do Projeto *</Label>
              <Input
                id="valor"
                value={projetoForm.valor}
                onChange={(e) => handleValueChange('valor', e.target.value)}
                placeholder="0,00"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorPago">Valor Pago</Label>
              <Input
                id="valorPago"
                value={projetoForm.valorPago}
                onChange={(e) => handleValueChange('valorPago', e.target.value)}
                placeholder="0,00"
                type="text"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data de Entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !projetoForm.dataEntrega && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon />
                  {projetoForm.dataEntrega ? format(projetoForm.dataEntrega, "dd 'de' MMMM 'de' yyyy", { locale: pt }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={projetoForm.dataEntrega}
                  onSelect={(date) => setProjetoForm(prev => ({ ...prev, dataEntrega: date }))}
                  disabled={(date) =>
                    date < new Date()
                  }
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="w-full">
              {isEditing ? 'Atualizar Projeto' : 'Criar Projeto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}