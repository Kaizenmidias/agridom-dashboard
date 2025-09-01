import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingDown, TrendingUp, DollarSign, Calendar } from 'lucide-react';

const DespesasPage = () => {
  const despesas = [
    {
      id: 1,
      descricao: "Licença Adobe Creative Suite",
      categoria: "Software",
      valor: "R$ 180,00",
      data: "2024-01-15",
      tipo: "Recorrente",
      status: "Pago"
    },
    {
      id: 2,
      descricao: "Hospedagem de Sites - Hostgator",
      categoria: "Infraestrutura",
      valor: "R$ 25,90",
      data: "2024-01-10",
      tipo: "Mensal",
      status: "Pago"
    },
    {
      id: 3,
      descricao: "Domínio cliente-exemplo.com",
      categoria: "Domínios",
      valor: "R$ 40,00",
      data: "2024-01-08",
      tipo: "Anual",
      status: "Pendente"
    },
    {
      id: 4,
      descricao: "Internet - Vivo Fibra",
      categoria: "Internet",
      valor: "R$ 120,00",
      data: "2024-01-05",
      tipo: "Mensal",
      status: "Pago"
    },
    {
      id: 5,
      descricao: "Material de Marketing",
      categoria: "Marketing",
      valor: "R$ 350,00",
      data: "2024-01-20",
      tipo: "Eventual",
      status: "Pago"
    }
  ];

  const categorias = [
    { nome: "Software", total: "R$ 180,00", cor: "bg-blue-100 text-blue-800" },
    { nome: "Infraestrutura", total: "R$ 25,90", cor: "bg-green-100 text-green-800" },
    { nome: "Domínios", total: "R$ 40,00", cor: "bg-purple-100 text-purple-800" },
    { nome: "Internet", total: "R$ 120,00", cor: "bg-orange-100 text-orange-800" },
    { nome: "Marketing", total: "R$ 350,00", cor: "bg-pink-100 text-pink-800" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago': return 'bg-green-100 text-green-800';
      case 'Pendente': return 'bg-yellow-100 text-yellow-800';
      case 'Vencido': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalDespesas = despesas.reduce((acc, despesa) => {
    return acc + parseFloat(despesa.valor.replace('R$ ', '').replace(',', '.'));
  }, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Despesas</h1>
          <p className="text-muted-foreground">Controle e monitore todas as despesas da empresa</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total do Mês</p>
                <p className="text-xl font-bold text-red-600">R$ {totalDespesas.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-xl font-bold">4</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Economia</p>
                <p className="text-xl font-bold text-green-600">-5%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Despesas */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Despesas Recentes</CardTitle>
              <CardDescription>Últimas despesas registradas no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {despesas.map((despesa) => (
                  <div key={despesa.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{despesa.descricao}</p>
                        <p className="text-sm text-muted-foreground">
                          {despesa.categoria} • {new Date(despesa.data).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-x-2">
                      <Badge className={getStatusColor(despesa.status)}>
                        {despesa.status}
                      </Badge>
                      <p className="font-semibold">{despesa.valor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categorias */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
              <CardDescription>Distribuição dos gastos por categoria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categorias.map((categoria, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={categoria.cor}>
                        {categoria.nome}
                      </Badge>
                    </div>
                    <span className="font-medium">{categoria.total}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                Exportar Relatório
              </Button>
              <Button variant="outline" className="w-full">
                Configurar Alertas
              </Button>
              <Button variant="outline" className="w-full">
                Ver Estatísticas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DespesasPage;