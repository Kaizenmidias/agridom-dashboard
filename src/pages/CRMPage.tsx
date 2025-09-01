import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, Mail, Calendar, TrendingUp, Users, Target } from 'lucide-react';

const CRMPage = () => {
  const clientes = [
    {
      id: 1,
      nome: "TechCorp Soluções",
      email: "contato@techcorp.com",
      telefone: "(11) 99999-9999",
      status: "Ativo",
      ultimoContato: "2024-01-20",
      valorProjetos: "R$ 45.000,00",
      projetos: 3
    },
    {
      id: 2,
      nome: "ModaStyle Boutique",
      email: "vendas@modastyle.com",
      telefone: "(11) 88888-8888",
      status: "Proposta",
      ultimoContato: "2024-01-18",
      valorProjetos: "R$ 25.000,00",
      projetos: 1
    },
    {
      id: 3,
      nome: "StartupX Innovation",
      email: "hello@startupx.com",
      telefone: "(11) 77777-7777",
      status: "Negociação",
      ultimoContato: "2024-01-15",
      valorProjetos: "R$ 15.000,00",
      projetos: 2
    },
    {
      id: 4,
      nome: "EcoGreen Sustentável",
      email: "contato@ecogreen.com",
      telefone: "(11) 66666-6666",
      status: "Lead",
      ultimoContato: "2024-01-22",
      valorProjetos: "R$ 8.500,00",
      projetos: 1
    }
  ];

  const leads = [
    {
      id: 1,
      nome: "Restaurante Sabor & Arte",
      fonte: "Website",
      interesse: "E-commerce",
      prioridade: "Alta"
    },
    {
      id: 2,
      nome: "Clínica Dental Plus",
      fonte: "Indicação",
      interesse: "Site Institucional", 
      prioridade: "Média"
    },
    {
      id: 3,
      nome: "Academia Fitness Pro",
      fonte: "Google Ads",
      interesse: "Landing Page",
      prioridade: "Baixa"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativo': return 'bg-green-100 text-green-800';
      case 'Proposta': return 'bg-blue-100 text-blue-800';
      case 'Negociação': return 'bg-yellow-100 text-yellow-800';
      case 'Lead': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'Alta': return 'bg-red-100 text-red-800';
      case 'Média': return 'bg-yellow-100 text-yellow-800';
      case 'Baixa': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalValorProjetos = clientes.reduce((acc, cliente) => {
    return acc + parseFloat(cliente.valorProjetos.replace('R$ ', '').replace('.', '').replace(',', '.'));
  }, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground">Gerencie relacionamentos com clientes e leads</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Métricas do CRM */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-xl font-bold">{clientes.length}</p>
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
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">R$ {totalValorProjetos.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Novos Leads</p>
                <p className="text-xl font-bold">{leads.length}</p>
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
                <p className="text-sm text-muted-foreground">Taxa Conversão</p>
                <p className="text-xl font-bold">75%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Clientes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Gerencie sua base de clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clientes.map((cliente) => (
                  <div key={cliente.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{cliente.nome}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{cliente.email}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{cliente.telefone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge className={getStatusColor(cliente.status)}>
                        {cliente.status}
                      </Badge>
                      <p className="text-sm font-medium text-green-600">{cliente.valorProjetos}</p>
                      <p className="text-xs text-muted-foreground">{cliente.projetos} projeto(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads e Ações */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Novos Leads</CardTitle>
              <CardDescription>Últimos leads capturados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leads.map((lead) => (
                  <div key={lead.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{lead.nome}</h4>
                      <Badge className={getPrioridadeColor(lead.prioridade)} variant="secondary">
                        {lead.prioridade}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{lead.interesse}</p>
                    <p className="text-xs text-muted-foreground">Fonte: {lead.fonte}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Lead
              </Button>
              <Button variant="outline" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Agendar Follow-up
              </Button>
              <Button variant="outline" className="w-full">
                <TrendingUp className="h-4 w-4 mr-2" />
                Relatório de Vendas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CRMPage;