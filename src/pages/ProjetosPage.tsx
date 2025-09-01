import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, User, DollarSign, Clock } from 'lucide-react';
import { NovoProjetoDialog } from '@/components/novo-projeto-dialog';

const ProjetosPage = () => {
  const projetos = [
    {
      id: 1,
      nome: "Site Institucional - TechCorp",
      cliente: "TechCorp Soluções",
      status: "Em Andamento",
      prazo: "2024-02-15",
      valor: "R$ 15.000,00",
      progresso: 75,
      tipo: "Website"
    },
    {
      id: 2,
      nome: "E-commerce - ModaStyle",
      cliente: "ModaStyle Boutique",
      status: "Finalizado",
      prazo: "2024-01-30",
      valor: "R$ 25.000,00",
      progresso: 100,
      tipo: "E-commerce"
    },
    {
      id: 3,
      nome: "Landing Page - StartupX",
      cliente: "StartupX Innovation",
      status: "Planejamento",
      prazo: "2024-03-01",
      valor: "R$ 8.500,00",
      progresso: 20,
      tipo: "Landing Page"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em Andamento': return 'bg-blue-100 text-blue-800';
      case 'Finalizado': return 'bg-green-100 text-green-800';
      case 'Planejamento': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground">Gerencie todos os seus projetos de web design</p>
        </div>
        <NovoProjetoDialog>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </NovoProjetoDialog>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finalizados</p>
                <p className="text-xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <User className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planejamento</p>
                <p className="text-xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="text-xl font-bold">R$ 48.500</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Projetos */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {projetos.map((projeto) => (
          <Card key={projeto.id} className="min-w-[300px] max-w-[300px] hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{projeto.nome}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <User className="h-3 w-3" />
                    {projeto.cliente}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(projeto.status)}>
                  {projeto.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{projeto.tipo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">{new Date(projeto.prazo).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-medium text-green-600">{projeto.valor}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso:</span>
                    <span className="font-medium">{projeto.progresso}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${projeto.progresso}%` }}
                    ></div>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Ver Detalhes
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProjetosPage;