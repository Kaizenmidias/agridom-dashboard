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
import { useToast } from "@/hooks/use-toast"
import { createCompanyAccess, updateCompanyAccess, CompanyAccess } from "@/api/crud"
import { useAuth } from "@/contexts/AuthContext"

interface NovoAcessoDialogProps {
  children: React.ReactNode;
  acesso?: CompanyAccess;
  onAcessoChange?: () => void;
}

export function NovoAcessoDialog({ children, acesso, onAcessoChange }: NovoAcessoDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const isEditing = !!acesso

  const [acessoForm, setAcessoForm] = useState({
    company_name: acesso?.company_name || "",
    wordpress_login: acesso?.wordpress_login || "",
    wordpress_password: acesso?.wordpress_password || "",
    domain_login: acesso?.domain_login || "",
    domain_password: acesso?.domain_password || "",
    hosting_login: acesso?.hosting_login || "",
    hosting_password: acesso?.hosting_password || ""
  })

  const resetForm = () => {
    if (!isEditing) {
      setAcessoForm({
        company_name: "",
        wordpress_login: "",
        wordpress_password: "",
        domain_login: "",
        domain_password: "",
        hosting_login: "",
        hosting_password: ""
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acessoForm.company_name) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o nome da empresa.",
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

      const accessData = {
        ...acessoForm,
        user_id: user.id
      }

      if (isEditing && acesso) {
        await updateCompanyAccess(acesso.id, accessData)
        toast({
          title: "Acesso atualizado",
          description: `Os acessos da empresa "${acessoForm.company_name}" foram atualizados com sucesso.`,
        })
      } else {
        await createCompanyAccess(accessData)
        toast({
          title: "Acesso criado",
          description: `Os acessos da empresa "${acessoForm.company_name}" foram criados com sucesso.`,
        })
      }

      setOpen(false)
      resetForm()
      
      if (onAcessoChange) {
        onAcessoChange()
      }
    } catch (error) {
      console.error('Erro ao salvar acesso:', error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar os acessos. Tente novamente.",
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
          <DialogTitle>{isEditing ? 'Editar Acessos' : 'Novos Acessos'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edite as informações de acesso da empresa abaixo.' : 'Preencha as informações de acesso da nova empresa abaixo.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Nome da Empresa *</Label>
            <Input
              id="company_name"
              value={acessoForm.company_name}
              onChange={(e) => setAcessoForm(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="Digite o nome da empresa"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">WordPress</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wordpress_login">Login</Label>
                <Input
                  id="wordpress_login"
                  value={acessoForm.wordpress_login}
                  onChange={(e) => setAcessoForm(prev => ({ ...prev, wordpress_login: e.target.value }))}
                  placeholder="Login WordPress"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wordpress_password">Senha</Label>
                <Input
                  id="wordpress_password"
                  type="password"
                  value={acessoForm.wordpress_password}
                  onChange={(e) => setAcessoForm(prev => ({ ...prev, wordpress_password: e.target.value }))}
                  placeholder="Senha WordPress"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">Domínio</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="domain_login">Login</Label>
                <Input
                  id="domain_login"
                  value={acessoForm.domain_login}
                  onChange={(e) => setAcessoForm(prev => ({ ...prev, domain_login: e.target.value }))}
                  placeholder="Login Domínio"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain_password">Senha</Label>
                <Input
                  id="domain_password"
                  type="password"
                  value={acessoForm.domain_password}
                  onChange={(e) => setAcessoForm(prev => ({ ...prev, domain_password: e.target.value }))}
                  placeholder="Senha Domínio"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">Hospedagem</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hosting_login">Login</Label>
                <Input
                  id="hosting_login"
                  value={acessoForm.hosting_login}
                  onChange={(e) => setAcessoForm(prev => ({ ...prev, hosting_login: e.target.value }))}
                  placeholder="Login Hospedagem"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hosting_password">Senha</Label>
                <Input
                  id="hosting_password"
                  type="password"
                  value={acessoForm.hosting_password}
                  onChange={(e) => setAcessoForm(prev => ({ ...prev, hosting_password: e.target.value }))}
                  placeholder="Senha Hospedagem"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Acessos'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
