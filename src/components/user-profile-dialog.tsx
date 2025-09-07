import React, { useState, useEffect } from "react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Save, User, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"

interface UserProfileDialogProps {
  children: React.ReactNode
}

export function UserProfileDialog({ children }: UserProfileDialogProps) {
  const { toast } = useToast()
  const { user, logout, updateProfile, uploadAvatar, changePassword } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [userData, setUserData] = useState({
    nome: user?.full_name || "",
    email: user?.email || "",
    cargo: user?.role || "",
    bio: user?.bio || "",
    avatar: user?.avatar_url || ""
  })
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  })

  useEffect(() => {
    if (user) {
      setUserData({
        nome: user.full_name || "",
        email: user.email || "",
        cargo: user.role || "",
        bio: user.bio || "",
        avatar: user.avatar_url || ""
      })
    }
  }, [user])

  const handleSave = async () => {
    // Validação básica
    if (!userData.nome || !userData.email) {
      toast({
        title: "Erro",
        description: "Nome e email são obrigatórios",
        variant: "destructive"
      })
      return
    }

    if (passwords.new && passwords.new !== passwords.confirm) {
      toast({
        title: "Erro", 
        description: "As senhas não coincidem",
        variant: "destructive"
      })
      return
    }

    try {
      // Atualizar perfil
      await updateProfile({
        full_name: userData.nome,
        role: userData.cargo,
        bio: userData.bio,
        avatar_url: userData.avatar
      })
      
      // Alterar senha se fornecida
      if (passwords.new && passwords.current) {
        await changePassword(passwords.current, passwords.new)
      }
      
      toast({
        title: "Perfil atualizado",
        description: passwords.new ? "Perfil e senha atualizados com sucesso" : "Suas informações foram salvas com sucesso"
      })
      setOpen(false)
      setPasswords({ current: "", new: "", confirm: "" })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar perfil. Tente novamente.",
        variant: "destructive"
      })
    }
  }

  const handleLogout = () => {
    logout()
    setOpen(false)
    navigate('/login')
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso"
    })
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Erro",
            description: "Apenas arquivos de imagem são permitidos",
            variant: "destructive"
          })
          return
        }

        // Validar tamanho do arquivo (5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Erro",
            description: "O arquivo deve ter no máximo 5MB",
            variant: "destructive"
          })
          return
        }

        // Fazer upload do avatar
        await uploadAvatar(file)
        
        toast({
          title: "Avatar atualizado",
          description: "Sua foto de perfil foi atualizada com sucesso"
        })
      } catch (error) {
        console.error('Erro ao fazer upload do avatar:', error)
        toast({
          title: "Erro",
          description: "Erro ao atualizar avatar. Tente novamente.",
          variant: "destructive"
        })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Perfil do Usuário</DialogTitle>
          <DialogDescription>
            Gerencie suas informações pessoais e configurações de conta
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={userData.avatar} />
              <AvatarFallback className="text-lg">
                {userData.nome.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="avatar-upload"
              />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  <Camera className="h-4 w-4 mr-2" />
                  Alterar Foto
                </label>
              </Button>
            </div>
          </div>

          {/* Informações Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Pessoais</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={userData.nome}
                  onChange={(e) => setUserData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  value={userData.cargo}
                  onChange={(e) => setUserData(prev => ({ ...prev, cargo: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userData.email}
                onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografia</Label>
              <Textarea
                id="bio"
                value={userData.bio}
                onChange={(e) => setUserData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Conte um pouco sobre você..."
                rows={3}
              />
            </div>
          </div>

          {/* Alterar Senha */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Alterar Senha</h3>
            
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input
                id="current-password"
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-between pt-4">
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}