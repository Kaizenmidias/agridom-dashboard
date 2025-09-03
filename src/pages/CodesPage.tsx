import React, { useState, useEffect } from "react"
import { Plus, Search, Copy, Edit, Trash2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Code } from "@/types/database"
import { CodeDialog } from "@/components/code-dialog"
import { deleteCode, getCodes } from "@/api/crud"
import { ToastNotification, useToastNotification } from "@/components/ui/toast-notification"

const codeTypeLabels = {
  css: "CSS",
  html: "HTML",
  javascript: "JavaScript"
}

const codeTypeColors = {
  css: "bg-blue-100 text-blue-800",
  html: "bg-orange-100 text-orange-800",
  javascript: "bg-yellow-100 text-yellow-800"
}

export function CodesPage() {
  const [codes, setCodes] = useState<Code[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<Code | null>(null)
  const { toast: toastNotification, showToast, hideToast } = useToastNotification()

  // Carregar códigos da API
  useEffect(() => {
    loadCodes()
  }, [])

  const loadCodes = async () => {
    try {
      setIsLoading(true)
      const codesData = await getCodes()
      setCodes(codesData)
    } catch (error) {
      console.error('Erro ao carregar códigos:', error)
      showToast('Erro ao carregar códigos')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCodes = codes.filter(code => {
    const matchesSearch = code.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (code.description && code.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = selectedType === "all" || code.language === selectedType
    return matchesSearch && matchesType
  })

  const copyToClipboard = async (content: string, name: string) => {
    try {
      await navigator.clipboard.writeText(content)
      showToast("Copiado")
    } catch (error) {
      toast.error("Erro ao copiar código")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateCode = (code: string, maxLength: number = 100) => {
    if (code.length <= maxLength) return code
    return code.substring(0, maxLength) + "..."
  }

  const handleNewCode = () => {
    setEditingCode(null)
    setDialogOpen(true)
  }

  const handleEditCode = (code: Code) => {
    setEditingCode(code)
    setDialogOpen(true)
  }

  const handleDeleteCode = async (code: Code) => {
    if (!confirm(`Tem certeza que deseja excluir o código "${code.title}"?`)) {
      return
    }

    try {
      await deleteCode(code.id)
      setCodes(prev => prev.filter(c => c.id !== code.id))
      toast.success("Código excluído com sucesso!")
    } catch (error: any) {
      console.error("Erro ao excluir código:", error)
      toast.error(error.response?.data?.error || "Erro ao excluir código")
    }
  }

  const handleDialogSuccess = () => {
    loadCodes()
    toast.success("Lista atualizada!")
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Códigos</h1>
          <p className="text-muted-foreground">
            Gerencie seus snippets de código CSS, HTML e JavaScript
          </p>
        </div>
        <Button onClick={handleNewCode}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Código
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar códigos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="css">CSS</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm || selectedType !== "all" 
                    ? "Nenhum código encontrado com os filtros aplicados"
                    : "Nenhum código cadastrado"
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-medium">{code.title}</TableCell>
                  <TableCell>
                    <Badge className={codeTypeColors[code.language]}>
                      {codeTypeLabels[code.language]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {truncateCode(code.code_content)}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {code.description && (
                      <span className="text-sm text-muted-foreground">
                        {code.description.length > 50 
                          ? code.description.substring(0, 50) + "..."
                          : code.description
                        }
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(code.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(code.code_content, code.title)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditCode(code)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteCode(code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ToastNotification
        message={toastNotification.message}
        isVisible={toastNotification.isVisible}
        onClose={hideToast}
      />

      <CodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        code={editingCode}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}