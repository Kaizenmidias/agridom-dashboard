import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Plus, TrendingDown, TrendingUp, DollarSign, Calendar, Edit, Trash2, Loader2 } from 'lucide-react';
import { NovaDespesaDialog } from '@/components/nova-despesa-dialog';
import { EditarDespesaDialog } from '@/components/editar-despesa-dialog';
import { EditableTable, Column } from '@/components/ui/editable-table';
import { getExpenses, deleteExpense, updateExpense } from '@/api/crud';
import { Expense } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { calculateMonthlyAmount } from '@/utils/billing-calculations';
import { useAuth } from '@/contexts/AuthContext';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { usePagination } from '@/hooks/use-pagination';

const DespesasPage = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [despesas, setDespesas] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Configurar paginação
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    totalItems,
    paginatedData: paginatedDespesas,
    setCurrentPage,
    setItemsPerPage
  } = usePagination({
    data: despesas,
    initialItemsPerPage: 10
  });

  const fetchDespesas = async () => {
    // Verificar se o usuário está autenticado antes de carregar dados
    if (!isAuthenticated || !user) {
      console.warn('Tentativa de carregar despesas sem autenticação válida');
      setDespesas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getExpenses();
      // Garantir que data seja sempre um array
      setDespesas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      // Em caso de erro, definir como array vazio
      setDespesas([]);
      // Se for erro de token, não mostrar toast de erro (será tratado pela autenticação)
      if (error?.message?.includes('Token') || error?.message?.includes('token')) {
        console.warn('Erro de token ao carregar despesas, será tratado pela autenticação');
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível carregar as despesas.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchDespesas();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) {
      return;
    }

    try {
      await deleteExpense(id);
      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso.",
      });
      fetchDespesas(); // Recarregar a lista
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a despesa.",
        variant: "destructive",
      });
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditDialogOpen(true);
  };


  // Calcula total considerando recorrência para despesas não-únicas
  const totalDespesas = despesas.reduce((acc, despesa) => {
    const billingType = despesa.billing_type || 'unica';
    
    // Para despesas únicas, usa valor direto
    if (billingType === 'unica' || billingType === 'one_time') {
      return acc + (Number(despesa.amount) || 0);
    }
    
    // Para despesas recorrentes, calcula valor mensal
    const monthlyAmount = calculateMonthlyAmount(
      Number(despesa.amount) || 0,
      billingType,
      despesa.date,
      new Date().getFullYear(),
      new Date().getMonth() + 1
    );
    
    return acc + (Number(monthlyAmount) || 0);
  }, 0);

  // Todas as despesas são consideradas registradas
  const quantidadeDespesas = despesas.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Despesas</h1>
          <p className="text-muted-foreground">Controle e monitore todas as despesas da empresa</p>
        </div>
        <NovaDespesaDialog onExpenseCreated={fetchDespesas}>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Despesa
          </Button>
        </NovaDespesaDialog>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total do Mês</p>
                <p className="text-xl font-bold text-red-600">{(Number(totalDespesas) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
                <p className="text-xl font-bold">{quantidadeDespesas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Despesas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Despesas</CardTitle>
          <CardDescription>Todas as despesas registradas no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando despesas...</span>
            </div>
          ) : (
            <EditableTable
              data={paginatedDespesas.map(despesa => {
                const expenseDate = despesa.date;
                const billingType = despesa.billing_type || 'unica';
                
                // Calcula valor mensal para despesas recorrentes
                let monthlyAmount;
                if (billingType === 'unica' || billingType === 'one_time') {
                  monthlyAmount = Number(despesa.amount) || 0;
                } else {
                  monthlyAmount = calculateMonthlyAmount(
                    Number(despesa.amount) || 0,
                    billingType,
                    expenseDate,
                    new Date().getFullYear(),
                    new Date().getMonth() + 1
                  );
                }
                
                let formattedDate = 'Data inválida';
                
                if (expenseDate) {
                  try {
                    const dateObj = new Date(expenseDate);
                    if (!isNaN(dateObj.getTime())) {
                      formattedDate = dateObj.toLocaleDateString('pt-BR');
                    }
                  } catch (error) {
                    console.error('Erro ao formatar data:', expenseDate, error);
                  }
                }
                
                return {
                  ...despesa,
                  date: formattedDate,
                  amount: `R$ ${(Number(despesa.amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  monthly_amount: `R$ ${(Number(monthlyAmount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  billing_type: despesa.billing_type === 'one_time' ? 'Única' : 
                               despesa.billing_type === 'recurring' ? 'Recorrente' : 
                               despesa.billing_type === 'unica' ? 'Única' : 
                               despesa.billing_type === 'semanal' ? 'Semanal' : 
                               despesa.billing_type === 'mensal' ? 'Mensal' : 
                               despesa.billing_type === 'anual' ? 'Anual' : 'Única'
                };
              })}
              columns={[
                { id: 'description', header: 'Despesa', accessorKey: 'description', isEditable: false },
                { id: 'amount', header: 'Valor Original', accessorKey: 'amount', isEditable: false },
                { id: 'monthly_amount', header: 'Valor Mensal', accessorKey: 'monthly_amount', isEditable: false },
                { id: 'billing_type', header: 'Tipo de Cobrança', accessorKey: 'billing_type', isEditable: false },
                { id: 'date', header: 'Data', accessorKey: 'date', isEditable: false }
              ]}
              onUpdate={() => {}}
              onDelete={(rowIndex) => {
                const despesa = paginatedDespesas[rowIndex];
                handleDeleteExpense(despesa.id);
              }}
              actions={[
                {
                  icon: <Edit className="h-4 w-4" />,
                  label: 'Editar',
                  onClick: (rowIndex) => {
                    const despesa = paginatedDespesas[rowIndex];
                    handleEditExpense(despesa);
                  }
                }
              ]}
              className="mt-4"
            />
          )}
            
          {/* Componente de Paginação */}
          {despesas.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </CardContent>
      </Card>
      
      <EditarDespesaDialog
        expense={editingExpense}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onExpenseUpdated={fetchDespesas}
      />
    </div>
  );
};

export default DespesasPage;