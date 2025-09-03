import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { createExpense, getProjects } from '@/api/crud';
import { Loader2 } from 'lucide-react';
import { Project } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { getDayOfWeekFromDate, calculateMonthlyAmount, getWeekdayOccurrencesInMonth } from '@/utils/billing-calculations';

const despesaSchema = z.object({
  description: z.string().min(1, 'Despesa é obrigatória'),
  amount: z.string().min(1, 'Valor é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  billing_type: z.enum(['unica', 'semanal', 'mensal', 'anual']).default('unica'),
  notes: z.string().optional(),
});

type DespesaFormData = z.infer<typeof despesaSchema>;

interface NovaDespesaDialogProps {
  children: React.ReactNode;
  onExpenseCreated?: () => void;
}

export function NovaDespesaDialog({ children, onExpenseCreated }: NovaDespesaDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DespesaFormData>({
    resolver: zodResolver(despesaSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    }
  });

  // Observar mudanças nos campos para calcular preview
  const watchedAmount = watch('amount');
  const watchedDate = watch('date');
  const watchedBillingType = watch('billing_type');

  // Carregar projetos quando o componente montar
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        const projectsList = await getProjects();
        setProjects(projectsList);
      } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os projetos.",
          variant: "destructive"
        });
      } finally {
        setLoadingProjects(false);
      }
    };

    if (open) {
      loadProjects();
    }
  }, [open, toast]);

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    
    const amount = parseInt(numericValue) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValue('amount', formatted);
  };

  // Calcular preview do valor mensal
  const calculateMonthlyPreview = () => {
    if (!watchedAmount || !watchedDate || !watchedBillingType) return null;
    
    const amount = parseFloat(watchedAmount.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return null;
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    const monthlyAmount = calculateMonthlyAmount(
      amount,
      watchedBillingType,
      watchedDate,
      year,
      month
    );
    
    return {
      amount: monthlyAmount,
      occurrences: watchedBillingType === 'semanal' 
        ? getWeekdayOccurrencesInMonth(year, month, getDayOfWeekFromDate(watchedDate))
        : null
    };
  };

  const monthlyPreview = calculateMonthlyPreview();

  const onSubmit = async (data: DespesaFormData) => {
    setIsSubmitting(true);
    
    try {
      // Verificar se há projetos disponíveis
      if (projects.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhum projeto encontrado. Crie um projeto primeiro.",
          variant: "destructive",
        });
        return;
      }

      // Converter valor de string para número
      const amount = parseFloat(data.amount.replace(/[^\d,]/g, '').replace(',', '.'));
      
      // Calcular recurring_day_of_week para despesas semanais
      const recurringDayOfWeek = data.billing_type === 'semanal' 
        ? getDayOfWeekFromDate(data.date) 
        : null;
      
      await createExpense({
        project_id: projects[0].id, // Usar o primeiro projeto disponível
        description: data.description,
        amount,
        date: data.date,
        category: 'Geral',
        notes: data.notes || '',
        billing_type: data.billing_type,
        is_recurring: data.billing_type !== 'unica',
        recurring_day_of_week: recurringDayOfWeek,
        status: 'paid'
      });
      
      toast({
        title: "Despesa cadastrada!",
        description: `A despesa "${data.description}" foi cadastrada com sucesso.`,
      });

      reset();
      setOpen(false);
      
      // Chamar callback para atualizar a lista
      if (onExpenseCreated) {
        onExpenseCreated();
      }
    } catch (error) {
      console.error('Erro ao cadastrar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar a despesa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Despesa</DialogTitle>
          <DialogDescription>
            Cadastre uma nova despesa no sistema. Preencha todos os campos obrigatórios.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Despesa *</Label>
              <Input
                id="description"
                placeholder="Ex: Licença Adobe Creative Suite"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                placeholder="R$ 0,00"
                {...register('amount')}
                onChange={handleValorChange}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                {...register('date')}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_type">Tipo de Cobrança *</Label>
              <Select onValueChange={(value) => setValue('billing_type', value as 'unica' | 'semanal' | 'mensal' | 'anual')} defaultValue="unica">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unica">Única</SelectItem>
                  <SelectItem value="semanal">
                    <div className="flex flex-col">
                      <span>Semanal</span>
                      <span className="text-xs text-muted-foreground">Valor multiplicado pelas ocorrências do dia no mês</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">
                    <div className="flex flex-col">
                      <span>Anual</span>
                      <span className="text-xs text-muted-foreground">Valor dividido por 12 meses</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.billing_type && (
                <p className="text-sm text-destructive">{errors.billing_type.message}</p>
              )}
            </div>
          </div>

          {/* Preview do Valor Mensal */}
          {monthlyPreview && watchedBillingType !== 'unica' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-blue-900">Cálculo Mensal</h4>
              <div className="text-sm text-blue-700">
                {watchedBillingType === 'semanal' && (
                  <>
                    <p>
                      <strong>Valor por ocorrência:</strong> {watchedAmount}
                    </p>
                    <p>
                      <strong>Ocorrências neste mês:</strong> {monthlyPreview.occurrences}x
                    </p>
                    <p>
                      <strong>Total mensal:</strong> {monthlyPreview.amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                    <p className="text-xs mt-1 text-blue-600">
                      * O valor mensal varia conforme a quantidade de ocorrências do dia da semana no mês
                    </p>
                  </>
                )}
                {watchedBillingType === 'mensal' && (
                  <p>
                    <strong>Valor mensal:</strong> {monthlyPreview.amount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </p>
                )}
                {watchedBillingType === 'anual' && (
                  <>
                    <p>
                      <strong>Valor anual:</strong> {watchedAmount}
                    </p>
                    <p>
                      <strong>Valor mensal (anual ÷ 12):</strong> {monthlyPreview.amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais sobre a despesa..."
              rows={3}
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Cadastrar Despesa'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}