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

interface NovoProjetoDialogProps {
  children: React.ReactNode
}

export function NovoProjetoDialog({ children }: NovoProjetoDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [projeto, setProjeto] = useState({
    nome: "",
    cliente: "",
    tipo: "",
    descricao: "",
    valor: "",
    valorPago: "",
    dataEntrega: undefined as Date | undefined,
    status: "Planejamento"
  })

  const resetForm = () => {
    setProjeto({
      nome: "",
      cliente: "",
      tipo: "",
      descricao: "",
      valor: "",
      valorPago: "",
      dataEntrega: undefined,
      status: "Planejamento"
    })
  }

  const handleSave = () => {
    // Validação básica
    if (!projeto.nome || !projeto.cliente || !projeto.tipo || !projeto.valor) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    // Validar valores
    const valor = parseFloat(projeto.valor.replace(/[^\d,]/g, '').replace(',', '.'))
    const valorPago = projeto.valorPago ? parseFloat(projeto.valorPago.replace(/[^\d,]/g, '').replace(',', '.')) : 0

    if (isNaN(valor) || valor <= 0) {
      toast({
        title: "Erro",
        description: "Valor do projeto deve ser um número válido",
        variant: "destructive"
      })
      return
    }

    if (valorPago > valor) {
      toast({
        title: "Erro",
        description: "Valor pago não pode ser maior que o valor total",
        variant: "destructive"
      })
      return
    }

    // Simular salvamento
    console.log("Novo projeto:", projeto)
    
    toast({
      title: "Projeto criado",
      description: `O projeto "${projeto.nome}" foi criado com sucesso`
    })
    
    resetForm()
    setOpen(false)
  }

  const formatCurrency = (value: string) => {
    const number = value.replace(/[^\d]/g, '')
    if (!number) return ''
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseInt(number) / 100)
    return formatted
  }

  const handleValueChange = (field: 'valor' | 'valorPago', value: string) => {
    const formatted = formatCurrency(value)
    setProjeto(prev => ({ ...prev, [field]: formatted }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
          <DialogDescription>
            Preencha as informações do novo projeto de web design
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Informações Básicas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Projeto *</Label>
              <Input
                id="nome"
                value={projeto.nome}
                onChange={(e) => setProjeto(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Site Institucional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente *</Label>
              <Input
                id="cliente"
                value={projeto.cliente}
                onChange={(e) => setProjeto(prev => ({ ...prev, cliente: e.target.value }))}
                placeholder="Ex: Empresa XYZ"
              />
            </div>
          </div>

          {/* Tipo e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Projeto *</Label>
              <Select value={projeto.tipo} onValueChange={(value) => setProjeto(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="website">Website Institucional</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="landing">Landing Page</SelectItem>
                  <SelectItem value="sistema">Sistema Web</SelectItem>
                  <SelectItem value="app">Aplicativo</SelectItem>
                  <SelectItem value="marketing">Marketing Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={projeto.status} onValueChange={(value) => setProjeto(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="Planejamento">Planejamento</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Revisão">Revisão</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={projeto.descricao}
              onChange={(e) => setProjeto(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva os detalhes do projeto..."
              rows={3}
            />
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor Total *</Label>
              <Input
                id="valor"
                value={projeto.valor}
                onChange={(e) => handleValueChange('valor', e.target.value)}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorPago">Valor Pago</Label>
              <Input
                id="valorPago"
                value={projeto.valorPago}
                onChange={(e) => handleValueChange('valorPago', e.target.value)}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          {/* Data de Entrega */}
          <div className="space-y-2">
            <Label>Data de Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !projeto.dataEntrega && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {projeto.dataEntrega ? (
                    format(projeto.dataEntrega, "dd/MM/yyyy", { locale: pt })
                  ) : (
                    <span>Selecionar data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background" align="start">
                <Calendar
                  mode="single"
                  selected={projeto.dataEntrega}
                  onSelect={(date) => setProjeto(prev => ({ ...prev, dataEntrega: date }))}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Resumo */}
          {projeto.valor && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Resumo Financeiro</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor Total:</span>
                  <span className="font-medium">{projeto.valor}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Pago:</span>
                  <span className="font-medium">{projeto.valorPago || "R$ 0,00"}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span>Saldo Restante:</span>
                  <span className="font-medium text-orange-600">
                    {formatCurrency(
                      ((parseFloat(projeto.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0) * 100 - 
                       (parseFloat(projeto.valorPago?.replace(/[^\d,]/g, '').replace(',', '.')) || 0) * 100).toString()
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Projeto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}