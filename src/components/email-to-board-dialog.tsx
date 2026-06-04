import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Check, Mail, RefreshCw, Sparkles, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function EmailToBoardDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // URL real da API do Supabase para a tabela briefings
  const webhookUrl = "https://qwbpruywwfjadkudegcj.supabase.co/rest/v1/briefings"
  const webhookEmail = "kaizenwebdesign+msfvlom1deooz0zsfa2c@boards.trello.com"

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: "Copiado!",
      description: "O endereço foi copiado para sua área de transferência.",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-[#1c2128] border-gray-800 text-gray-200 p-0 overflow-hidden">
        <div className="p-6 space-y-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-gray-100">Adicionar Cartões via Email</DialogTitle>
            </div>
            <DialogDescription className="text-gray-400 text-xs">
              Use este endereço para criar briefings automaticamente a partir de formulários do seu site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">
                Endereço de e-mail para este quadro
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 bg-[#0d1117] border border-gray-700 rounded-md px-3 py-2 text-sm font-mono text-blue-400 truncate">
                  {webhookEmail}
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => copyToClipboard(webhookEmail)}
                >
                  {copied ? <Check className="h-4 w-4" /> : "Copiar"}
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 italic">
                Qualquer pessoa com esse e-mail pode adicionar cartões como você.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-800">
              <Button variant="link" className="text-blue-400 p-0 h-auto text-xs flex items-center gap-2 hover:no-underline">
                Redefinir endereço de e-mail
              </Button>
              <Button variant="link" className="text-blue-400 p-0 h-auto text-xs flex items-center gap-2 hover:no-underline">
                Enviar este endereço por e-mail para mim
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">Resuma com IA</span>
                <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30 text-[9px] uppercase font-bold px-1 py-0">Premium</Badge>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                A Atlassian Intelligence está desativada para E-mail para quadro. <span className="text-blue-400 cursor-pointer">Saiba mais sobre a função.</span>
              </p>
            </div>

            <div className="space-y-4 pt-2 border-t border-gray-800">
              <p className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">
                Seus cartões enviados por email aparecem em...
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-gray-400">Lista</Label>
                  <Select defaultValue="new">
                    <SelectTrigger className="bg-[#2d333b] border-gray-700 h-9 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d333b] border-gray-700 text-gray-200">
                      <SelectItem value="new">Novos projetos</SelectItem>
                      <SelectItem value="developing">Desenvolvendo</SelectItem>
                      <SelectItem value="changes">Alterações</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-gray-400">Posição</Label>
                  <Select defaultValue="top">
                    <SelectTrigger className="bg-[#2d333b] border-gray-700 h-9 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d333b] border-gray-700 text-gray-200">
                      <SelectItem value="top">No topo</SelectItem>
                      <SelectItem value="bottom">No final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  Dica de Integração
                </div>
                <p className="text-[10px] text-blue-300/80 leading-relaxed">
                  Para integrar com o seu site, configure o seu formulário para enviar um POST JSON para a URL abaixo. <br/>
                  <strong>Importante:</strong> Você precisará adicionar o cabeçalho <code>apikey</code> com a sua chave do Supabase.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Input 
                    readOnly 
                    value={webhookUrl} 
                    className="h-7 bg-[#0d1117] border-gray-700 text-[9px] font-mono text-gray-400"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-gray-400 hover:text-white"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#2d333b] px-6 py-3 flex items-center gap-2 text-gray-400 hover:text-gray-200 cursor-pointer transition-colors border-t border-gray-800">
          <Mail className="h-4 w-4" />
          <span className="text-xs font-medium">E-mail para quadro</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
