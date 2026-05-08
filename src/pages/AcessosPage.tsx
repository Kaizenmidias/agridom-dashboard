import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Key, Globe, Server, Laptop, Search, Copy, Check } from 'lucide-react';
import { getCompanyAccesses, deleteCompanyAccess, CompanyAccess } from '@/api/crud';
import { NovoAcessoDialog } from '@/components/novo-acesso-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const AcessosPage = () => {
  const [acessos, setAcessos] = useState<CompanyAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAcessos = async () => {
    try {
      setLoading(true);
      const data = await getCompanyAccesses();
      setAcessos(data);
    } catch (error) {
      console.error('Erro ao buscar acessos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os acessos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcessos();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir estes acessos?')) {
      try {
        await deleteCompanyAccess(id);
        toast({
          title: "Acesso excluído",
          description: "Os acessos foram removidos com sucesso.",
        });
        fetchAcessos();
      } catch (error) {
        console.error('Erro ao excluir acesso:', error);
        toast({
          title: "Erro",
          description: "Não foi possível excluir os acessos.",
          variant: "destructive",
        });
      }
    }
  };

  const copyToClipboard = (text: string | undefined, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(fieldId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copiado",
      description: "Informação copiada para a área de transferência.",
    });
  };

  const filteredAcessos = acessos.filter(acesso => 
    acesso.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Acessos</h1>
          <p className="text-muted-foreground">Gerencie logins e senhas das empresas</p>
        </div>
        <NovoAcessoDialog onAcessoChange={fetchAcessos}>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Acesso
          </Button>
        </NovoAcessoDialog>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50"></CardHeader>
              <CardContent className="h-48"></CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAcessos.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nenhum acesso encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Nenhuma empresa corresponde à sua busca.' : 'Comece cadastrando os acessos da primeira empresa.'}
            </p>
            {!searchTerm && (
              <NovoAcessoDialog onAcessoChange={fetchAcessos}>
                <Button variant="outline">Cadastrar Agora</Button>
              </NovoAcessoDialog>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAcessos.map((acesso) => (
            <Card key={acesso.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl truncate max-w-[200px]">{acesso.company_name}</CardTitle>
                  <div className="flex gap-1">
                    <NovoAcessoDialog acesso={acesso} onAcessoChange={fetchAcessos}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4 text-blue-500" />
                      </Button>
                    </NovoAcessoDialog>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleDelete(acesso.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* WordPress */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Laptop className="h-4 w-4" />
                    WordPress
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground uppercase text-[10px]">Login</p>
                      <div className="flex justify-between items-center group">
                        <span className="truncate font-medium">{acesso.wordpress_login || '-'}</span>
                        {acesso.wordpress_login && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(acesso.wordpress_login, `wp-l-${acesso.id}`)}
                          >
                            {copiedId === `wp-l-${acesso.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground uppercase text-[10px]">Senha</p>
                      <div className="flex justify-between items-center group">
                        <span className="truncate font-medium">••••••••</span>
                        {acesso.wordpress_password && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(acesso.wordpress_password, `wp-p-${acesso.id}`)}
                          >
                            {copiedId === `wp-p-${acesso.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Domínio */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                    <Globe className="h-4 w-4" />
                    Domínio
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground uppercase text-[10px]">Login</p>
                      <div className="flex justify-between items-center group">
                        <span className="truncate font-medium">{acesso.domain_login || '-'}</span>
                        {acesso.domain_login && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(acesso.domain_login, `dom-l-${acesso.id}`)}
                          >
                            {copiedId === `dom-l-${acesso.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground uppercase text-[10px]">Senha</p>
                      <div className="flex justify-between items-center group">
                        <span className="truncate font-medium">••••••••</span>
                        {acesso.domain_password && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(acesso.domain_password, `dom-p-${acesso.id}`)}
                          >
                            {copiedId === `dom-p-${acesso.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hospedagem */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-orange-600">
                    <Server className="h-4 w-4" />
                    Hospedagem
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground uppercase text-[10px]">Login</p>
                      <div className="flex justify-between items-center group">
                        <span className="truncate font-medium">{acesso.hosting_login || '-'}</span>
                        {acesso.hosting_login && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(acesso.hosting_login, `host-l-${acesso.id}`)}
                          >
                            {copiedId === `host-l-${acesso.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground uppercase text-[10px]">Senha</p>
                      <div className="flex justify-between items-center group">
                        <span className="truncate font-medium">••••••••</span>
                        {acesso.hosting_password && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(acesso.hosting_password, `host-p-${acesso.id}`)}
                          >
                            {copiedId === `host-p-${acesso.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AcessosPage;
