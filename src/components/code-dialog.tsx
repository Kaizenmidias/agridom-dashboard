import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner"
import { Code, InsertCode, UpdateCode } from "@/types/database"
import { createCode, updateCode } from "@/api/crud"

interface CodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code?: Code | null
  onSuccess: () => void
}

const codeTypeOptions = [
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "javascript", label: "JavaScript" }
]

export function CodeDialog({ open, onOpenChange, code, onSuccess }: CodeDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    language: "css" as "css" | "html" | "javascript",
    code_content: "",
    description: ""
  })
  const [isLoading, setIsLoading] = useState(false)

  const isEditing = !!code

  useEffect(() => {
    if (code) {
      setFormData({
        title: code.title,
        language: code.language,
        code_content: code.code_content,
        description: code.description || ""
      })
    } else {
      setFormData({
        title: "",
        language: "css",
        code_content: "",
        description: ""
      })
    }
  }, [code, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório")
      return
    }
    
    if (!formData.code_content.trim()) {
      toast.error("Conteúdo do código é obrigatório")
      return
    }

    setIsLoading(true)

    try {
      if (isEditing && code) {
        const updateData: UpdateCode = {
          title: formData.title.trim(),
          language: formData.language,
          code_content: formData.code_content.trim(),
          description: formData.description.trim() || null
        }
        
        await updateCode(code.id.toString(), updateData)
        toast.success("Código atualizado com sucesso!")
      } else {
        const insertData: InsertCode = {
          title: formData.title.trim(),
          language: formData.language,
          code_content: formData.code_content.trim(),
          description: formData.description.trim() || null
        }
        
        await createCode(insertData)
        toast.success("Código criado com sucesso!")
      }
      
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Erro ao salvar código:", error)
      toast.error(error.response?.data?.error || "Erro ao salvar código")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Código" : "Novo Código"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Edite as informações do código abaixo."
              : "Adicione um novo snippet de código à sua biblioteca."
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ex: Botão Animado"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="language">Linguagem *</Label>
              <Select
                value={formData.language}
                onValueChange={(value: "css" | "html" | "javascript") => 
                  handleInputChange("language", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {codeTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Breve descrição do código (opcional)"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="code_content">Código *</Label>
            <Textarea
              id="code_content"
              placeholder="Cole seu código aqui..."
              value={formData.code_content}
              onChange={(e) => handleInputChange("code_content", e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              required
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading 
                ? (isEditing ? "Atualizando..." : "Criando...") 
                : (isEditing ? "Atualizar" : "Criar")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}